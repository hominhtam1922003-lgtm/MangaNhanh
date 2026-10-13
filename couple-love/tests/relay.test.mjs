import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BROKERS,
  RelayClient,
  buildRelayPayload,
  createRoom,
  decodePackets,
  encodeConnect,
  encodeDisconnect,
  encodePingreq,
  encodePublish,
  encodeSubscribe,
  fromBase64Url,
  makeCode,
  open,
  roomFromCode,
  roomFromQr,
  roomToQr,
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
  const room = createRoom();
  assert.equal(fromBase64Url(room.key).length, 32);
  assert.equal(fromBase64Url(room.id).length, 16);
  const sealed = seal(room, { kind: "state", name: "Minh", payload: { a: 1 } });
  assert.equal(open(room, sealed).name, "Minh");
  assert.throws(() => open(createRoom(), sealed), /giải mã/);
  const tampered =
    sealed.slice(0, 10) + (sealed[10] === "A" ? "B" : "A") + sealed.slice(11);
  assert.throws(() => open(room, tampered));
  assert.equal(toBase64Url(fromBase64Url(sealed)), sealed);
});
test("Kết nối tức thời: mã 6 số là mật khẩu phòng, hai máy vào đúng một phòng", () => {
  const code = "482913";
  const a = roomFromCode(code);
  const b = roomFromQr(code);
  assert.equal(a.mode, "code");
  assert.equal(a.code, code);
  assert.equal(
    topicFor(b),
    topicFor(a),
    "nhập đúng 6 số là vào đúng phòng của nhau",
  );
  assert.deepEqual(b, a);
  assert.notEqual(roomFromCode("111111").id, roomFromCode("222222").id);
  assert.equal(makeCode().length, 6);
  assert.match(makeCode(), /^\d{6}$/);
  const heard = seal(a, { kind: "state", name: "Minh", payload: { v: 3 } });
  assert.equal(
    open(b, heard).name,
    "Minh",
    "máy nhập mã đọc được dữ liệu máy tạo mã",
  );
  assert.throws(() => roomFromCode("12345"), /6 chữ số/);
  assert.throws(() => roomFromQr("HTT2:abc"), /thiếu thông tin/);
  assert.throws(() => roomFromQr("linh tinh"), /định dạng/);
  const qr = roomToQr(createRoom());
  const back = roomFromQr(qr);
  assert.equal(roomToQr(back), qr);
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
    room: roomFromCode("482913"),
    onStatus: (status) => statuses.push(status),
    onPayload: () => {},
  });
  assert.equal(client.status.state, "connecting");
  client.partnerSeen = Date.now();
  client.partnerName = "Ngọc Ánh";
  client.connected = true;
  client.emitStatus();
  assert.equal(statuses.at(-1).state, "online");
  assert.equal(statuses.at(-1).partnerName, "Ngọc Ánh");
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
    setTimeout(() => this.onopen && this.onopen(), 1);
  }
  send(bytes) {
    const data = Uint8Array.from(bytes);
    this.sent.push(data);
    if (data[0] === 0x10) {
      this.receive(Uint8Array.from([0x20, 0x02, 0x00, 0x00]));
      return;
    }
    if ((data[0] & 0xf0) === 0x30) {
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
    const socket = new FakeSocket(this);
    this.sockets.push(socket);
    return socket;
  }
}
const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
test("Kết nối tức thời: hai máy nhập cùng mã 6 số thì CẢ HAI cùng nhận dữ liệu", async () => {
  const realWebSocket = globalThis.WebSocket;
  const broker = new FakeBroker();
  function FakeWebSocket() {
    return broker.connect();
  }
  globalThis.WebSocket = FakeWebSocket;
  try {
    const created = roomFromCode("482913");
    const joined = roomFromCode("482913");
    const gotA = [];
    const gotB = [];
    const statusA = [];
    const statusB = [];
    const mayA = new RelayClient({
      room: created,
      deviceId: "mayA",
      onPayload: (payload) => gotA.push(payload),
      onStatus: (status) => statusA.push(status),
    });
    const mayB = new RelayClient({
      room: joined,
      deviceId: "mayB",
      onPayload: (payload) => gotB.push(payload),
      onStatus: (status) => statusB.push(status),
    });
    mayA.start();
    mayB.start();
    await wait(80);
    assert.equal(
      mayA.connected && mayB.connected,
      true,
      "hai máy nối được trạm",
    );
    assert.equal(gotA.length, 0, "máy A không tự nhận bản tin của chính mình");
    assert.equal(gotB.length, 0);
    assert.equal(mayA.status.partnerOnline, true, "A thấy B vừa vào phòng");
    assert.equal(mayB.status.partnerOnline, true, "B thấy A trong phòng");
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
    await wait(80);
    assert.equal(gotA.length, 1, "A nhận đúng một gói của B");
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
    // Máy ở một mình trong phòng thì không được coi bản tin dội lại là người thương.
    const solo = new RelayClient({
      room: createRoom(),
      deviceId: "mayMot",
      onPayload: () => {},
    });
    solo.start();
    await wait(80);
    assert.equal(solo.connected, true);
    assert.equal(
      solo.status.partnerOnline,
      false,
      "ở một mình thì chưa có ai trực tuyến",
    );
    solo.stop();
    mayA.stop();
    mayB.stop();
  } finally {
    globalThis.WebSocket = realWebSocket;
  }
});
