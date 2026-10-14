// Lời yêu thương / thơ ngắn gửi cho cả hai máy.
// Câu của mỗi ngày được chọn theo NGÀY (không theo máy), nên hai điện thoại tự
// hiện đúng cùng một câu mà không cần gửi qua mạng.
export const LOVE_LINES = [
  { emoji: "💞", text: "Anh nhớ em nhiều hơn cả lúc anh nói ra." },
  { emoji: "🌙", text: "Ngủ ngon nhé, trong giấc mơ có anh đứng đợi." },
  { emoji: "☀️", text: "Sáng nay trời đẹp, nhưng vẫn thua nụ cười của em." },
  { emoji: "🍲", text: "Nhớ ăn cơm đúng bữa, đừng để bụng đói vì bận." },
  { emoji: "🌧️", text: "Trời mưa thì nhớ mang áo, đừng để ướt rồi cảm." },
  { emoji: "💌", text: "Có một điều anh giấu kỹ: anh thương em rất nhiều." },
  { emoji: "🌻", text: "Em là điều tử tế nhất mà ngày thường mang tới." },
  {
    emoji: "🫶",
    text: "Hôm nay mệt thì cứ tựa vào anh, không cần mạnh mẽ một mình.",
  },
  {
    emoji: "🌊",
    text: "Xa nhau mấy cây số cũng không xa bằng một tin nhắn em gửi.",
  },
  {
    emoji: "⭐",
    text: "Anh ước điều gì cũng thành, riêng điều có em là anh chắc chắn.",
  },
  { emoji: "🍀", text: "Gặp được em là phần may mắn nhất của đời anh." },
  { emoji: "🧡", text: "Cảm ơn em vì đã chọn ở lại, mỗi ngày, đều đặn." },
  { emoji: "🌸", text: "Em cười một cái là anh thấy hôm nay không uổng." },
  { emoji: "🕊️", text: "Mình cãi nhau thì được, nhưng đừng bỏ nhau nhé." },
  {
    emoji: "💫",
    text: "Anh thương cả những ngày em chẳng dễ thương chút nào.",
  },
  {
    emoji: "🎐",
    text: "Hôm nay có gì vui kể anh nghe với, chuyện nhỏ cũng được.",
  },
  { emoji: "🍜", text: "Khuya rồi, ngủ sớm nha, mai còn dậy sớm." },
  { emoji: "💗", text: "Có em rồi, anh chẳng cần đi đâu xa nữa." },
  {
    emoji: "🫂",
    text: "Ôm em một cái, thay cho cả ngày anh không nói được gì.",
  },
  { emoji: "🌺", text: "Em không cần hoàn hảo, em chỉ cần là em." },
  {
    emoji: "📜",
    text: "Thương nhau thì nói ra, đừng để lòng mình âm thầm chịu đựng.",
  },
  { emoji: "🌷", text: "Anh giữ lời hứa nhỏ, để em tin những lời hứa lớn." },
  { emoji: "☔", text: "Đi đường cẩn thận, anh đợi em về nhà an toàn." },
  { emoji: "🍨", text: "Cuối tuần này mình đi ăn món em thích nhé." },
  { emoji: "🕰️", text: "Thời gian bên em, anh không thấy phí một phút nào." },
  { emoji: "💐", text: "Cảm ơn em đã xuất hiện đúng lúc anh cần nhất." },
  { emoji: "🌠", text: "Mình đi chậm thôi, miễn là đi cùng nhau." },
  { emoji: "🧸", text: "Ngủ ngoan, anh vẫn ở đây ngay khi em gọi." },
  {
    emoji: "🥰",
    text: "Hôm nay anh lại thích em thêm một chút, như mọi ngày.",
  },
  {
    emoji: "🌱",
    text: "Chuyện mình đang lớn lên từng ngày, anh giữ gìn từng chút.",
  },
  { emoji: "🍁", text: "Mùa này nhớ giữ ấm, mặc thêm áo khi ra đường nhé." },
  { emoji: "💞", text: "Em là người anh kể hết mọi chuyện vui buồn." },
  { emoji: "🌄", text: "Ngày mai lại bắt đầu, mình lại đi cùng nhau." },
  { emoji: "🎈", text: "Anh mong mỗi ngày của em nhẹ nhàng hơn hôm qua." },
  { emoji: "💕", text: "Đừng tự nhỏ lại trước ai, kể cả trước anh." },
  { emoji: "🌙", text: "Nếu hôm nay tệ, mai mình sẽ tốt lại. Anh vẫn ở đây." },
  { emoji: "🕯️", text: "Anh nhớ mùi tóc em, nhớ cả tiếng em thở dài." },
  { emoji: "🏡", text: "Nhà không phải một chỗ, nhà là khi có em." },
  { emoji: "📮", text: "Viết cho em câu này: anh thương em, thật lòng." },
  { emoji: "🥤", text: "Uống nước đi em, đừng chỉ uống cà phê." },
  { emoji: "🎶", text: "Nghe bài em thích, anh nghĩ tới em suốt." },
  { emoji: "🌈", text: "Sau mưa là nắng, sau cãi nhau là mình hiểu nhau hơn." },
  {
    emoji: "💎",
    text: "Điều quý nhất anh từng có, là em gọi anh bằng tên thân mật.",
  },
  { emoji: "🌼", text: "Nhớ em trong từng việc nhỏ anh làm hôm nay." },
  { emoji: "🧸", text: "Ngày dài rồi, nghỉ ngơi chút đi em." },
];
// Tổng tích lũy đơn giản theo NGÀY: hai máy cùng ngày là cùng câu.
export function loveLineIndex(day) {
  const text = String(day ?? "").slice(0, 10);
  let hash = 7;
  for (let index = 0; index < text.length; index++)
    hash = (hash * 31 + text.charCodeAt(index)) % 2147483647;
  return hash % LOVE_LINES.length;
}
export function loveLineFor(day) {
  return LOVE_LINES[loveLineIndex(day)];
}
export function loveLineKey(day) {
  return `love-line-${String(day ?? "").slice(0, 10)}`;
}

// Thơ ngắn: tự gửi mỗi 2 tiếng nếu chọn gửi thơ, xen kẽ với lời yêu.
export const LOVE_POEMS = [
  {
    emoji: "🌷",
    lines: [
      "Anh gom nắng sớm nay lại",
      "Gửi em một chút cho ngày dịu hơn",
      "Nếu em thấy lòng chùng xuống",
      "Thì coi tin nhắn này là anh đang cười.",
    ],
  },
  {
    emoji: "🌙",
    lines: [
      "Đêm nay trăng sáng ngoài hiên",
      "Anh ngồi đếm thử mấy lần nhớ em",
      "Đếm hoài mà chẳng hết thêm",
      "Thôi thì nhắn trước, để em ngủ ngon.",
    ],
  },
  {
    emoji: "🌾",
    lines: [
      "Mình đi qua mấy mùa rồi",
      "Mùa nào cũng có em ngồi cạnh anh",
      "Đường còn dài, chẳng sao đâu",
      "Miễn là bước chậm, cùng nhau là về.",
    ],
  },
  {
    emoji: "☕",
    lines: [
      "Sáng nay em uống gì chưa",
      "Anh pha giùm một câu hỏi thật thà",
      "Em nhớ ăn sáng đấy nha",
      "Đừng để bụng đói, anh lo.",
    ],
  },
  {
    emoji: "🌧️",
    lines: [
      "Trời mưa thì mặc áo vào",
      "Đi xe chậm lại, đường trơn em à",
      "Anh ở xa, chẳng che được",
      "Nên gửi câu này giữ em ấm phần nào.",
    ],
  },
  {
    emoji: "🏮",
    lines: [
      "Anh không hứa chuyện lớn lao",
      "Chỉ hứa sáng dậy vẫn còn thương em",
      "Ngày dài, tối muộn, mệt thêm",
      "Thì câu thương ấy vẫn nguyên vẹn hoài.",
    ],
  },
  {
    emoji: "🍊",
    lines: [
      "Em là quả ngọt mùa này",
      "Anh là người đứng dưới cây đợi chờ",
      "Chờ lâu cũng chẳng sao đâu",
      "Miễn là em rụng vào tay anh lành.",
    ],
  },
  {
    emoji: "🕊️",
    lines: [
      "Giận nhau thì giận một hôm",
      "Đừng mang theo tới giấc êm của mình",
      "Sáng mai trời lại trong xanh",
      "Mình nói với nhau câu nhẹ nhàng thôi.",
    ],
  },
  {
    emoji: "🌻",
    lines: [
      "Hướng dương luôn ngó mặt trời",
      "Còn anh thì cứ ngó hoài về em",
      "Xa bao nhiêu cũng chẳng quên",
      "Ngày nào cũng vậy, đều thêm một phần.",
    ],
  },
  {
    emoji: "🎐",
    lines: [
      "Gió khuya lùa nhẹ qua song",
      "Mang câu này tới chỗ em đang nằm",
      "Ngủ đi, nhắm mắt, thở sâu",
      "Anh ở đây, ngay khi em cần.",
    ],
  },
  {
    emoji: "🧵",
    lines: [
      "Chuyện mình khâu từng mũi kim",
      "Mũi nào cũng có tên em, tên anh",
      "Vải thô, chỉ mảnh cũng thành",
      "Tấm êm che cả những ngày gió mưa.",
    ],
  },
  {
    emoji: "🍀",
    lines: [
      "Cảm ơn em đã chọn anh",
      "Giữa bao nhiêu lựa chọn bon chen ngoài kia",
      "Anh giữ vầng may mắn này",
      "Cẩn thận, từng ngày, chẳng để rơi.",
    ],
  },
];
export function lovePoemIndex(seed) {
  const value = Number(seed) || 0;
  return Math.abs(Math.floor(value)) % LOVE_POEMS.length;
}
export function lovePoemFor(seed) {
  return LOVE_POEMS[lovePoemIndex(seed)];
}
/** Một lời nhắn tự động: xen kẽ lời yêu và thơ, chọn theo mốc thời gian. */
export function loveNoteFor(when, turn = 0) {
  const at = when instanceof Date ? when : new Date(when ?? Date.now());
  const stamp = Number.isFinite(at.getTime()) ? at.getTime() : Date.now();
  const slot = Math.floor(stamp / (2 * 60 * 60 * 1000)) + (Number(turn) || 0);
  if (Math.abs(slot) % 2 === 1) {
    const poem = lovePoemFor(slot);
    return { emoji: poem.emoji, text: poem.lines.join("\n") };
  }
  const day = at.toISOString().slice(0, 10);
  const line = loveLineFor(day);
  return { emoji: line.emoji, text: line.text };
}
