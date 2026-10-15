// Logic thuần cho tính năng "Nuôi Thú Cưng Ảo (Couple Pet)" phong cách Widgetable.
// Không phụ thuộc React Native nên kiểm thử trực tiếp bằng Node.

export const PET_MAX_ENERGY = 5;
/** Giới hạn tương tác: mỗi người dùng tối đa 100 Exp mỗi ngày. */
export const PET_DAILY_EXP_GOAL = 100;
/** Mốc Exp cơ sở cho Level 1 (0/1000); mỗi cấp tăng thêm +1000 (Lv.1: 1000, Lv.2: 2000...). */
export const PET_BASE_LEVEL_EXP = 1000;
/** Chu kỳ giảm chỉ số sinh học (Đói, Dơ, Yêu thương): 15 phút một lần nếu không chăm sóc. */
export const PET_DECAY_INTERVAL_MS = 15 * 60 * 1000;

/** Điểm cộng dồn chuẩn theo từng loại tương tác. */
export const PET_EXP_REWARDS = {
  room: 5,
  feed: 5,
  bath: 5,
  sleep: 5,
  poke: 5,
  gift: 5,
  chat: 10,
  call: 25,
};

/**
 * Danh sách câu thả thính & nhắc nhở chữa lành hiển thị trong Bong bóng thoại
 * (Speech Bubble) của thú cưng.
 */
export const PET_SPEECH_BUBBLES = [
  "Nhìn vào mắt đằng ấy, thấy sao một thế giới màu hồng ❤️",
  "Hôm nay hai bạn đã nhắn yêu thương cho nhau chưa đó? 🐣",
  "Măm măm ngon quá! Thương hai bạn nhất trên đời 💛",
  "Tắm mát thơm phức rồi, lại đây ôm một cái nào 🫧",
  "Gọi video ngắm mặt nhau một chút cho đỡ nhớ đi hai ơi 📹",
  "Ở bên đằng ấy bình yên như nắng sớm mai vậy đó ☀️",
  "Đừng quên uống nước và mỉm cười thật tươi hôm nay nhé 🌸",
  "Ngủ ngoan nhé, mơ thấy nhau trong giấc mơ hồng nha 🌙",
];

/** Các món quà nhỏ dễ thương gửi qua Hộp thư/Quà tặng của thú cưng. */
export const PET_GIFTS = [
  {
    id: "boba",
    emoji: "🧋",
    label: "Trà sữa trân châu",
    text: "Thú cưng vừa mang sang cho bạn một ly trà sữa ngọt ngào 🧋💕",
  },
  {
    id: "flower",
    emoji: "🌷",
    label: "Bó hoa tulip",
    text: "Tặng đằng ấy một bó hoa tulip tươi thắm từ góc nhỏ của tụi mình 🌷❤️",
  },
  {
    id: "hug",
    emoji: "🫂",
    label: "Cái ôm ấm áp",
    text: "Gửi ngàn cái ôm thật chặt sang máy đằng ấy nè 🫂💗",
  },
  {
    id: "star",
    emoji: "🌟",
    label: "Ngôi sao may mắn",
    text: "Chúc người thương cả ngày nhiều năng lượng và niềm vui 🌟🥰",
  },
];

/** Ngày hiện tại theo múi giờ Việt Nam (YYYY-MM-DD). */
export function petDayKey(now = Date.now()) {
  const vnMs = Number(now) + 7 * 3600 * 1000;
  return new Date(vnMs).toISOString().slice(0, 10);
}

/**
 * Tính mốc Exp cần cho một cấp độ cụ thể:
 * Lv.1 yêu cầu 1000 Exp, Lv.2 yêu cầu 2000 Exp, Lv.N yêu cầu N * 1000 Exp.
 */
export function levelExpRequirement(level = 1) {
  const lv = Math.max(1, Math.floor(Number(level) || 1));
  return lv * PET_BASE_LEVEL_EXP;
}

/**
 * Từ tổng Exp tích luỹ (`totalExp`), suy ra:
 * - `level`: cấp độ hiện tại (bắt đầu từ Lv.1)
 * - `levelExp`: Exp đã tích luỹ trong cấp hiện tại (bắt đầu từ 0)
 * - `levelGoal`: mốc Exp để thăng cấp tiếp theo (Lv.1: 1000, Lv.2: 2000...)
 */
export function computeLevelProgress(totalExp = 0) {
  let remaining = Math.max(0, Math.floor(Number(totalExp) || 0));
  let level = 1;
  let goal = levelExpRequirement(level);
  while (remaining >= goal && level < 999) {
    remaining -= goal;
    level += 1;
    goal = levelExpRequirement(level);
  }
  return {
    level,
    levelExp: remaining,
    levelGoal: goal,
    levelProgressRatio: Math.min(1, remaining / goal),
  };
}

/**
 * Khởi tạo trạng thái mặc định của thú cưng:
 * Bắt đầu từ Level 1 với mốc Exp là 0/1000 (tuyệt đối không có sẵn 100%).
 */
export function defaultPet(now = Date.now()) {
  return {
    name: "Bơ",
    species: "duck",
    totalExp: 0,
    todayExp: 0,
    meTodayExp: 0,
    partnerTodayExp: 0,
    todayDate: petDayKey(now),
    energy: 3,
    hunger: 85,
    cleanliness: 90,
    affection: 90,
    sleeping: false,
    quoteIndex: 0,
    lastAction: "init",
    lastActionBy: "me",
    lastActionAt: now,
    updatedAt: now,
  };
}

/** Chuẩn hoá dữ liệu thú cưng đọc từ bộ nhớ hoặc nhận qua kênh ghép nối. */
export function normalizePet(raw, now = Date.now()) {
  const base = defaultPet(now);
  if (!raw || typeof raw !== "object") return base;
  const day = petDayKey(now);
  const rawDay =
    typeof raw.todayDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(raw.todayDate)
      ? raw.todayDate
      : day;
  const totalExp = Math.max(0, Math.floor(Number(raw.totalExp) || 0));
  const meTodayExp = Math.min(
    PET_DAILY_EXP_GOAL,
    Math.max(0, Math.floor(Number(raw.meTodayExp ?? raw.todayExp) || 0)),
  );
  const partnerTodayExp = Math.min(
    PET_DAILY_EXP_GOAL,
    Math.max(0, Math.floor(Number(raw.partnerTodayExp) || 0)),
  );
  const todayExp = Math.min(
    PET_DAILY_EXP_GOAL,
    Math.max(0, Math.floor(Number(raw.todayExp ?? meTodayExp) || 0)),
  );
  // Phân định rạch ròi giữa Vịt ("duck") và Mèo ("cat"), không tự ý hoán đổi.
  const species = raw.species === "cat" ? "cat" : "duck";
  return {
    name: String(raw.name || base.name).slice(0, 24),
    species,
    totalExp,
    todayExp,
    meTodayExp,
    partnerTodayExp,
    todayDate: rawDay,
    energy: Math.min(
      PET_MAX_ENERGY,
      Math.max(1, Math.floor(Number(raw.energy) || base.energy)),
    ),
    hunger: Math.min(
      100,
      Math.max(0, Math.floor(Number(raw.hunger ?? base.hunger))),
    ),
    cleanliness: Math.min(
      100,
      Math.max(0, Math.floor(Number(raw.cleanliness ?? base.cleanliness))),
    ),
    affection: Math.min(
      100,
      Math.max(0, Math.floor(Number(raw.affection ?? base.affection))),
    ),
    sleeping: Boolean(raw.sleeping),
    quoteIndex:
      Math.abs(Math.floor(Number(raw.quoteIndex) || 0)) %
      PET_SPEECH_BUBBLES.length,
    lastAction: String(raw.lastAction || "init").slice(0, 24),
    lastActionBy: raw.lastActionBy === "partner" ? "partner" : "me",
    lastActionAt: Number(raw.lastActionAt) || now,
    updatedAt: Number(raw.updatedAt) || now,
  };
}

/**
 * Tính chỉ số sinh học (Đói, Dơ, Yêu thương) sau khi giảm tự động theo chu kỳ
 * 15 phút một lần nếu hai người không vào chăm sóc.
 */
export function applyBiologicalDecay(pet, now = Date.now()) {
  const normalized = normalizePet(pet, now);
  const elapsedMs = Math.max(0, Number(now) - Number(normalized.lastActionAt));
  const cycles = Math.floor(elapsedMs / PET_DECAY_INTERVAL_MS);
  if (cycles <= 0) {
    return {
      hunger: normalized.hunger,
      cleanliness: normalized.cleanliness,
      affection: normalized.affection,
      decayCycles: 0,
    };
  }
  return {
    hunger: Math.max(0, normalized.hunger - cycles * 4),
    cleanliness: Math.max(0, normalized.cleanliness - cycles * 3),
    affection: Math.max(0, normalized.affection - cycles * 3),
    decayCycles: cycles,
  };
}

/**
 * Tạo nội dung thông báo nhắc nhở thời gian thực gửi sang máy người thương
 * khi bấm nút "Nhắc nhở" trong phòng thú cưng.
 */
export function buildPetReminderText(pet, now = Date.now()) {
  const decayed = applyBiologicalDecay(pet, now);
  const name = String(pet?.name || "Boss");
  if (decayed.hunger < 50) {
    return `Boss ${name} đang đòi ăn kìa, vào cho Boss ăn cùng em đi anh ơi! 🍴🐣`;
  }
  if (decayed.cleanliness < 50) {
    return `Boss ${name} đang lấm lem rồi kìa, vào tắm cho Boss cùng em đi anh ơi! 🚿🫧`;
  }
  return `Boss đang đòi ăn kìa, vào cho Boss ăn cùng em đi anh ơi! 💕🐾`;
}

/**
 * Gộp trạng thái thú cưng giữa hai máy: giữ mức tổng Exp cao nhất và hành động
 * mới nhất để hai bạn cùng nuôi chung một bé thú cưng theo thời gian thực.
 */
export function mergePet(localPet, remotePet, now = Date.now()) {
  const a = normalizePet(localPet, now);
  if (!remotePet || typeof remotePet !== "object") return a;
  const b = normalizePet(remotePet, now);
  if (b.updatedAt <= a.updatedAt && b.totalExp <= a.totalExp) return a;
  const newer = b.updatedAt > a.updatedAt ? b : a;
  const sameDay = a.todayDate === b.todayDate;
  const meTodayExp = sameDay
    ? Math.min(PET_DAILY_EXP_GOAL, Math.max(a.meTodayExp, b.meTodayExp))
    : newer.meTodayExp;
  const partnerTodayExp = sameDay
    ? Math.min(
        PET_DAILY_EXP_GOAL,
        Math.max(a.partnerTodayExp, b.partnerTodayExp),
      )
    : newer.partnerTodayExp;
  return {
    ...newer,
    totalExp: Math.max(a.totalExp, b.totalExp),
    todayExp: Math.min(PET_DAILY_EXP_GOAL, Math.max(a.todayExp, b.todayExp)),
    meTodayExp,
    partnerTodayExp,
    energy: Math.min(PET_MAX_ENERGY, Math.max(a.energy, b.energy)),
  };
}

/**
 * Thực hiện một hành động tương tác với thú cưng:
 * - Tương tác phòng (`feed`, `bath`, `sleep`, `poke`, `gift`, `room`): +5 Exp
 * - Nhắn tin (`chat`): +10 Exp
 * - Gọi thoại / Video (`call`): +25 Exp
 * - Giới hạn tối đa 100 Exp mỗi ngày cho mỗi người dùng.
 */
export function interactPet(
  current,
  action,
  by = "me",
  now = Date.now(),
  extra = {},
) {
  const pet = normalizePet(current, now);
  const currentDay = petDayKey(now);
  const isSameDay = pet.todayDate === currentDay;
  const baseMeToday = isSameDay ? pet.meTodayExp : 0;
  const basePartnerToday = isSameDay ? pet.partnerTodayExp : 0;
  const baseTodayExp = isSameDay ? pet.todayExp : 0;

  const type = String(action || "poke");

  if (type === "species") {
    // Chỉ đổi loài khi người dùng chủ động truyền "duck" hoặc "cat".
    const nextSpecies =
      extra.species === "cat"
        ? "cat"
        : extra.species === "duck"
          ? "duck"
          : pet.species;
    return {
      ...pet,
      species: nextSpecies,
      updatedAt: now,
    };
  }
  if (type === "rename" && typeof extra.name === "string") {
    const cleanName = extra.name.trim().slice(0, 24);
    if (!cleanName) return pet;
    return {
      ...pet,
      name: cleanName,
      updatedAt: now,
    };
  }

  const decayed = applyBiologicalDecay(pet, now);
  let hunger = decayed.hunger;
  let cleanliness = decayed.cleanliness;
  let affection = decayed.affection;
  let sleeping = pet.sleeping;
  let quoteIndex = (pet.quoteIndex + 1) % PET_SPEECH_BUBBLES.length;
  let energyGain = 1;
  let rawExpGain = PET_EXP_REWARDS.room;

  if (type === "feed") {
    rawExpGain = PET_EXP_REWARDS.feed;
    hunger = Math.min(100, hunger + 25);
    sleeping = false;
    quoteIndex = 2;
  } else if (type === "bath") {
    rawExpGain = PET_EXP_REWARDS.bath;
    cleanliness = Math.min(100, cleanliness + 30);
    sleeping = false;
    quoteIndex = 3;
  } else if (type === "sleep") {
    rawExpGain = PET_EXP_REWARDS.sleep;
    energyGain = 2;
    sleeping = !pet.sleeping;
    quoteIndex = sleeping ? 7 : 0;
  } else if (type === "poke") {
    rawExpGain = PET_EXP_REWARDS.poke;
    affection = Math.min(100, affection + 20);
    sleeping = false;
    quoteIndex = 1;
  } else if (type === "gift") {
    rawExpGain = PET_EXP_REWARDS.gift;
    energyGain = 2;
    affection = Math.min(100, affection + 25);
    sleeping = false;
    quoteIndex = 0;
  } else if (type === "chat") {
    rawExpGain = PET_EXP_REWARDS.chat;
    affection = Math.min(100, affection + 10);
  } else if (type === "call") {
    rawExpGain = PET_EXP_REWARDS.call;
    energyGain = 2;
    affection = Math.min(100, affection + 20);
    quoteIndex = 4;
  }

  const actor = by === "partner" ? "partner" : "me";
  const actorCurrentDaily =
    actor === "partner" ? basePartnerToday : baseMeToday;
  const allowedGain = Math.max(
    0,
    Math.min(rawExpGain, PET_DAILY_EXP_GOAL - actorCurrentDaily),
  );

  const nextMeToday =
    actor === "me"
      ? Math.min(PET_DAILY_EXP_GOAL, baseMeToday + allowedGain)
      : baseMeToday;
  const nextPartnerToday =
    actor === "partner"
      ? Math.min(PET_DAILY_EXP_GOAL, basePartnerToday + allowedGain)
      : basePartnerToday;
  const nextTodayExp = Math.min(
    PET_DAILY_EXP_GOAL,
    actor === "me" ? nextMeToday : Math.max(baseTodayExp, nextMeToday),
  );

  return {
    ...pet,
    totalExp: pet.totalExp + allowedGain,
    todayExp: nextTodayExp,
    meTodayExp: nextMeToday,
    partnerTodayExp: nextPartnerToday,
    todayDate: currentDay,
    energy: Math.min(PET_MAX_ENERGY, pet.energy + energyGain),
    hunger,
    cleanliness,
    affection,
    sleeping,
    quoteIndex,
    lastAction: type,
    lastActionBy: actor,
    lastActionAt: now,
    updatedAt: now,
  };
}

/**
 * Tính toán chỉ số hiển thị của thú cưng:
 * - Level & mốc Exp theo công thức thăng cấp (+1000 mỗi cấp: Lv.1 0/1000, Lv.2 0/2000...)
 * - Exp tương tác hôm nay (tối đa 100/ngày mỗi người)
 * - Chỉ số sinh học (Đói, Dơ, Yêu thương) tự động giảm mỗi 15 phút nếu không chăm sóc.
 */
export function computePetStatus(state, now = Date.now()) {
  const rawPet = normalizePet(state?.pet, now);
  const today = petDayKey(now);
  const sameDay = rawPet.todayDate === today;
  const decayed = applyBiologicalDecay(rawPet, now);

  const pet = {
    ...rawPet,
    todayExp: sameDay ? rawPet.todayExp : 0,
    meTodayExp: sameDay ? rawPet.meTodayExp : 0,
    partnerTodayExp: sameDay ? rawPet.partnerTodayExp : 0,
    hunger: decayed.hunger,
    cleanliness: decayed.cleanliness,
    affection: decayed.affection,
  };

  const messages = Array.isArray(state?.messages) ? state.messages : [];
  let todayChats = 0;
  let todayCalls = 0;
  for (const msg of messages) {
    const createdMs = Date.parse(String(msg?.createdAt ?? ""));
    if (Number.isFinite(createdMs) && petDayKey(createdMs) === today) {
      if (msg?.kind === "call") todayCalls += 1;
      else todayChats += 1;
    }
  }

  const levelInfo = computeLevelProgress(pet.totalExp);
  const todayExp = Math.min(PET_DAILY_EXP_GOAL, pet.todayExp);

  let mood = "happy";
  let moodLabel = "Vui vẻ yêu đời 💕";
  if (pet.sleeping) {
    mood = "sleepy";
    moodLabel = "Đang ngủ say 🌙";
  } else if (pet.affection < 40) {
    mood = "sulky";
    moodLabel = "Đang dỗi vì hai bạn ít trò chuyện 😤";
  } else if (pet.hunger < 45) {
    mood = "hungry";
    moodLabel = "Đang đói bụng, cho ăn nhé 🍴";
  } else if (pet.cleanliness < 45) {
    mood = "dirty";
    moodLabel = "Đang lấm lem, tắm cho bé nhé 🚿";
  }

  const energy =
    mood === "sulky"
      ? 2
      : mood === "hungry" || mood === "dirty"
        ? 3
        : Math.min(PET_MAX_ENERGY, Math.max(1, pet.energy));

  const energyIcons =
    "⚡".repeat(energy) + "⚪".repeat(Math.max(0, PET_MAX_ENERGY - energy));
  const speech =
    mood === "sulky"
      ? "Hai bạn bận gì mà lâu chưa nhắn cho nhau thế, Bơ buồn đó nha 😤💌"
      : mood === "hungry"
        ? "Bụng kêu ọt ọt rồi, bấm cái nĩa 🍴 cho mình măm măm với nha!"
        : mood === "dirty"
          ? "Mình lấm lem rồi, bấm vòi sen 🚿 tắm mát cho mình nha!"
          : (PET_SPEECH_BUBBLES[pet.quoteIndex] ?? PET_SPEECH_BUBBLES[0]);

  return {
    pet,
    level: levelInfo.level,
    levelExp: levelInfo.levelExp,
    levelGoal: levelInfo.levelGoal,
    levelProgressRatio: levelInfo.levelProgressRatio,
    todayExp,
    dailyGoal: PET_DAILY_EXP_GOAL,
    progressRatio: Math.min(1, todayExp / PET_DAILY_EXP_GOAL),
    decayCycles: decayed.decayCycles,
    energy,
    energyIcons,
    mood,
    moodLabel,
    speech,
    todayChats,
    todayCalls,
  };
}
