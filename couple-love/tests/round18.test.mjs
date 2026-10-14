// Kiểm thử bản 1.18.0 — "Bước 1": tài khoản cố định + ghép nối theo máy chủ + hết
// cảnh tự chui vào phòng cũ (kết nối ảo).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  PAIR_ALPHABET,
  PAIR_CODE_LENGTH,
  accountSummary,
  formatPairCode,
  gateReasonText,
  isValidPairCode,
  normalizePairCode,
  pairGate,
} from "../src/logic/pairing.mjs";
import { roomFromPair } from "../src/services/relayProtocol.mjs";
import {
  ACCOUNT_PROJECT_KEY,
  ACCOUNT_PROJECT_URL,
  resolveAccountConfig,
} from "../src/services/accountConfig.mjs";
import { emptyState, reduce } from "../src/logic/localState.mjs";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative) => readFileSync(path.join(root, relative), "utf8");
const app = read("App.tsx");
const pairGateScreen = read("src/screens/local/PairGate.tsx");

test("mã cố định: 6 ký tự, bỏ I/O/0/1 cho khỏi nhầm", () => {
  assert.equal(PAIR_CODE_LENGTH, 6);
  for (const ch of "IO01")
    assert.equal(PAIR_ALPHABET.includes(ch), false, `bảng chữ không có ${ch}`);
  assert.equal(normalizePairCode(" abc-234 "), "ABC234");
  assert.equal(
    normalizePairCode("ab ci0"),
    "ABC",
    "ký tự lạ bị bỏ, không tự đổi",
  );
  assert.equal(isValidPairCode("ABC234"), true);
  assert.equal(isValidPairCode("ABC23"), false);
  assert.equal(isValidPairCode("ABC23O"), false);
  assert.equal(formatPairCode("ABC234"), "ABC-234");
});

test("chốt cổng ghép nối: chỉ vào phòng khi máy chủ xác nhận có người thương", () => {
  const offline = pairGate({ session: true }); // chưa kiểm tra được máy chủ
  assert.equal(offline.screen, "offline");
  assert.equal(offline.allowRelay, false);
  assert.equal(offline.clearCached, true, "mất mạng cũng phải xoá phòng cũ");

  const noPair = pairGate({
    session: true,
    checked: true,
    partnerId: null,
    secret: null,
    cachedPair: true, // bộ nhớ máy vẫn còn phòng cũ
  });
  assert.equal(noPair.screen, "code");
  assert.equal(noPair.allowRelay, false);
  assert.equal(noPair.clearCached, true);

  const paired = pairGate({
    session: true,
    checked: true,
    partnerId: "uid-cua-nguoi-thuong",
    secret: "khoa-bi-mat",
  });
  assert.equal(paired.screen, "paired");
  assert.equal(paired.allowRelay, true);
  assert.equal(paired.clearCached, false);

  const signedOut = pairGate({ session: false, cachedPair: true });
  assert.equal(signedOut.screen, "login");
  assert.equal(signedOut.clearCached, true);

  const noConfig = pairGate({ hasConfig: false });
  assert.equal(noConfig.screen, "login");
  assert.equal(noConfig.allowRelay, false);
  for (const gate of [offline, noPair, signedOut, noConfig]) {
    assert.ok(gateReasonText(gate).length > 10);
    assert.equal(gate.allowRelay, false);
  }
});

test("phòng kết nối suy ra từ khoá ghép nối: cố định, riêng biệt, đủ dài", () => {
  const secret = "0Fh3s1Qp8Xt2mZk9Ld4Rw7Yb6Nc5Vg1A";
  const first = roomFromPair(secret);
  const second = roomFromPair(secret);
  assert.equal(first.id, second.id, "hai máy phải vào CÙNG một phòng");
  assert.equal(first.key, second.key);
  assert.equal(first.mode, "pair");
  assert.equal(first.code, null, "không còn mã 6 số nào để lộ");
  const other = roomFromPair("1Fh3s1Qp8Xt2mZk9Ld4Rw7Yb6Nc5Vg1B");
  assert.notEqual(first.id, other.id, "khoá khác thì phòng khác");
  assert.notEqual(first.key, other.key);
  assert.ok(
    first.id.length <= 60 && first.key.length <= 90,
    "đúng hạn mức của localState",
  );
  assert.throws(() => roomFromPair("ngan-qua"), /khoá ghép nối/i);
  assert.throws(() => roomFromPair(""), /khoá ghép nối/i);
});

test("mã 6 SỐ ngẫu nhiên đã bị xoá hẳn khỏi giao thức", () => {
  // Màn hình ghép nối chỉ nhận mã cố định chữ–số gắn với tài khoản.
  assert.equal(isValidPairCode("123456"), false);
  assert.equal(
    normalizePairCode("123456"),
    "23456",
    "số bị bỏ vì ngoài bảng chữ",
  );
  // Dọn rác 1.18.0: giao thức không còn hàm sinh/đọc phòng theo mã 6 số hay QR.
  const protocol = read("src/services/relayProtocol.mjs");
  for (const gone of [
    "roomFromCode",
    "roomFromQr",
    "roomToQr",
    "createRoom",
    "makeCode",
  ])
    assert.equal(
      protocol.includes(gone),
      false,
      `relayProtocol.mjs không còn ${gone}`,
    );
});

test("dữ liệu ghép nối: đặt hồ sơ người thương theo tài khoản, xoá là sạch", () => {
  let state = emptyState();
  state = reduce(state, {
    type: "relay.set",
    room: roomFromPair("khoa-du-dai-cho-thoa-dieu-kien"),
    code: "",
    role: "host",
  });
  assert.equal(state.relay.mode, "pair");

  state = reduce(state, {
    type: "partner.account",
    uid: "uid-nguoi-thuong",
    nickname: "Người thương",
    avatar: null,
  });
  assert.equal(state.partner.uid, "uid-nguoi-thuong");
  assert.equal(state.partner.nickname, "Người thương");

  const cleared = reduce(state, { type: "pairing.clear" });
  assert.equal(cleared.relay, null);
  assert.equal(cleared.partner, null);
  assert.ok(
    Array.isArray(cleared.messages) &&
      cleared.messages.length === state.messages.length,
    "xoá ghép nối KHÔNG xoá tin nhắn đã viết",
  );
});

test("App.tsx: không còn tự dựng phòng từ bộ nhớ máy (nguồn của kết nối ảo)", () => {
  assert.match(app, /roomFromPair\(account\.pairSecret\)/);
  assert.equal(
    /roomFromState/.test(app),
    false,
    "phải bỏ hẳn roomFromState(state) trong luồng kết nối",
  );
  assert.equal(
    /roomFromState/.test(read("src/services/relay.ts")),
    false,
    "hàm dựng phòng từ bộ nhớ máy đã bị xoá hẳn (nguồn của kết nối ảo)",
  );
  assert.match(
    app,
    /if \(!relayRoom \|\| !pairChecked \|\| !state\?\.settings\.relay\)/,
  );
  assert.match(
    app,
    /gate\.screen !== "paired"/,
    "màn hình chặn khi chưa ghép nối",
  );
  assert.match(app, /type: "pairing\.clear"/);
  assert.match(app, /rpc\("unpair"\)|unpairAccount/);
});

test("màn hình ghép nối: đăng nhập Google/Facebook, mã cố định, có nút Ngắt kết nối", () => {
  assert.match(pairGateScreen, /Đăng nhập bằng Google/);
  assert.match(pairGateScreen, /Đăng nhập bằng Facebook/);
  assert.match(pairGateScreen, /formatPairCode\(account\?\.shortCode/);
  assert.match(pairGateScreen, /Ngắt kết nối \(cả hai máy\)/);
});

test("dịch vụ tài khoản: dùng đúng hàm máy chủ và không lộ khoá bí mật", () => {
  const service = read("src/services/account.ts");
  for (const rpc of [
    "ensure_profile",
    "pair_with_code",
    "unpair",
    "save_profile",
  ])
    assert.match(service, new RegExp(`rpc\\("${rpc}"`), `thiếu rpc ${rpc}`);
  assert.match(service, /signInWithOAuth/);
  assert.match(service, /exchangeCodeForSession/);
  assert.match(service, /haitraitim:\/\/auth-callback/);
  assert.equal(
    /service_role|sb_secret_/.test(service),
    false,
    "không được có khoá bí mật",
  );
});

test("SQL: có bảng/hàm ghép nối theo tài khoản và quyền đọc chỉ mình + người thương", () => {
  const sql = read("supabase/migrations/002_pairing.sql");
  assert.match(sql, /add column if not exists partner_id uuid/);
  assert.match(sql, /add column if not exists short_code text/);
  assert.match(sql, /create or replace function public\.pair_with_code/);
  assert.match(sql, /create or replace function public\.unpair/);
  assert.match(sql, /create or replace function public\.ensure_profile/);
  assert.match(sql, /create policy profiles_read/);
  assert.match(
    sql,
    /id = \(select partner_id from public\.profiles where id = auth\.uid\(\)\)/,
  );
  assert.match(sql, /pair_secret/, "phòng sinh từ khoá bí mật của máy chủ");
});

test("cấu hình dự án ghép nối nằm trong mã JS (kiểm tra được trong gói cài)", () => {
  const module = read("src/services/accountConfig.mjs");
  assert.match(module, /https:\/\/nbbopfvsthuopiopupqd\.supabase\.co/);
  assert.match(module, /sb_publishable_ycuVrcaQYdRT8mgQx5vypg_-ir0JLv6/);
  const resolved = resolveAccountConfig("", "");
  assert.equal(resolved.url, ACCOUNT_PROJECT_URL);
  assert.equal(resolved.source, "build");
  // Khoá bí mật bị từ chối, luôn rơi về khoá công khai đóng trong app.
  assert.equal(
    resolveAccountConfig("", "sb_secret_khong-duoc").key,
    ACCOUNT_PROJECT_KEY,
  );
  assert.equal(
    resolveAccountConfig(
      "https://du-an-khac.supabase.co",
      "sb_publishable_khac",
    ).url,
    ACCOUNT_PROJECT_URL,
  );
  // Trỏ đúng máy chủ thì tôn trọng biến môi trường (đổi dự án sau này không phải sửa mã).
  assert.equal(
    resolveAccountConfig(
      "https://nbbopfvsthuopiopupqd.supabase.co",
      "sb_publishable_moi",
    ).source,
    "env",
  );
});

test("cấu hình dự án ghép nối cũng đóng trong app.config.js", () => {
  const config = read("app.config.js");
  assert.match(config, /nbbopfvsthuopiopupqd\.supabase\.co/);
  assert.match(config, /sb_publishable_/);
  const builtKey = /const SUPABASE_KEY = "([^"]+)"/.exec(config)?.[1] ?? "";
  assert.ok(
    builtKey.startsWith("sb_publishable_"),
    "khoá đóng trong app là khoá công khai",
  );
  assert.equal(
    builtKey.startsWith("sb_secret_"),
    false,
    "không nhúng khoá bí mật",
  );
  const backend = read("src/services/backend.ts");
  const extraFirst = backend.indexOf("Constants.expoConfig?.extra");
  const savedFirst = backend.indexOf('getItem("backend-config")');
  assert.ok(
    extraFirst > 0 && extraFirst < savedFirst,
    "bản dựng phải thắng cấu hình cũ trong bộ nhớ máy",
  );
});

test('Bước 2 — nút "↓ mới nhất" theo vị trí cuộn, không treo lơ lửng nữa', () => {
  const chat = read("src/screens/local/ChatLocal.tsx");
  assert.match(chat, /contentOffset, contentSize, layoutMeasurement/);
  assert.match(
    chat,
    /contentSize\.height - \(contentOffset\.y \+ layoutMeasurement\.height\)/,
  );
  assert.match(chat, /setJump\(!shortList && fromBottom > 140\)/);
  assert.equal(
    /messages\.length > 3 \?/.test(chat),
    false,
    "bỏ điều kiện cũ chỉ đếm số tin (làm nút hiện mãi)",
  );
  assert.match(chat, /\{showJump \? \(/, "nút chỉ hiện khi đang cuộn lên");
  assert.match(chat, /onScroll=\{trackScroll\}/);
  assert.match(chat, /scrollToNewest|setJump\(false\)/);
});

test("Bước 2 — bỏ nút Trả lời thừa ngoài bong bóng, chỉ nhấn giữ hoặc vuốt", () => {
  const chat = read("src/screens/local/ChatLocal.tsx");
  assert.equal(
    /hint="trả lời"/.test(chat),
    false,
    "không còn nhãn trả lời trên từng dòng",
  );
  assert.equal(
    /↩ \{hint\}/.test(chat),
    false,
    "không còn vẽ nhãn trả lời ngoài bong bóng",
  );
  assert.match(chat, /<SwipeRow onReply=\{/, "vuốt ngang vẫn trả lời");
  assert.match(
    chat,
    /\["↩ Trả lời", \(\) => onReply\(sheet\)\]/,
    "nhấn giữ vẫn trả lời",
  );
});

test("dữ liệu máy: phòng kiểu ghép nối theo tài khoản giữ mã cố định chữ–số", () => {
  let state = emptyState();
  const room = roomFromPair("khoa-du-dai-cho-thoa-dieu-kien-abc");
  state = reduce(state, {
    type: "relay.set",
    room: { ...room, code: "ABC234", role: "host" },
  });
  assert.equal(state.relay.mode, "pair");
  assert.equal(
    state.relay.code,
    "ABC234",
    "mã cố định dùng chữ nên phải giữ được",
  );
  assert.equal(state.relay.role, "host");
  const again = reduce(emptyState(), {
    type: "relay.set",
    room: { ...room, code: "abc234" },
  });
  assert.equal(again.relay.code, "ABC234", "chuẩn hoá chữ hoa");
});

test("màn hình ghép nối: hết mã 6 số ngẫu nhiên, còn ghép nối theo tài khoản", () => {
  const pair = read("src/screens/local/PairLocal.tsx");
  assert.equal(/makeCode/.test(pair), false, "không còn sinh mã ngẫu nhiên");
  assert.equal(/Tạo mã 6 số/.test(pair), false, "không còn nút tạo mã 6 số");
  assert.equal(
    /roomFromCode|roomToQr|QRCode/.test(pair),
    false,
    "bỏ luồng mã/QR cũ",
  );
  assert.match(pair, /Ghép nối bằng tài khoản/);
  assert.match(pair, /pairCode/, "hiện mã cố định của tài khoản");
});

test("Ngắt kết nối có mặt ở cả màn ghép nối và Cài đặt (cả hai máy)", () => {
  const settings = read("src/screens/local/SettingsLocal.tsx");
  assert.match(settings, /Ngắt kết nối \(cả hai máy\)/);
  assert.match(settings, /onUnpair/);
  assert.match(settings, /Đăng xuất tài khoản ghép nối/);
  assert.match(
    pairGateScreen,
    /Ngắt kết nối \(cả hai máy\)/,
    "màn chặn cũng có nút ngắt kết nối",
  );
});

test("đổi tên / ảnh đại diện được lưu lên Supabase", () => {
  assert.match(app, /saveAccountProfile\(\{ displayName: name \}\)/);
  assert.match(app, /uploadAvatar\(account\.uid, base64\)/);
  const service = read("src/services/account.ts");
  assert.match(service, /from\("avatars"\)/);
  assert.match(service, /avatar\.jpg/);
});

test("sau khi ghép nối, phòng vẫn được ghi vào dữ liệu máy (giữ kết nối khi tắt màn hình)", () => {
  assert.match(app, /type: "relay\.set",/);
  assert.match(app, /pairing\.clear/);
  assert.match(app, /roomFromPair\(fresh\.pairSecret/);
});

test("màn chặn ghép nối vẫn có lối chuyển dữ liệu thủ công", () => {
  assert.match(app, /const \[gateManual, setGateManual\] = useState\(false\)/);
  assert.match(app, /onManual: \(\) => setGateManual\(true\)/);
  assert.match(app, /if \(gateManual && state\)/, "mở được màn chuyển tay");
  assert.match(app, /Quay lại ghép nối theo tài khoản/);
});

test("câu chữ trên giao diện: tóm tắt tài khoản luôn có mã cố định", () => {
  assert.match(
    accountSummary({ uid: "u1", shortCode: "ABC234", partnerId: null }),
    /ABC-234/,
  );
  assert.match(
    accountSummary({
      uid: "u1",
      shortCode: "ABC234",
      partnerId: "u2",
      partnerName: "An",
    }),
    /An/,
  );
});
