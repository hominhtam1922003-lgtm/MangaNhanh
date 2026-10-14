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
