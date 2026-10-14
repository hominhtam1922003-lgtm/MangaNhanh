import { test } from "node:test";

import { testRoom } from "./helpers/rooms.mjs";
import assert from "node:assert/strict";
import nacl from "tweetnacl";
import {
  BROKERS,
  RelayClient,
  buildRelayPayload,
  decodePackets,
  encodeConnect,
  encodeDisconnect,
  encodePingreq,
  encodePublish,
  encodeSubscribe,
  fromBase64Url,
  installRandomBytes,
  open,
  randomSourceReady,
  roomFromPair,
  seal,
  topicFor,
  toBase64Url,
} from "../src/services/relayProtocol.mjs";
import {
  emptyState,
  reduce,
  decodeLink,
  encodeLink,
} from "../src/logic/localState.mjs";
const stateWith = (nickname, extra = []) => {
  let state = emptyState("2026-01-01T00:00:00.000Z");
  state = reduce(state, {
    type: "profile.set",
    nickname,
    mood: "love",
    moodNote: `nhớ ${nickname}`,
  });
  for (const action of extra) state = reduce(state, action);
  return state;
};
test("Kết nối tức thời: mã hóa đầu-cuối, sai khóa thì không đọc được", () => {
  const room = testRoom("phong-a");
  assert.equal(fromBase64Url(room.key).length, 32);
  assert.equal(fromBase64Url(room.id).length, 16);
  const sealed = seal(room, { kind: "state", name: "Minh", payload: { a: 1 } });
  assert.equal(open(room, sealed).name, "Minh");
  assert.throws(() => open(testRoom("phong-b"), sealed), /giải mã/);
  const tampered =
    sealed.slice(0, 10) + (sealed[10] === "A" ? "B" : "A") + sealed.slice(11);
  assert.throws(() => open(room, tampered));
  assert.equal(toBase64Url(fromBase64Url(sealed)), sealed);
});
test("Kết nối tức thời: khoá ghép nối của tài khoản quyết định phòng", () => {
  // Từ 1.18.0 phòng suy ra từ `pair_secret` mà máy chủ sinh khi hai người ghép
  // đôi: hai máy cùng khoá thì vào đúng một phòng, khác khoá thì khác phòng.
  const secret = "khoa-ghep-noi-cua-hai-nguoi-thuong-1";
  const a = roomFromPair(secret);
  const b = roomFromPair(secret);
  assert.equal(a.mode, "pair");
  assert.equal(a.code, null, "không còn mã 6 số nào để lộ");
  assert.deepEqual(a, b);
  assert.equal(topicFor(b), topicFor(a), "cùng khoá là cùng phòng của nhau");
  const heard = seal(a, { kind: "state", name: "Minh", payload: { v: 3 } });
  assert.equal(
    open(b, heard).name,
    "Minh",
    "máy kia đọc được dữ liệu bằng cùng khoá",
  );
  assert.notEqual(
    roomFromPair("khoa-khac-cua-mot-nguoi-la-2").id,
    a.id,
    "khoá khác thì phòng khác",
  );
  assert.throws(() => roomFromPair("ngan-qua"), /khoá ghép nối/i);
});
test("Kết nối tức thời: gói MQTT đúng chuẩn và ghép được dữ liệu về từng byte", () => {
  const connect = encodeConnect("htt-test", 45);
  assert.equal(connect[0], 0x10);
  const subscribe = encodeSubscribe(7, "haitraitim/v3/abc");
  assert.equal(subscribe[0], 0x82);
  const publish = encodePublish("haitraitim/v3/abc", '{"kind":"ping"}');
  const stream = new Uint8Array([
    ...[0x20, 0x02, 0x00, 0x00],
    ...[0x90, 0x03, 0x00, 0x07, 0x00],
    ...[0xd0, 0x00],
    ...publish,
  ]);
  const parsed = decodePackets(stream);
  assert.deepEqual(
    parsed.packets.map((packet) => packet.type),
    ["connack", "suback", "pingresp", "publish"],
  );
  assert.equal(parsed.packets[0].returnCode, 0);
  assert.equal(parsed.packets[3].topic, "haitraitim/v3/abc");
  assert.equal(parsed.packets[3].text, '{"kind":"ping"}');
  assert.equal(parsed.rest.length, 0);
  assert.deepEqual(Array.from(encodePingreq()), [0xc0, 0x00]);
  assert.deepEqual(Array.from(encodeDisconnect()), [0xe0, 0x00]);
  let buffer = new Uint8Array(0);
  const seen = [];
  for (const byte of stream) {
    const decoded = decodePackets(new Uint8Array([...buffer, byte]));
    buffer = decoded.rest;
    seen.push(...decoded.packets.map((packet) => packet.type));
  }
  assert.deepEqual(seen, ["connack", "suback", "pingresp", "publish"]);
});
test("Kết nối tức thời: mỗi máy chỉ gửi dữ liệu của mình nên hai máy thông nhau mà không lặp", () => {
  const a = stateWith("Minh", [
    {
      type: "diary.add",
      title: "Kỷ niệm của Minh",
      body: "x".repeat(900),
      image: "anh.jpg",
    },
    {
      type: "cycle.save",
      lastPeriod: "2026-01-01",
      cycleLength: 28,
      periodLength: 5,
    },
  ]);
  const b = stateWith("Ngọc Ánh", [
    {
      type: "diary.add",
      title: "Kỷ niệm của Ngọc Ánh",
      body: "y".repeat(900),
      image: "anh2.jpg",
    },
  ]);
  const payloadA = buildRelayPayload(a, 60000, "devA");
  const payloadB = buildRelayPayload(b, 60000, "devB");
  assert.equal(payloadA.device, "devA");
  assert.equal(payloadA.from.nickname, "Minh");
  assert.equal(payloadA.diary.length, 1);
  assert.equal(
    payloadA.diary[0].image,
    null,
    "ảnh riêng không đi qua kênh tức thời",
  );
  assert.equal(
    payloadA.partner,
    undefined,
    "không gửi dữ liệu của người thương trở lại",
  );
  const beforeA = JSON.stringify(payloadA);
  // Máy A nhận dữ liệu của B: A phải thấy B và thấy kỷ niệm của B…
  const mergedA = reduce(a, { type: "partner.merge", state: payloadB });
  assert.equal(mergedA.partner.nickname, "Ngọc Ánh");
  assert.equal(
    mergedA.diary.filter((entry) => entry.authorId === "partner").length,
    1,
  );
  assert.equal(
    mergedA.diary.find((entry) => entry.authorId === "partner").title,
    "Kỷ niệm của Ngọc Ánh",
  );
  // …và gói gửi đi của A KHÔNG đổi, nên A không gửi lại vô tận.
  assert.equal(
    JSON.stringify(buildRelayPayload(mergedA, 60000, "devA")),
    beforeA,
  );
  assert.equal(
    buildRelayPayload(mergedA, 60000, "devA").diary.length,
    1,
    "không gửi trả lại kỷ niệm của B",
  );
  // Máy B nhận dữ liệu của A: B cũng thấy A, hai máy cùng thông tin.
  const mergedB = reduce(b, { type: "partner.merge", state: payloadA });
  assert.equal(mergedB.partner.nickname, "Minh");
  assert.equal(mergedB.cycle.cycleLength, 28, "chu kỳ của A sang được B");
  assert.deepEqual(
    mergedA.diary.map((entry) => entry.title).sort(),
    mergedB.diary.map((entry) => entry.title).sort(),
    "gộp xong hai máy giữ cùng danh sách kỷ niệm",
  );
  // Gộp lại lần nữa (dữ liệu cũ) không tạo thêm kỷ niệm trùng.
  const twice = reduce(mergedA, { type: "partner.merge", state: payloadB });
  assert.equal(twice.diary.length, mergedA.diary.length);
});
test("Kết nối tức thời: gói tin lớn được cắt bớt nhưng vẫn giữ phần cốt lõi", () => {
  const actions = [];
  for (let index = 0; index < 40; index++)
    actions.push({
      type: "diary.add",
      title: `Kỷ niệm ${index}`,
      body: "x".repeat(800),
      image: "anh.jpg",
    });
  const big = stateWith("Minh", actions);
  const payload = buildRelayPayload(big, 4000);
  assert.ok(
    JSON.stringify(payload).length <= 4000,
    "payload phải nằm trong giới hạn",
  );
  assert.equal(payload.from.nickname, "Minh");
  assert.ok(payload.diary.every((entry) => entry.image === null));
  const link = encodeLink(big, "full");
  assert.equal(
    decodeLink(link).diary.length,
    40,
    "bản dán tay vẫn là kênh đầy đủ",
  );
});
test("Kết nối tức thời: trạng thái có tên người thương và chỉ báo khi có thay đổi", () => {
  const statuses = [];
  const client = new RelayClient({
    room: testRoom("482913"),
    onStatus: (status) => statuses.push(status),
    onPayload: () => {},
    onLog: () => {},
  });
  assert.equal(client.status.state, "off", "chưa bật thì trạng thái là tắt");
  client.stopped = false;
  client.slots[0].ready = true;
  client.slots[0].subscribed = true;
  client.partnerSeen = Date.now();
  client.partnerName = "Ngọc Ánh";
  client.emitStatus();
  assert.equal(statuses.at(-1).state, "online");
  assert.equal(statuses.at(-1).partnerName, "Ngọc Ánh");
  assert.equal(statuses.at(-1).readyCount, 1);
  assert.deepEqual(statuses.at(-1).summary[0], {
    host: "broker.emqx.io:8084",
    state: "sẵn sàng",
  });
  const count = statuses.length;
  client.emitStatus();
  assert.equal(
    statuses.length,
    count,
    "trạng thái không đổi thì không báo lại",
  );
  assert.ok(BROKERS.every((broker) => broker.startsWith("wss://")));
});

/* ---- Hai máy thật sự nói chuyện với nhau qua một broker giả có dội bản tin ---- */
class FakeSocket {
  constructor(broker) {
    this.broker = broker;
    this.sent = [];
    broker.sockets.push(this);
    setTimeout(() => this.onopen && this.onopen(), 1);
  }
  send(payload) {
    const data =
      payload instanceof ArrayBuffer
        ? new Uint8Array(payload)
        : Uint8Array.from(payload);
    this.sent.push(data);
    const type = data[0] & 0xf0;
    if (type === 0x10) {
      this.receive(Uint8Array.from([0x20, 0x02, 0x00, 0x00]));
      return;
    }
    if (type === 0x80) {
      // SUBACK: trạm xác nhận đã đăng ký phòng.
      this.receive(Uint8Array.from([0x90, 0x03, data[2], data[3], 0x00]));
      return;
    }
    if (type === 0x30) {
      // Broker thật gửi bản tin cho mọi máy đăng ký topic, kể cả máy vừa gửi.
      for (const socket of this.broker.sockets) socket.receive(data);
    }
  }
  receive(bytes) {
    const buffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    );
    setTimeout(() => this.onmessage && this.onmessage({ data: buffer }), 1);
  }
  close() {}
}
class FakeBroker {
  constructor() {
    this.sockets = [];
  }
  connect() {
    return new FakeSocket(this);
  }
}
const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
test("Kết nối tức thời: hai máy nhập cùng mã 6 số thì CẢ HAI cùng nhận dữ liệu", async () => {
  const realWebSocket = globalThis.WebSocket;
  const broker = new FakeBroker();
  globalThis.WebSocket = function FakeWebSocket() {
    return broker.connect();
  };
  const clients = [];
  try {
    const created = testRoom("482913");
    const joined = testRoom("482913");
    const gotA = [];
    const gotB = [];
    const statusA = [];
    const statusB = [];
    const logs = [];
    const mayA = new RelayClient({
      room: created,
      deviceId: "mayA",
      onPayload: (payload) => gotA.push(payload),
      onStatus: (status) => statusA.push(status),
      onLog: (entry) => logs.push(entry.text),
    });
    const mayB = new RelayClient({
      room: joined,
      deviceId: "mayB",
      onPayload: (payload) => gotB.push(payload),
      onStatus: (status) => statusB.push(status),
      onLog: () => {},
    });
    clients.push(mayA, mayB);
    mayA.start();
    mayB.start();
    await wait(120);
    assert.equal(
      mayA.connected && mayB.connected,
      true,
      "hai máy đăng ký được phòng",
    );
    assert.equal(gotA.length, 0, "máy A không tự nhận bản tin của chính mình");
    assert.equal(gotB.length, 0);
    assert.equal(mayA.status.partnerOnline, true, "A thấy B vừa vào phòng");
    assert.equal(mayB.status.partnerOnline, true, "B thấy A trong phòng");
    assert.ok(
      logs.some((text) => text.includes("sẵn sàng nhận dữ liệu")),
      "nhật ký ghi rõ lúc sẵn sàng",
    );
    // Đúng cách App làm: mỗi máy gửi dữ liệu của mình khi thấy người thương trực tuyến.
    const stateA = stateWith("Minh", [
      { type: "diary.add", title: "Hẹn hò đầu tiên", body: "a" },
    ]);
    const stateB = stateWith("Ngọc Ánh", [
      { type: "diary.add", title: "Tấm ảnh ở Đà Lạt", body: "b" },
    ]);
    assert.equal(
      mayA.publishState(buildRelayPayload(stateA, 60000, "mayA"), "Minh"),
      true,
    );
    assert.equal(
      mayB.publishState(buildRelayPayload(stateB, 60000, "mayB"), "Ngọc Ánh"),
      true,
    );
    await wait(120);
    assert.equal(
      gotA.length,
      1,
      "A nhận đúng một gói của B (không nhân bản theo số trạm)",
    );
    assert.equal(gotB.length, 1, "B nhận đúng một gói của A");
    let trenA = stateA;
    let trenB = stateB;
    for (const payload of gotA)
      trenA = reduce(trenA, { type: "partner.merge", state: payload });
    for (const payload of gotB)
      trenB = reduce(trenB, { type: "partner.merge", state: payload });
    assert.equal(
      trenA.partner.nickname,
      "Ngọc Ánh",
      "máy A nhận ghép nối với B",
    );
    assert.equal(trenB.partner.nickname, "Minh", "máy B nhận ghép nối với A");
    assert.deepEqual(
      trenA.diary
        .filter((entry) => entry.authorId === "partner")
        .map((entry) => entry.title),
      ["Tấm ảnh ở Đà Lạt"],
      "kỷ niệm của B nằm trên máy A",
    );
    assert.deepEqual(
      trenB.diary
        .filter((entry) => entry.authorId === "partner")
        .map((entry) => entry.title),
      ["Hẹn hò đầu tiên"],
      "kỷ niệm của A nằm trên máy B",
    );
    assert.deepEqual(
      trenA.diary.map((entry) => entry.title).sort(),
      trenB.diary.map((entry) => entry.title).sort(),
      "hai máy giữ cùng danh sách kỷ niệm",
    );
    assert.equal(mayA.status.state, "online");
    assert.equal(mayB.status.state, "online");
    assert.equal(
      mayA.status.partnerName,
      "Ngọc Ánh",
      "A biết tên người thương",
    );
    assert.equal(mayB.status.partnerName, "Minh");
    assert.ok(
      mayA.status.summary.every((item) => item.state === "sẵn sàng"),
      "mọi trạm đang sẵn sàng đều được liệt kê trong chi tiết kết nối",
    );
    // Máy ở một mình trong phòng thì không được coi bản tin dội lại là người thương.
    const solo = new RelayClient({
      room: testRoom("mot-minh"),
      deviceId: "mayMot",
      onPayload: () => {},
      onLog: () => {},
    });
    clients.push(solo);
    solo.start();
    await wait(120);
    assert.equal(solo.connected, true);
    assert.equal(
      solo.status.partnerOnline,
      false,
      "ở một mình thì chưa có ai trực tuyến",
    );
  } finally {
    for (const client of clients) client.stop();
    globalThis.WebSocket = realWebSocket;
  }
});

test("Kết nối tức thời: chạy được khi máy KHÔNG có TextEncoder/TextDecoder", async () => {
  const savedEncoder = globalThis.TextEncoder;
  const savedDecoder = globalThis.TextDecoder;
  try {
    // React Native/Hermes không cấp hai lớp này; nếu mã còn dùng chúng thì app văng.
    delete globalThis.TextEncoder;
    delete globalThis.TextDecoder;
    const module = await import(
      `../src/services/relayProtocol.mjs?khong-encoder=${Date.now()}`
    );
    const room = module.roomFromPair("phong-khong-encoder-cua-hai-nguoi");
    const message = {
      kind: "state",
      name: "Ngọc Ánh",
      payload: { note: "ạ ệ ị 💞 nhớ em" },
    };
    assert.equal(
      module.open(room, module.seal(room, message)).name,
      "Ngọc Ánh",
    );
    const sameSecret = "phong-khong-encoder-cua-hai-nguoi-thuong";
    assert.equal(
      module.roomFromPair(sameSecret).id,
      roomFromPair(sameSecret).id,
      "phòng suy ra y hệt khi máy thiếu TextEncoder/TextDecoder",
    );
    const publish = module.encodePublish(
      "haitraitim/v3/abc",
      module.seal(room, message),
    );
    const decoded = module.decodePackets(publish).packets[0];
    assert.equal(
      module.open(room, decoded.text).payload.note,
      "ạ ệ ị 💞 nhớ em",
    );
  } finally {
    globalThis.TextEncoder = savedEncoder;
    globalThis.TextDecoder = savedDecoder;
  }
});
test("Kết nối tức thời: UTF-8 tự viết đúng chuẩn (so từng byte với Node)", () => {
  const room = testRoom("utf8");
  const samples = [
    "xin chào 💞",
    "Ngọc Ánh nhớ Minh",
    "ạ ệ ị ỏ ụ ỳ ỹ",
    "𠮷 emoji 4 byte",
    "dòng dài " + "â".repeat(400),
  ];
  for (const sample of samples) {
    const sealed = seal(room, { name: sample, note: sample });
    const raw = fromBase64Url(sealed);
    const opened = nacl.secretbox.open(
      raw.slice(24),
      raw.slice(0, 24),
      fromBase64Url(room.key),
    );
    assert.ok(opened, "giải mã được bằng tweetnacl của Node");
    assert.deepEqual(
      Array.from(opened),
      Array.from(
        Buffer.from(JSON.stringify({ name: sample, note: sample }), "utf8"),
      ),
      `byte phải khớp chuẩn UTF-8 cho: ${sample.slice(0, 20)}`,
    );
    assert.equal(
      open(room, sealed).name,
      sample,
      "đọc lại đúng dấu tiếng Việt",
    );
  }
});
test("Kết nối tức thời: cài nguồn ngẫu nhiên từ máy và báo lỗi rõ ràng khi thiếu", () => {
  let counter = 0;
  const standard = (size) => {
    const bytes = new Uint8Array(size);
    for (let offset = 0; offset < size; offset += 4096)
      globalThis.crypto.getRandomValues(
        bytes.subarray(offset, Math.min(size, offset + 4096)),
      );
    return bytes;
  };
  try {
    installRandomBytes((size) =>
      Uint8Array.from({ length: size }, () => counter++ % 256),
    );
    assert.equal(randomSourceReady(), true, "cài xong thì báo đã sẵn sàng");
    const room = testRoom("nguon-ngau-nhien");
    // Gói tin dùng nonce 24 byte lấy từ nguồn ngẫu nhiên của máy → phải thấy đúng
    // các byte mà máy cấp, chứng minh nguồn đã được cài thật.
    const sealedBytes = fromBase64Url(seal(room, { kind: "ping" }));
    assert.deepEqual(
      Array.from(sealedBytes.slice(0, 4)),
      [0, 1, 2, 3],
      "nonce dùng đúng byte do máy cấp",
    );
    assert.throws(() => installRandomBytes(null), /nguồn ngẫu nhiên/);
    installRandomBytes(() => new Uint8Array(1));
    assert.throws(() => seal(room, { kind: "ping" }), /ngẫu nhiên|Nguồn/);
  } finally {
    installRandomBytes(standard);
  }
  assert.ok(
    seal(testRoom("nguon-ngau-nhien"), { kind: "ping" }).length > 0,
    "sau khi trả lại nguồn chuẩn vẫn mã hóa được",
  );
});
