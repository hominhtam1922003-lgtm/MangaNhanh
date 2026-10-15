// Logic thuần cho tính năng "Nuôi Thú Cưng Ảo (Couple Pet)" phong cách Widgetable.
// Không phụ thuộc React Native nên kiểm thử trực tiếp bằng Node.

export const PET_MAX_ENERGY = 5;
export const PET_DAILY_EXP_GOAL = 100;

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

/** Trạng thái mặc định của thú cưng. */
export function defaultPet(now = Date.now()) {
  return {
    name: "Bơ",
    species: "duck",
    totalExp: 20,
    todayExp: 20,
    todayDate: petDayKey(now),
    energy: 5,
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
  const totalExp = Math.max(0, Math.floor(Number(raw.totalExp) || 20));
  const todayExp = Math.min(
    PET_DAILY_EXP_GOAL,
    Math.max(0, Math.floor(Number(raw.todayExp) || 0)),
  );
  return {
    name: String(raw.name || base.name).slice(0, 24),
    species: raw.species === "cat" ? "cat" : "duck",
    totalExp,
    todayExp,
    todayDate: rawDay,
    energy: Math.min(
      PET_MAX_ENERGY,
      Math.max(1, Math.floor(Number(raw.energy) || base.energy)),
    ),
    hunger: Math.min(100, Math.max(10, Math.floor(Number(raw.hunger) || 80))),
    cleanliness: Math.min(
      100,
      Math.max(10, Math.floor(Number(raw.cleanliness) || 85)),
    ),
    affection: Math.min(
      100,
      Math.max(10, Math.floor(Number(raw.affection) || 85)),
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
 * Gộp trạng thái thú cưng giữa hai máy: giữ mức tổng Exp cao nhất và hành động
 * mới nhất để hai bạn cùng nuôi chung một bé thú cưng theo thời gian thực.
 */
export function mergePet(localPet, remotePet, now = Date.now()) {
  const a = normalizePet(localPet, now);
  if (!remotePet || typeof remotePet !== "object") return a;
  const b = normalizePet(remotePet, now);
  if (b.updatedAt <= a.updatedAt && b.totalExp <= a.totalExp) return a;
  const newer = b.updatedAt > a.updatedAt ? b : a;
  return {
    ...newer,
    totalExp: Math.max(a.totalExp, b.totalExp),
    todayExp: Math.min(PET_DAILY_EXP_GOAL, Math.max(a.todayExp, b.todayExp)),
    energy: Math.min(PET_MAX_ENERGY, Math.max(a.energy, b.energy)),
    hunger: Math.max(a.hunger, b.hunger),
    cleanliness: Math.max(a.cleanliness, b.cleanliness),
    affection: Math.max(a.affection, b.affection),
  };
}

/**
 * Thực hiện một hành động tương tác với thú cưng:
 * - `feed`: Cho ăn (🍴)
 * - `bath`: Tắm rửa (🚿)
 * - `sleep`: Đi ngủ / Thức dậy (🌙)
 * - `poke`: Nhắc nhở đối phương (👥)
 * - `gift`: Hộp thư / Quà tặng (💬)
 * - `chat`: Tự động cộng khi hai bạn nhắn tin
 * - `call`: Tự động cộng khi hai bạn gọi thoại / gọi video
 */
export function interactPet(
  current,
  action,
  by = "me",
  now = Date.now(),
  extra = {},
) {
  const pet = normalizePet(current, now);
  const type = String(action || "poke");
  let expGain = 15;
  let energyGain = 1;
  let hunger = pet.hunger;
  let cleanliness = pet.cleanliness;
  let affection = pet.affection;
  let sleeping = pet.sleeping;
  let quoteIndex = (pet.quoteIndex + 1) % PET_SPEECH_BUBBLES.length;

  if (type === "feed") {
    expGain = 20;
    energyGain = 1;
    hunger = Math.min(100, hunger + 25);
    sleeping = false;
    quoteIndex = 2;
  } else if (type === "bath") {
    expGain = 15;
    energyGain = 1;
    cleanliness = Math.min(100, cleanliness + 30);
    sleeping = false;
    quoteIndex = 3;
  } else if (type === "sleep") {
    expGain = 10;
    energyGain = 2;
    sleeping = !pet.sleeping;
    quoteIndex = sleeping ? 7 : 0;
  } else if (type === "poke") {
    expGain = 15;
    energyGain = 1;
    affection = Math.min(100, affection + 20);
    sleeping = false;
    quoteIndex = 1;
  } else if (type === "gift") {
    expGain = 25;
    energyGain = 2;
    affection = Math.min(100, affection + 25);
    sleeping = false;
    quoteIndex = 0;
  } else if (type === "chat") {
    expGain = 10;
    energyGain = 1;
    affection = Math.min(100, affection + 10);
  } else if (type === "call") {
    expGain = 25;
    energyGain = 2;
    affection = Math.min(100, affection + 20);
    quoteIndex = 4;
  } else if (type === "species") {
    return {
      ...pet,
      species:
        extra.species === "cat"
          ? "cat"
          : extra.species === "duck"
            ? "duck"
            : pet.species === "duck"
              ? "cat"
              : "duck",
      updatedAt: now,
    };
  } else if (type === "rename" && typeof extra.name === "string") {
    const cleanName = extra.name.trim().slice(0, 24);
    if (!cleanName) return pet;
    return {
      ...pet,
      name: cleanName,
      updatedAt: now,
    };
  }

  return {
    ...pet,
    totalExp: pet.totalExp + expGain,
    todayExp: Math.min(PET_DAILY_EXP_GOAL, pet.todayExp + expGain),
    energy: Math.min(PET_MAX_ENERGY, pet.energy + energyGain),
    hunger,
    cleanliness,
    affection,
    sleeping,
    quoteIndex,
    lastAction: type,
    lastActionBy: by === "partner" ? "partner" : "me",
    lastActionAt: now,
    updatedAt: now,
  };
}

/**
 * Tính toán chỉ số hiển thị của thú cưng (Level, Exp hôm nay, Năng lượng ⚡,
 * Trạng thái cảm xúc vui vẻ / đói / dỗi hờn) kết hợp lịch sử nhắn tin & gọi điện.
 */
export function computePetStatus(state, now = Date.now()) {
  const pet = normalizePet(state?.pet, now);
  const messages = Array.isArray(state?.messages) ? state.messages : [];
  const today = petDayKey(now);

  let todayChats = 0;
  let todayCalls = 0;
  let latestInteractionMs = pet.lastActionAt || 0;

  for (const msg of messages) {
    const createdMs = Date.parse(String(msg?.createdAt ?? ""));
    if (Number.isFinite(createdMs)) {
      if (createdMs > latestInteractionMs) latestInteractionMs = createdMs;
      if (petDayKey(createdMs) === today) {
        if (msg?.kind === "call") todayCalls += 1;
        else todayChats += 1;
      }
    }
  }

  const bonusToday = todayChats * 10 + todayCalls * 25;
  const todayExp = Math.min(
    PET_DAILY_EXP_GOAL,
    Math.max(pet.todayExp, 20 + bonusToday),
  );
  const totalExp = Math.max(pet.totalExp, todayExp);
  const level = Math.max(1, Math.floor(totalExp / PET_DAILY_EXP_GOAL) + 1);

  const hoursSinceInteraction = Math.max(
    0,
    (now - (latestInteractionMs || now)) / (3600 * 1000),
  );
  const hoursSinceCare = Math.max(
    0,
    (now - (pet.lastActionAt || now)) / (3600 * 1000),
  );

  let mood = "happy";
  let moodLabel = "Vui vẻ yêu đời 💕";
  if (pet.sleeping) {
    mood = "sleepy";
    moodLabel = "Đang ngủ say 🌙";
  } else if (hoursSinceInteraction >= 18) {
    mood = "sulky";
    moodLabel = "Đang dỗi vì hai bạn ít trò chuyện 😤";
  } else if (hoursSinceCare >= 8 || pet.hunger < 35) {
    mood = "hungry";
    moodLabel = "Đang đói bụng, cho ăn nhé 🍴";
  }

  const energy =
    mood === "sulky"
      ? 2
      : mood === "hungry"
        ? 3
        : Math.min(
            PET_MAX_ENERGY,
            Math.max(pet.energy, todayCalls > 0 || todayChats > 0 ? 5 : 4),
          );

  const energyIcons =
    "⚡".repeat(energy) + "⚪".repeat(Math.max(0, PET_MAX_ENERGY - energy));
  const speech =
    mood === "sulky"
      ? "Hai bạn bận gì mà lâu chưa nhắn cho nhau thế, Bơ buồn đó nha 😤💌"
      : mood === "hungry"
        ? "Bụng kêu ọt ọt rồi, bấm cái nĩa 🍴 cho mình măm măm với nha!"
        : (PET_SPEECH_BUBBLES[pet.quoteIndex] ?? PET_SPEECH_BUBBLES[0]);

  return {
    pet,
    level,
    todayExp,
    dailyGoal: PET_DAILY_EXP_GOAL,
    progressRatio: Math.min(1, todayExp / PET_DAILY_EXP_GOAL),
    energy,
    energyIcons,
    mood,
    moodLabel,
    speech,
    todayChats,
    todayCalls,
  };
}
