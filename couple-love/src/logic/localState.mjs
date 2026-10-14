import { DEFAULT_THEME, isTheme } from "./themes.mjs";
export const STATE_VERSION = 1;
export const makeId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const MOODS = [
  { id: "happy", name: "Vui vẻ", emoji: "😊" },
  { id: "love", name: "Yêu thương", emoji: "🥰" },
  { id: "calm", name: "Bình yên", emoji: "😌" },
  { id: "tired", name: "Mệt", emoji: "😴" },
  { id: "sad", name: "Buồn", emoji: "😔" },
  { id: "angry", name: "Bực mình", emoji: "😤" },
];
const moodIds = MOODS.map((m) => m.id);
/** Tin nhắn: chữ, emoji, tin thoại, hoặc lời nhắn nhanh ("nhớ người thương"). */
export const MESSAGE_KINDS = [
  "text",
  "emoji",
  "voice",
  "nudge",
  "sticker",
  "photo",
  "location",
];
const text = (value, max) =>
  (typeof value === "string" ? value : "").slice(0, max);
const iso = (value, fallback) => {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : fallback;
};
const date = (value) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? value : null;
const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const profile = (raw, id, name, fallback = "") => ({
  id,
  nickname: text(raw?.nickname, 40).trim() || name,
  mood: moodIds.includes(raw?.mood) ? raw.mood : "calm",
  moodNote: text(raw?.moodNote, 300),
  avatar: typeof raw?.avatar === "string" ? raw.avatar : null,
  // Bản app của máy này (ví dụ "1.9.0/10") — để máy kia biết có phải bản cũ
  // không và nhắc cài lại, vì bản cũ không hiểu tin nhắn.
  appVersion: text(raw?.appVersion, 24),
  updatedAt: iso(raw?.updatedAt, fallback),
});
export function emptyState(now = new Date().toISOString()) {
  return {
    version: STATE_VERSION,
    me: {
      id: "me",
      nickname: "Bạn",
      mood: "calm",
      moodNote: "",
      avatar: null,
      updatedAt: now,
    },
    partner: null,
    anniversary: now,
    anniversaryAt: now,
    timezone: "Asia/Ho_Chi_Minh",
    cycle: null,
    diary: [],
    alerts: [],
    settings: {
      biometric: false,
      notify: false,
      relay: true,
      loveNotes: true,
      theme: DEFAULT_THEME,
      wallpaperTint: 0.5,
      // Cho người thương biết mình đã xem tin chưa (tắt được).
      readReceipts: true,
      // Tự gửi lời yêu/thơ mỗi 2 tiếng trong khung 07:00–22:00.
      autoLove: true,
      // Nhắc khi mình chưa trả lời người thương (3 phút, 1 tiếng).
      replyNudge: true,
    },
    autoLoveAt: 0,
    relay: null,
    links: [],
    messages: [],
    moments: [],
    // Giao diện dùng chung cho cả hai máy: ai đổi sau thì cả hai cùng đổi,
    // ảnh nền cũng đi theo (ảnh gửi qua kênh kết nối như ảnh khoảnh khắc).
    appearance: {
      theme: DEFAULT_THEME,
      wallpaper: null,
      wallpaperId: null,
      updatedAt: now,
      by: "me",
    },
  };
}
export const wallpaperFile = (id) =>
  typeof id === "string" && id ? `wallpaper-${id}.jpg` : null;
export function migrate(raw, now = new Date().toISOString()) {
  const state = emptyState(now);
  if (!raw || typeof raw !== "object") return state;
  state.me = profile(raw.me, "me", "Bạn", now);
  state.partner = raw.partner
    ? profile(raw.partner, "partner", "Người thương", now)
    : null;
  state.anniversary = iso(raw.anniversary, now);
  state.anniversaryAt = iso(raw.anniversaryAt, state.anniversary);
  state.timezone = text(raw.timezone, 40) || state.timezone;
  const cycle = raw.cycle;
  if (cycle && date(cycle.lastPeriod)) {
    state.cycle = {
      lastPeriod: cycle.lastPeriod,
      cycleLength: Math.min(60, Math.max(14, Number(cycle.cycleLength) || 28)),
      periodLength: Math.min(10, Math.max(1, Number(cycle.periodLength) || 5)),
      reminders: cycle.reminders !== false,
      updatedAt: iso(cycle.updatedAt, now),
    };
  }
  const diary = Array.isArray(raw.diary) ? raw.diary : [];
  state.diary = diary
    .filter((e) => e && typeof e === "object" && text(e.title, 100).trim())
    .slice(0, 500)
    .map((e) => ({
      id: text(e.id, 40) || uid(),
      authorId: e.authorId === "partner" ? "partner" : "me",
      title: text(e.title, 100).trim(),
      body: text(e.body, 6000),
      image: typeof e.image === "string" ? e.image : null,
      createdAt: iso(e.createdAt, now),
      updatedAt: iso(e.updatedAt, now),
    }));
  const alerts = Array.isArray(raw.alerts) ? raw.alerts : [];
  state.alerts = alerts
    .filter((a) => a && typeof a === "object" && text(a.title, 120).trim())
    .slice(0, 200)
    .map((a) => ({
      id: text(a.id, 40) || uid(),
      title: text(a.title, 120).trim(),
      body: text(a.body, 600),
      key: text(a.key, 80) || null,
      category: ["cycle", "mood", "anniversary", "love"].includes(a.category)
        ? a.category
        : "love",
      createdAt: iso(a.createdAt, now),
      readAt: a.readAt ? iso(a.readAt, now) : null,
    }));
  const rawAppearance =
    raw.appearance && typeof raw.appearance === "object" ? raw.appearance : {};
  const fallbackTheme = isTheme(raw.settings?.theme)
    ? raw.settings.theme
    : DEFAULT_THEME;
  const wallpaperId = text(rawAppearance.wallpaperId, 60);
  state.appearance = {
    theme: isTheme(rawAppearance.theme) ? rawAppearance.theme : fallbackTheme,
    wallpaper: wallpaperId
      ? text(rawAppearance.wallpaper, 90) || wallpaperFile(wallpaperId)
      : null,
    wallpaperId: wallpaperId || null,
    updatedAt: iso(rawAppearance.updatedAt, now),
    by: rawAppearance.by === "partner" ? "partner" : "me",
  };
  state.settings = {
    biometric: raw.settings?.biometric === true,
    notify: raw.settings?.notify === true,
    relay: raw.settings?.relay !== false,
    loveNotes: raw.settings?.loveNotes !== false,
    theme: state.appearance.theme,
    wallpaperTint: Math.min(
      0.75,
      Math.max(0.3, Number(raw.settings?.wallpaperTint) || 0.5),
    ),
    readReceipts: raw.settings?.readReceipts !== false,
    autoLove: raw.settings?.autoLove !== false,
    replyNudge: raw.settings?.replyNudge !== false,
  };
  state.autoLoveAt = Math.max(0, Number(raw.autoLoveAt) || 0);
  const messages = Array.isArray(raw.messages) ? raw.messages : [];
  state.messages = messages
    .filter((message) => message && typeof message === "object")
    .map((message) => ({
      id: text(message.id, 40) || uid(),
      authorId: message.authorId === "partner" ? "partner" : "me",
      kind: MESSAGE_KINDS.includes(message.kind) ? message.kind : "text",
      body: text(message.body, 600),
      audio:
        typeof message.audio === "string" && message.audio
          ? text(message.audio, 90)
          : null,
      durationMs: Math.min(
        120000,
        Math.max(0, Number(message.durationMs) || 0),
      ),
      photo:
        typeof message.photo === "string" && message.photo
          ? text(message.photo, 90)
          : null,
      lat: Number.isFinite(Number(message.lat)) ? Number(message.lat) : null,
      lng: Number.isFinite(Number(message.lng)) ? Number(message.lng) : null,
      place: text(message.place, 120),
      createdAt: iso(message.createdAt, now),
      sentAt: message.sentAt ? iso(message.sentAt, now) : null,
      deliveredAt: message.deliveredAt ? iso(message.deliveredAt, now) : null,
      receivedAt: message.receivedAt ? iso(message.receivedAt, now) : null,
      readAt: message.readAt ? iso(message.readAt, now) : null,
    }))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 300);
  state.moments = Array.isArray(raw.moments)
    ? raw.moments
        .filter((moment) => moment && typeof moment === "object")
        .map((moment) => ({
          id: text(moment.id, 40) || uid(),
          authorId: moment.authorId === "partner" ? "partner" : "me",
          caption: text(moment.caption, 120),
          file:
            typeof moment.file === "string" && moment.file
              ? text(moment.file, 90)
              : null,
          createdAt: iso(moment.createdAt, now),
          sentAt: moment.sentAt ? iso(moment.sentAt, now) : null,
          receivedAt: moment.receivedAt ? iso(moment.receivedAt, now) : null,
        }))
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .slice(0, 200)
    : [];
  const relay = raw.relay;
  state.relay =
    relay &&
    typeof relay === "object" &&
    text(relay.id, 60) &&
    text(relay.key, 90)
      ? {
          id: text(relay.id, 60),
          key: text(relay.key, 90),
          mode: relay.mode === "code" ? "code" : "qr",
          code: /^\d{6}$/.test(String(relay.code ?? ""))
            ? String(relay.code)
            : null,
          role: relay.role === "guest" ? "guest" : "host",
        }
      : null;
  state.links = Array.isArray(raw.links)
    ? raw.links
        .filter((l) => l && typeof l === "object")
        .slice(0, 20)
        .map((l) => ({
          id: text(l.id, 80) || "partner",
          name: text(l.name, 40).trim() || "Người thương",
          linkedAt: iso(l.linkedAt, now),
        }))
    : [];
  return state;
}
export function reduce(state, action) {
  const type = action?.type;
  if (typeof type !== "string") throw new Error("Thao tác không hợp lệ.");
  const next = JSON.parse(JSON.stringify(state));
  if (type === "profile.set") {
    const nickname = text(action.nickname, 40).trim();
    if (!nickname) throw new Error("Tên gọi cần từ 1 đến 40 ký tự.");
    if (!moodIds.includes(action.mood))
      throw new Error("Cảm xúc không hợp lệ.");
    next.me = {
      ...next.me,
      nickname,
      mood: action.mood,
      moodNote: text(action.moodNote, 300),
      updatedAt: new Date().toISOString(),
    };
  } else if (type === "profile.avatar") {
    next.me = {
      ...next.me,
      avatar: action.file || null,
      updatedAt: new Date().toISOString(),
    };
  } else if (type === "anniversary.set") {
    const at = Date.parse(action.iso);
    if (
      !Number.isFinite(at) ||
      at > Date.now() + 60000 ||
      at < Date.parse("1900-01-01")
    )
      throw new Error("Ngày kỷ niệm không hợp lệ.");
    next.anniversary = new Date(at).toISOString();
    next.anniversaryAt = new Date().toISOString();
  } else if (type === "cycle.save") {
    const lastPeriod = date(action.lastPeriod);
    if (!lastPeriod) throw new Error("Ngày đầu kỳ không hợp lệ.");
    if (lastPeriod > new Date().toISOString().slice(0, 10))
      throw new Error("Ngày đầu kỳ không được ở tương lai.");
    const cycleLength = Number(action.cycleLength),
      periodLength = Number(action.periodLength);
    if (!Number.isInteger(cycleLength) || cycleLength < 14 || cycleLength > 60)
      throw new Error("Vòng kinh 14–60 ngày.");
    if (
      !Number.isInteger(periodLength) ||
      periodLength < 1 ||
      periodLength > 10
    )
      throw new Error("Kỳ kinh 1–10 ngày.");
    next.cycle = {
      lastPeriod,
      cycleLength,
      periodLength,
      reminders: action.reminders !== false,
      updatedAt: new Date().toISOString(),
    };
  } else if (type === "cycle.clear") {
    next.cycle = null;
  } else if (type === "diary.add") {
    const title = text(action.title, 100).trim();
    if (!title) throw new Error("Cần đặt tên cho kỷ niệm (1–100 ký tự).");
    if (text(action.body, 6000).length < (action.body || "").length)
      throw new Error("Ghi chú tối đa 6.000 ký tự.");
    next.diary.unshift({
      id: text(action.id, 40) || uid(),
      authorId: "me",
      title,
      body: text(action.body, 6000),
      image: typeof action.image === "string" ? action.image : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    next.diary = next.diary.slice(0, 500);
  } else if (type === "diary.update") {
    const index = next.diary.findIndex(
      (e) => e.id === action.id && e.authorId === "me",
    );
    if (index < 0) throw new Error("Chỉ sửa được kỷ niệm do bạn viết.");
    const title = text(action.title, 100).trim();
    if (!title) throw new Error("Cần đặt tên cho kỷ niệm (1–100 ký tự).");
    next.diary[index] = {
      ...next.diary[index],
      title,
      body: text(action.body, 6000),
      image:
        typeof action.image === "string"
          ? action.image
          : next.diary[index].image,
      updatedAt: new Date().toISOString(),
    };
  } else if (type === "diary.remove") {
    const target = next.diary.find(
      (e) => e.id === action.id && e.authorId === "me",
    );
    if (!target) throw new Error("Chỉ xóa được kỷ niệm do bạn viết.");
    next.diary = next.diary.filter((e) => e.id !== action.id);
  } else if (type === "alerts.add") {
    const title = text(action.title, 120).trim();
    if (!title) throw new Error("Lời nhắc cần có tiêu đề.");
    const key = text(action.key, 80);
    if (key && next.alerts.some((a) => a.key === key)) return next;
    next.alerts.unshift({
      id: uid(),
      key: key || null,
      title,
      body: text(action.body, 600),
      category: ["cycle", "mood", "anniversary", "love"].includes(
        action.category,
      )
        ? action.category
        : "love",
      createdAt: new Date().toISOString(),
      readAt: null,
    });
    next.alerts = next.alerts.slice(0, 200);
  } else if (type === "alerts.read") {
    next.alerts = next.alerts.map((a) =>
      a.id === action.id ? { ...a, readAt: new Date().toISOString() } : a,
    );
  } else if (type === "alerts.clear") {
    next.alerts = [];
  } else if (type === "relay.set") {
    if (!action.room) next.relay = null;
    else {
      const id = text(action.room.id, 60);
      const key = text(action.room.key, 90);
      if (!id || !key) throw new Error("Phòng kết nối không hợp lệ.");
      next.relay = {
        id,
        key,
        mode: action.room.mode === "code" ? "code" : "qr",
        code: /^\d{6}$/.test(String(action.room.code ?? ""))
          ? String(action.room.code)
          : null,
        role: action.room.role === "guest" ? "guest" : "host",
      };
    }
  } else if (type === "moment.add") {
    const file = typeof action.file === "string" ? text(action.file, 90) : "";
    if (!file) throw new Error("Khoảnh khắc cần có ảnh.");
    next.moments = [
      {
        id: text(action.id, 40) || uid(),
        authorId: "me",
        caption: text(action.caption, 120),
        file,
        createdAt: new Date().toISOString(),
        sentAt: null,
        receivedAt: null,
      },
      ...next.moments,
    ].slice(0, 200);
  } else if (type === "moment.received") {
    const id = text(action.id, 40);
    if (!id) throw new Error("Khoảnh khắc nhận được thiếu mã.");
    const file = typeof action.file === "string" ? text(action.file, 90) : "";
    const current = next.moments.find((moment) => moment.id === id);
    if (current) {
      next.moments = next.moments.map((moment) =>
        moment.id === id
          ? {
              ...moment,
              file: file || moment.file,
              caption: moment.caption || text(action.caption, 120),
              receivedAt: new Date().toISOString(),
            }
          : moment,
      );
    } else {
      next.moments = [
        {
          id,
          authorId: action.authorId === "me" ? "me" : "partner",
          caption: text(action.caption, 120),
          file: file || null,
          createdAt: iso(action.createdAt, new Date().toISOString()),
          sentAt: null,
          receivedAt: new Date().toISOString(),
        },
        ...next.moments,
      ]
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .slice(0, 200);
    }
  } else if (type === "moment.file") {
    const id = text(action.id, 40);
    const file = typeof action.file === "string" ? text(action.file, 90) : "";
    if (!id || !file) throw new Error("Khoảnh khắc nhận được thiếu ảnh.");
    next.moments = next.moments.map((moment) =>
      moment.id === id
        ? { ...moment, file, receivedAt: new Date().toISOString() }
        : moment,
    );
  } else if (type === "moment.sent") {
    const id = text(action.id, 40);
    next.moments = next.moments.map((moment) =>
      moment.id === id
        ? { ...moment, sentAt: new Date().toISOString() }
        : moment,
    );
  } else if (type === "moment.remove") {
    next.moments = next.moments.filter(
      (moment) => moment.id !== text(action.id, 40),
    );
  } else if (type === "message.add") {
    const kind = MESSAGE_KINDS.includes(action.kind) ? action.kind : "text";
    const body = text(action.body, 600).trim();
    const audio =
      typeof action.audio === "string" && action.audio
        ? text(action.audio, 90)
        : null;
    const photo =
      typeof action.photo === "string" && action.photo
        ? text(action.photo, 90)
        : null;
    if (kind === "voice" && !audio) throw new Error("Tin thoại chưa ghi xong.");
    if (kind === "photo" && !photo) throw new Error("Ảnh chưa lưu xong.");
    if (kind !== "voice" && kind !== "photo" && !body)
      throw new Error("Tin nhắn còn trống.");
    if (kind === "location" && body === "") throw new Error("Chưa có vị trí.");
    next.messages = [
      {
        id: text(action.id, 40) || uid(),
        authorId: "me",
        kind,
        body,
        audio,
        photo,
        lat: Number.isFinite(Number(action.lat)) ? Number(action.lat) : null,
        lng: Number.isFinite(Number(action.lng)) ? Number(action.lng) : null,
        place: text(action.place, 120),
        durationMs: Math.min(
          120000,
          Math.max(0, Number(action.durationMs) || 0),
        ),
        createdAt: new Date().toISOString(),
        sentAt: null,
        deliveredAt: null,
        receivedAt: null,
        readAt: null,
      },
      ...next.messages,
    ].slice(0, 300);
  } else if (type === "message.received") {
    const id = text(action.id, 40);
    if (!id) throw new Error("Tin nhắn nhận được thiếu mã.");
    const kind = MESSAGE_KINDS.includes(action.kind) ? action.kind : "text";
    const current = next.messages.find((message) => message.id === id);
    if (current) {
      next.messages = next.messages.map((message) =>
        message.id === id
          ? {
              ...message,
              body: message.body || text(action.body, 600),
              audio:
                typeof action.audio === "string" && action.audio
                  ? text(action.audio, 90)
                  : message.audio,
              receivedAt: new Date().toISOString(),
            }
          : message,
      );
    } else {
      next.messages = [
        {
          id,
          authorId: "partner",
          kind,
          body: text(action.body, 600),
          audio:
            typeof action.audio === "string" && action.audio
              ? text(action.audio, 90)
              : null,
          photo: null,
          lat: Number.isFinite(Number(action.lat)) ? Number(action.lat) : null,
          lng: Number.isFinite(Number(action.lng)) ? Number(action.lng) : null,
          place: text(action.place, 120),
          durationMs: Math.min(
            120000,
            Math.max(0, Number(action.durationMs) || 0),
          ),
          createdAt: iso(action.createdAt, new Date().toISOString()),
          sentAt: null,
          deliveredAt: null,
          receivedAt: new Date().toISOString(),
          readAt: null,
        },
        ...next.messages,
      ]
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .slice(0, 300);
    }
  } else if (type === "message.audio") {
    const id = text(action.id, 40);
    const audio = text(action.file, 90);
    if (!id || !audio) throw new Error("Tin thoại nhận được thiếu tệp.");
    next.messages = next.messages.map((message) =>
      message.id === id ? { ...message, audio } : message,
    );
  } else if (type === "message.photo") {
    // Ảnh trong đoạn chat: tệp đến sau phần mô tả (cắt thành nhiều gói).
    const id = text(action.id, 40);
    const file = text(action.file, 90);
    if (!id || !file) throw new Error("Ảnh nhận được thiếu tệp.");
    const known = next.messages.some((message) => message.id === id);
    next.messages = known
      ? next.messages.map((message) =>
          message.id === id ? { ...message, photo: file } : message,
        )
      : [
          // Ảnh có thể tới trước phần mô tả tin: vẫn tạo tin để không mất ảnh.
          {
            id,
            authorId: "partner",
            kind: "photo",
            body: "",
            audio: null,
            photo: file,
            lat: null,
            lng: null,
            place: "",
            durationMs: 0,
            createdAt: new Date().toISOString(),
            sentAt: null,
            deliveredAt: null,
            receivedAt: new Date().toISOString(),
            readAt: null,
          },
          ...next.messages,
        ].slice(0, 300);
  } else if (type === "message.sent") {
    const id = text(action.id, 40);
    next.messages = next.messages.map((message) =>
      message.id === id
        ? { ...message, sentAt: new Date().toISOString() }
        : message,
    );
  } else if (type === "message.delivered") {
    // Máy người thương vừa xác nhận đã nhận: tin hiện "đã tới máy kia".
    const ids = Array.isArray(action.ids)
      ? action.ids.map((id) => text(id, 40)).filter(Boolean)
      : [];
    if (!ids.length) return next;
    const at = new Date().toISOString();
    next.messages = next.messages.map((message) =>
      message.authorId === "me" &&
      ids.includes(message.id) &&
      !message.deliveredAt
        ? { ...message, deliveredAt: at }
        : message,
    );
  } else if (type === "message.seen") {
    // Người thương báo đã xem: tin của mình hiện "đã xem".
    const ids = Array.isArray(action.ids)
      ? action.ids
          .map((value) => text(value, 40))
          .filter(Boolean)
          .slice(0, 20)
      : [];
    if (!ids.length) return next;
    const at = new Date().toISOString();
    next.messages = next.messages.map((message) =>
      message.authorId === "me" && ids.includes(message.id) && !message.readAt
        ? { ...message, readAt: at }
        : message,
    );
  } else if (type === "message.read") {
    const at = new Date().toISOString();
    next.messages = next.messages.map((message) =>
      message.authorId === "partner" && !message.readAt
        ? { ...message, readAt: at }
        : message,
    );
  } else if (type === "message.remove") {
    next.messages = next.messages.filter(
      (message) => message.id !== text(action.id, 40),
    );
  } else if (type === "settings.set") {
    next.settings = {
      ...next.settings,
      notify: action.notify === true,
      relay: action.relay !== false,
      loveNotes:
        action.loveNotes === undefined
          ? next.settings.loveNotes
          : action.loveNotes === true,
      theme: isTheme(action.theme) ? action.theme : next.settings.theme,
      wallpaperTint:
        action.wallpaperTint === undefined
          ? next.settings.wallpaperTint
          : Math.min(0.75, Math.max(0.3, Number(action.wallpaperTint) || 0.5)),
      readReceipts:
        action.readReceipts === undefined
          ? next.settings.readReceipts !== false
          : action.readReceipts !== false,
      autoLove:
        action.autoLove === undefined
          ? next.settings.autoLove !== false
          : action.autoLove !== false,
      replyNudge:
        action.replyNudge === undefined
          ? next.settings.replyNudge !== false
          : action.replyNudge !== false,
    };
    if (isTheme(action.theme) && action.theme !== next.appearance.theme) {
      next.appearance = {
        ...next.appearance,
        theme: action.theme,
        updatedAt: new Date().toISOString(),
        by: "me",
      };
    }
  } else if (type === "appearance.set") {
    // Đổi chủ đề hoặc đặt ảnh nền mới: ghi mốc thời gian để máy kia biết bản nào mới hơn.
    const wallpaperId =
      action.wallpaperId === null
        ? null
        : text(action.wallpaperId, 60) || next.appearance.wallpaperId;
    next.appearance = {
      theme: isTheme(action.theme) ? action.theme : next.appearance.theme,
      wallpaper: wallpaperId
        ? text(action.wallpaper, 90) || wallpaperFile(wallpaperId)
        : null,
      wallpaperId: wallpaperId || null,
      updatedAt: new Date().toISOString(),
      by: "me",
    };
    next.settings = { ...next.settings, theme: next.appearance.theme };
  } else if (type === "appearance.wallpaper") {
    // Ảnh nền vừa nhận xong từ máy kia: gắn tệp vào đúng bản giao diện đang dùng.
    const id = text(action.id, 60);
    const file = text(action.file, 90);
    if (!id || !file) throw new Error("Ảnh nền nhận được thiếu tệp.");
    if (next.appearance.wallpaperId === id || !next.appearance.wallpaperId)
      next.appearance = {
        ...next.appearance,
        wallpaperId: id,
        wallpaper: file,
      };
  } else if (type === "partner.merge") {
    const raw =
      action.state && typeof action.state === "object" ? action.state : {};
    const incoming = migrate({ ...raw, me: raw.from || raw.me });
    const incomingId =
      text(raw.from?.id || raw.me?.id, 80) || incoming.me.nickname;
    next.diary = mergeDiary(next.diary, incoming.diary);
    if (incoming.me?.nickname) next.partner = { ...incoming.me, id: "partner" };
    next.alerts = mergeAlerts(next.alerts, incoming.alerts);
    next.moments = mergeMoments(next.moments, incoming.moments);
    next.messages = mergeMessages(next.messages, incoming.messages);
    if (
      incoming.cycle &&
      (!next.cycle ||
        Date.parse(incoming.cycle.updatedAt) >=
          Date.parse(next.cycle.updatedAt))
    ) {
      next.cycle = incoming.cycle;
    }
    if (
      incoming.anniversary &&
      Date.parse(incoming.anniversaryAt) >= Date.parse(next.anniversaryAt)
    ) {
      next.anniversary = incoming.anniversary;
      next.anniversaryAt = incoming.anniversaryAt;
    }
    if (
      incoming.appearance &&
      Date.parse(incoming.appearance.updatedAt) >
        Date.parse(next.appearance.updatedAt)
    ) {
      // Người thương đổi giao diện sau mình: cả hai máy dùng chung một giao diện.
      const keepFile =
        incoming.appearance.wallpaperId &&
        incoming.appearance.wallpaperId === next.appearance.wallpaperId
          ? next.appearance.wallpaper
          : null;
      next.appearance = {
        theme: incoming.appearance.theme,
        wallpaperId: incoming.appearance.wallpaperId,
        wallpaper:
          keepFile ||
          (incoming.appearance.wallpaperId
            ? wallpaperFile(incoming.appearance.wallpaperId)
            : null),
        updatedAt: incoming.appearance.updatedAt,
        by: "partner",
      };
      next.settings = { ...next.settings, theme: next.appearance.theme };
    }
    next.links = [
      ...next.links.filter((link) => link.id !== incomingId),
      {
        id: incomingId,
        name: incoming.me.nickname,
        linkedAt: new Date().toISOString(),
      },
    ].slice(-20);
  } else if (type === "partner.unlink") {
    next.moments = next.moments.filter(
      (moment) => moment.authorId !== "partner",
    );
    next.messages = next.messages.filter(
      (message) => message.authorId !== "partner",
    );
    next.partner = null;
  } else if (type === "autoLove.sent") {
    next.autoLoveAt = Math.max(0, Number(action.at) || Date.now());
  } else if (type === "state.replace") {
    return migrate(action.state);
  } else {
    throw new Error("Thao tác không được hỗ trợ.");
  }
  return next;
}
const fnv = (input) => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
};
export function base64Encode(input) {
  const bytes = [];
  for (const character of String(input)) {
    const code = character.codePointAt(0);
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 63));
    else if (code < 0x10000)
      bytes.push(
        0xe0 | (code >> 12),
        0x80 | ((code >> 6) & 63),
        0x80 | (code & 63),
      );
    else
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 63),
        0x80 | ((code >> 6) & 63),
        0x80 | (code & 63),
      );
  }
  if (typeof globalThis.Buffer !== "undefined")
    return globalThis.Buffer.from(bytes).toString("base64");
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return globalThis.btoa(binary);
}
export function base64Decode(input) {
  const binary =
    typeof globalThis.Buffer !== "undefined"
      ? globalThis.Buffer.from(String(input), "base64").toString("binary")
      : globalThis.atob(String(input));
  const bytes = [];
  for (let index = 0; index < binary.length; index++)
    bytes.push(binary.charCodeAt(index));
  let text = "";
  for (let index = 0; index < bytes.length;) {
    const first = bytes[index];
    let code;
    if (first < 0x80) {
      code = first;
      index += 1;
    } else if (first < 0xe0) {
      code = ((first & 31) << 6) | (bytes[index + 1] & 63);
      index += 2;
    } else if (first < 0xf0) {
      code =
        ((first & 15) << 12) |
        ((bytes[index + 1] & 63) << 6) |
        (bytes[index + 2] & 63);
      index += 3;
    } else {
      code =
        ((first & 7) << 18) |
        ((bytes[index + 1] & 63) << 12) |
        ((bytes[index + 2] & 63) << 6) |
        (bytes[index + 3] & 63);
      index += 4;
    }
    text += String.fromCodePoint(code);
  }
  return text;
}
export function splitCode(code, size = 900) {
  const body = String(code).slice(5);
  if (body.length <= size) return [String(code)];
  const chunks = [];
  for (let index = 0; index < body.length; index += size)
    chunks.push(body.slice(index, index + size));
  return chunks.map(
    (chunk, index) => `HTT1:${index + 1}/${chunks.length}:${chunk}`,
  );
}
export function joinCodes(codes) {
  const parts = codes.map((code) => String(code).trim()).filter(Boolean);
  if (parts.length === 0) throw new Error("Chưa có mã nào để ghép.");
  if (parts.length === 1) {
    const single = parts[0];
    if (!single.startsWith("HTT1:"))
      throw new Error("Mã không đúng định dạng Hai Trái Tim.");
    const singleMatch = /^HTT1:(\d+)\/(\d+):/.exec(single);
    if (singleMatch && Number(singleMatch[2]) > 1)
      throw new Error(`Cần đủ ${singleMatch[2]} đoạn mã, hiện có 1.`);
    return single;
  }
  const ordered = [];
  let total = 0;
  for (const part of parts) {
    const match = /^HTT1:(\d+)\/(\d+):([\s\S]+)$/.exec(part);
    if (!match)
      throw new Error(`Đoạn mã thứ ${ordered.length + 1} không hợp lệ.`);
    total = Math.max(total, Number(match[2]));
    ordered[Number(match[1]) - 1] = match[3];
  }
  if (ordered.length !== total || ordered.some((part) => !part))
    throw new Error(`Cần đủ ${total} đoạn mã, hiện có ${parts.length}.`);
  return "HTT1:" + ordered.join("");
}
export function encodeLink(state, kind = "link", images = {}) {
  const body = {
    v: STATE_VERSION,
    kind,
    from: {
      id: "me",
      nickname: state.me.nickname,
      mood: state.me.mood,
      moodNote: state.me.moodNote,
      updatedAt: state.me.updatedAt,
    },
    anniversary: state.anniversary,
    anniversaryAt: state.anniversaryAt,
    cycle: state.cycle,
    diary: kind === "full" ? state.diary : [],
    avatar: state.me.avatar,
    images: kind === "full" ? images : {},
  };
  const payload = JSON.stringify(body);
  return `HTT1:${base64Encode(JSON.stringify({ data: payload, crc: fnv(payload) }))}`;
}
export function decodeLink(code) {
  const trimmed = String(code || "").trim();
  if (!trimmed.startsWith("HTT1:"))
    throw new Error("Mã không đúng định dạng Hai Trái Tim.");
  const envelope = JSON.parse(base64Decode(trimmed.slice(5)));
  if (typeof envelope?.data !== "string")
    throw new Error("Mã bị thiếu dữ liệu.");
  if (envelope.crc !== fnv(envelope.data))
    throw new Error("Mã có thể bị hỏng khi sao chép. Hãy quét lại.");
  const payload = JSON.parse(envelope.data);
  if (payload?.v !== STATE_VERSION)
    throw new Error("Mã được tạo bởi phiên bản ứng dụng khác.");
  if (!payload.from?.nickname)
    throw new Error("Mã thiếu thông tin người thương.");
  payload.images =
    payload.images && typeof payload.images === "object" ? payload.images : {};
  return payload;
}

export function restoreFromPayload(payload) {
  const state = emptyState();
  state.me = profile(
    { ...payload?.from, avatar: payload?.from?.avatar },
    "me",
    "Bạn",
  );
  state.anniversary = iso(payload?.anniversary, state.anniversary);
  const cycle = migrate({ cycle: payload?.cycle }).cycle;
  state.cycle = cycle || null;
  state.diary = migrate({ diary: payload?.diary }).diary;
  return state;
}
export function cycleEvents(cycle, today) {
  if (!cycle?.reminders) return [];
  const age = Math.floor(
    (Date.parse(`${today}T00:00:00Z`) -
      Date.parse(`${cycle.lastPeriod}T00:00:00Z`)) /
      86400000,
  );
  if (
    !Number.isFinite(age) ||
    age < 0 ||
    age > Math.min(90, cycle.cycleLength * 3)
  )
    return [];
  const base = Math.floor(age / cycle.cycleLength);
  const events = [];
  for (let index = Math.max(1, base - 1); index <= base + 2; index++) {
    const period = addDaysSafe(cycle.lastPeriod, index * cycle.cycleLength);
    events.push({
      key: `cycle:period_soon:${period}`,
      day: addDaysSafe(period, -3),
      category: "cycle",
      title: "Một lời nhắc chăm sóc",
      body: "Theo lịch ước tính, kỳ kinh có thể đến trong 3 ngày. Hỏi người thương cần gì và chuẩn bị thời gian nghỉ.",
    });
    events.push({
      key: `cycle:period:${period}`,
      day: period,
      category: "cycle",
      title: "Mốc đầu kỳ theo lịch ước tính",
      body: "Đây là dự báo theo lịch, có thể lệch. Hãy hỏi người thương thay vì tự quyết định giúp.",
    });
    events.push({
      key: `cycle:ovulation:${period}`,
      day: addDaysSafe(period, -14),
      category: "cycle",
      title: "Mốc rụng trứng ước tính",
      body: "Dự báo theo lịch có sai số, không dùng để tránh thai. Hôm nay có thể hỏi người thương cảm thấy thế nào.",
    });
  }
  return events;
}
export function anniversaryEvents(state, today, years = 2) {
  const start = new Date(state.anniversary);
  if (!Number.isFinite(start.getTime())) return [];
  const current = new Date(`${today}T00:00:00Z`).getUTCFullYear();
  const events = [];
  for (let offset = 0; offset <= years; offset++) {
    const day = `${current + offset}-${String(start.getUTCMonth() + 1).padStart(2, "0")}-${String(start.getUTCDate()).padStart(2, "0")}`;
    events.push({
      key: `anniversary:${day}`,
      day,
      category: "anniversary",
      title: "Một ngày của hai chúng mình",
      body: "Hôm nay là ngày kỷ niệm. Dành chút thời gian cho nhau và lưu lại một khoảnh khắc nhé.",
    });
  }
  return events;
}
export function dueAlerts(state, today) {
  return [
    ...cycleEvents(state.cycle, today),
    ...anniversaryEvents(state, today),
  ].filter((event) => event.day === today);
}
function addDaysSafe(value, days) {
  return new Date(Date.parse(`${value}T00:00:00Z`) + days * 86400000)
    .toISOString()
    .slice(0, 10);
}
function cycleForecastSafe(lastPeriod, cycleLength, periodLength, today) {
  const age = Math.floor(
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${lastPeriod}T00:00:00Z`)) /
      86400000,
  );
  if (!Number.isFinite(age) || age < 0) throw new Error("Chu kỳ chưa hợp lệ.");
  const nextPeriod = addDaysSafe(
    lastPeriod,
    (Math.floor(age / cycleLength) + 1) * cycleLength,
  );
  return { nextPeriod };
}

function mergeDiary(local, remote) {
  const mine = new Map(local.map((entry) => [entry.id, entry]));
  const merged = [...local];
  for (const entry of remote) {
    const incoming = {
      ...entry,
      authorId: entry.authorId === "me" ? "partner" : "me",
    };
    const current = mine.get(incoming.id);
    if (!current) {
      merged.push(incoming);
      continue;
    }
    if (Date.parse(incoming.updatedAt) >= Date.parse(current.updatedAt)) {
      const index = merged.findIndex((item) => item.id === current.id);
      merged[index] = { ...incoming, authorId: current.authorId };
    }
  }
  return merged
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 500);
}
function mergeAlerts(local, remote) {
  const merged = [...local];
  const seen = new Set(local.map((alert) => alert.key || alert.id));
  for (const alert of remote) {
    const mark = alert.key || alert.id;
    if (seen.has(mark)) {
      const index = merged.findIndex((item) => (item.key || item.id) === mark);
      if (index >= 0 && alert.readAt && !merged[index].readAt) {
        merged[index] = { ...merged[index], readAt: alert.readAt };
      }
      continue;
    }
    seen.add(mark);
    merged.push(alert);
  }
  return merged
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 200);
}
function mergeMessages(local, remote) {
  const mine = new Map(local.map((message) => [message.id, message]));
  let merged = [...local];
  for (const message of Array.isArray(remote) ? remote : []) {
    const id = text(message?.id, 40);
    if (!id) continue;
    // Tin của máy kia đi sang đây thành tin của "người thương"; tin của mình
    // quay lại thì giữ nguyên bản trên máy này (không nhân đôi, không mất thoại).
    if (message.authorId === "me") {
      const mirror = mine.get(id);
      if (mirror) continue;
    }
    const incoming = {
      id,
      authorId: message.authorId === "me" ? "partner" : "me",
      kind: MESSAGE_KINDS.includes(message.kind) ? message.kind : "text",
      body: text(message.body, 600),
      audio:
        typeof message.audio === "string" && message.audio
          ? text(message.audio, 90)
          : null,
      durationMs: Math.min(
        120000,
        Math.max(0, Number(message.durationMs) || 0),
      ),
      createdAt: iso(message.createdAt, new Date().toISOString()),
      sentAt: null,
      receivedAt: message.receivedAt
        ? iso(message.receivedAt, new Date().toISOString())
        : new Date().toISOString(),
      readAt: null,
    };
    const existing = mine.get(incoming.id);
    if (existing) {
      merged = merged.map((item) =>
        item.id === incoming.id
          ? {
              ...item,
              body: item.body || incoming.body,
              audio: item.audio || incoming.audio,
              durationMs: item.durationMs || incoming.durationMs,
            }
          : item,
      );
      continue;
    }
    merged.push(incoming);
  }
  return merged
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 300);
}
function mergeMoments(local, remote) {
  const mine = new Map(local.map((moment) => [moment.id, moment]));
  let merged = [...local];
  for (const moment of Array.isArray(remote) ? remote : []) {
    const id = text(moment?.id, 40);
    if (!id) continue;
    const existing = mine.get(id);
    if (existing) {
      // Đã có: giữ ảnh đang có trên máy này, chỉ bổ sung phần còn thiếu.
      merged = merged.map((item) =>
        item.id === id
          ? {
              ...item,
              file: item.file ?? moment.file ?? null,
              caption: item.caption || text(moment.caption, 120),
              receivedAt: item.receivedAt ?? new Date().toISOString(),
            }
          : item,
      );
      continue;
    }
    merged.push({
      id,
      authorId: "partner",
      caption: text(moment.caption, 120),
      file: null,
      createdAt: iso(moment.createdAt, new Date().toISOString()),
      sentAt: null,
      receivedAt: new Date().toISOString(),
    });
  }
  return merged
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 200);
}
export function mergeState(local, remote) {
  return reduce(local, { type: "partner.merge", state: remote });
}
