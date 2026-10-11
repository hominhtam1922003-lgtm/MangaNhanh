// Thuyết minh bằng giọng AI của trình duyệt (Web Speech API, miễn phí, chạy offline trên máy).
// Trên Android WebView/Chrome, giọng được chọn tự động theo ngôn ngữ đã cài.

let voicesReady: Promise<SpeechSynthesisVoice[]> | null = null;

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!voicesReady) {
    voicesReady = new Promise((resolve) => {
      const s = window.speechSynthesis;
      const v = s.getVoices();
      if (v.length) return resolve(v);
      s.onvoiceschanged = () => resolve(s.getVoices());
      setTimeout(() => resolve(s.getVoices()), 1500);
    });
  }
  return voicesReady;
}

export const narrationSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

export async function speak(text: string, lang: 'vi-VN' | 'zh-CN', rate = 1.1) {
  if (!narrationSupported()) return;
  const s = window.speechSynthesis;
  s.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = rate;
  const voices = await loadVoices();
  const prefix = lang.slice(0, 2);
  const voice = voices.find((x) => x.lang.replace('_', '-') === lang) ?? voices.find((x) => x.lang.startsWith(prefix));
  if (voice) u.voice = voice;
  s.speak(u);
}

export function stopSpeak() {
  if (narrationSupported()) window.speechSynthesis.cancel();
}
