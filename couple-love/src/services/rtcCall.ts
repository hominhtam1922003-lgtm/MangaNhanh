/**
 * Cuộc gọi tiếng trực tiếp bằng WebRTC.
 *
 * Vì sao: cách cũ ghi âm thành từng tệp .m4a (0,9 giây một mảnh) rồi gửi qua
 * kênh ghép nối; mỗi lần dừng/lưu/gửi là micro phải nghỉ nên câu nói bị đứt
 * quãng. WebRTC gửi tiếng liên tục 20 ms một gói, có khử vọng và bộ đệm chống
 * rung mạng nên nghe liền mạch như gọi thường.
 *
 * Kênh ghép nối vẫn là nơi trao đổi tín hiệu (offer/answer/ICE) — không cần
 * máy chủ riêng, vẫn đúng luật "không cần tài khoản, không cần máy chủ".
 *
 * Nếu máy không nạp được WebRTC (bản build thiếu thư viện native), phần mềm tự
 * quay về đường tiếng cũ qua kênh ghép nối, không làm văng app.
 */
import {
  RTC_DROP_MS,
  RTC_ICE_SERVERS,
  RTC_MEDIA,
  RTC_TRY_MS,
  hasSignal,
  rememberSignal,
  rtcPacket,
  rtcStateIsLive,
  rtcStateIsLost,
  rtcStatusText,
} from "../logic/rtcSignal.mjs";
import type { RtcState } from "../logic/rtcSignal.mjs";

type Signal = {
  sub?: unknown;
  sid?: unknown;
  sdp?: unknown;
  candidate?: unknown;
};

type Options = {
  callId: string;
  role: "caller" | "callee";
  /** Gửi một gói tín hiệu qua kênh ghép nối (retries = gửi lại thêm mấy lần). */
  send: (packet: Record<string, unknown>, retries?: number) => void;
  /** Báo cho giao diện biết đường tiếng đang ở bước nào. */
  onState: (state: RtcState, detail: string) => void;
};

// `require` muộn: chỉ nạp thư viện native khi thật sự gọi, để app vẫn chạy
// được nếu bản build không có WebRTC.
declare const require: (name: string) => unknown;

let nativeModule: {
  RTCPeerConnection?: unknown;
  RTCSessionDescription?: unknown;
  RTCIceCandidate?: unknown;
  mediaDevices?: { getUserMedia?: (constraints: unknown) => Promise<any> };
} | null = null;
let nativeProblem = "";

function loadNative() {
  if (nativeModule) return nativeModule;
  if (nativeProblem) return null;
  try {
    nativeModule = require("react-native-webrtc") as typeof nativeModule;
    return nativeModule;
  } catch (error) {
    nativeProblem =
      error instanceof Error
        ? error.message
        : "Máy này không nạp được thư viện WebRTC.";
    return null;
  }
}

/** Máy có sẵn WebRTC không (dùng cho màn hình Cài đặt và nhật ký kết nối). */
export function rtcSupport(): { ok: boolean; detail: string } {
  const rtc = loadNative();
  if (rtc?.RTCPeerConnection) return { ok: true, detail: "Có WebRTC" };
  return { ok: false, detail: nativeProblem || "Máy này không có WebRTC." };
}

export class RtcCall {
  private pc: any = null;
  private mic: any = null;
  private closed = false;
  private live = false;
  private state: RtcState = "off";
  private seen: string[] = [];
  private pending: any[] = [];
  private dropTimer: ReturnType<typeof setTimeout> | null = null;
  private watchdog: ReturnType<typeof setTimeout> | null = null;
  private restarted = false;
  private readonly ready: Promise<void>;

  constructor(private readonly opts: Options) {
    this.ready = this.setup();
  }

  isLive() {
    return this.live;
  }

  currentState() {
    return this.state;
  }

  private report(state: RtcState, detail?: string) {
    this.state = state;
    try {
      this.opts.onState(state, detail || rtcStatusText(state));
    } catch {}
  }

  private sendSignal(
    sub: string,
    extra: Record<string, unknown> = {},
    retries = 0,
  ) {
    if (this.closed) return;
    try {
      this.opts.send(rtcPacket(this.opts.callId, sub, extra), retries);
    } catch {}
  }

  private async setup() {
    const rtc = loadNative();
    if (!rtc?.RTCPeerConnection) {
      this.report(
        "failed",
        nativeProblem ||
          "Máy này không có WebRTC, dùng đường tiếng qua kênh ghép nối.",
      );
      return;
    }
    this.report("trying");
    const pc = new (rtc.RTCPeerConnection as new (config: unknown) => any)({
      iceServers: RTC_ICE_SERVERS,
      iceCandidatePoolSize: 2,
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
    });
    this.pc = pc;
    pc.onicecandidate = (event: any) => {
      const candidate = event?.candidate;
      if (!candidate?.candidate || this.closed) return;
      // Mỗi địa chỉ mạng gửi hai lần: kênh công cộng thỉnh thoảng mất gói mà
      // thiếu địa chỉ thì không nối được.
      this.sendSignal(
        "ice",
        {
          candidate: {
            candidate: String(candidate.candidate),
            sdpMid: candidate.sdpMid ?? null,
            sdpMLineIndex: candidate.sdpMLineIndex ?? null,
          },
        },
        1,
      );
    };
    pc.onconnectionstatechange = () => this.readConnection();
    pc.oniceconnectionstatechange = () => this.readConnection();
    try {
      const stream = await rtc.mediaDevices?.getUserMedia?.(RTC_MEDIA);
      if (!stream) throw new Error("không mở được micro");
      this.mic = stream;
      for (const track of stream.getAudioTracks()) pc.addTrack(track, stream);
    } catch (error) {
      this.report(
        "failed",
        `Không mở được micro cho cuộc gọi trực tiếp (${
          error instanceof Error ? error.message : "lỗi không rõ"
        }), vẫn gọi bằng kênh ghép nối.`,
      );
      return;
    }
    // Hết thời gian chờ mà chưa nối trực tiếp được: vẫn gọi được bằng kênh
    // ghép nối, và nếu nối được muộn hơn thì tự chuyển sang tiếng trực tiếp.
    this.watchdog = setTimeout(() => {
      if (this.live || this.closed) return;
      this.report(
        "failed",
        "Chưa nối trực tiếp được, tiếng đang đi qua kênh ghép nối.",
      );
    }, RTC_TRY_MS);
    if (this.opts.role === "caller") await this.offer();
  }

  /** Bên gọi: mời máy kia nối trực tiếp. */
  private async offer() {
    if (!this.pc || this.closed) return;
    try {
      const offer = await this.pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });
      await this.pc.setLocalDescription(offer);
      this.sendSignal("offer", { sdp: offer.sdp }, 1);
    } catch {
      this.report("failed", "Không tạo được lời mời nối trực tiếp.");
    }
  }

  private readConnection() {
    const pc = this.pc;
    if (!pc || this.closed) return;
    const state = String(pc.connectionState ?? "");
    const ice = String(pc.iceConnectionState ?? "");
    if (rtcStateIsLive(state) || rtcStateIsLive(ice)) {
      if (this.dropTimer) {
        clearTimeout(this.dropTimer);
        this.dropTimer = null;
      }
      if (!this.live) {
        this.live = true;
        this.report("live", "Tiếng nét trực tiếp (WebRTC)");
      }
      return;
    }
    if (rtcStateIsLost(state)) {
      this.fail("Đường tiếng trực tiếp bị ngắt.");
      return;
    }
    if (state === "disconnected" || ice === "disconnected") {
      if (this.dropTimer) return;
      // Mạng vừa chớp: chờ vài giây, không nối lại được thì quay về kênh ghép nối.
      this.dropTimer = setTimeout(() => {
        this.dropTimer = null;
        const now = String(this.pc?.connectionState ?? "");
        if (!rtcStateIsLive(now))
          this.fail("Mạng chập chờn, đã quay về kênh ghép nối.");
      }, RTC_DROP_MS);
    }
  }

  private fail(detail: string) {
    if (this.live) this.opts.send(rtcPacket(this.opts.callId, "bye"), 0);
    this.live = false;
    this.report("failed", detail);
  }

  /** Nhận tín hiệu của máy kia (đã đi qua kênh ghép nối). */
  async handle(message: Signal) {
    await this.ready;
    if (this.closed || !this.pc) return;
    const sub = String(message?.sub ?? "");
    const sid = String(message?.sid ?? "");
    if (!sub || !sid) return;
    // Tín hiệu gửi lại để chống mất gói: cùng nội dung thì bỏ qua, không áp dụng hai lần.
    if (hasSignal(this.seen, sid)) return;
    this.seen = rememberSignal(this.seen, sid);
    try {
      if (sub === "offer") {
        const sdp = String(message.sdp ?? "");
        if (!sdp) return;
        await this.pc.setRemoteDescription(
          new (
            loadNative()!.RTCSessionDescription as new (value: unknown) => any
          )({
            type: "offer",
            sdp,
          }),
        );
        await this.flushPending();
        if (this.mic) {
          const answer = await this.pc.createAnswer();
          await this.pc.setLocalDescription(answer);
          this.sendSignal("answer", { sdp: answer.sdp }, 1);
        }
        return;
      }
      if (sub === "answer") {
        if (this.pc.signalingState !== "have-local-offer") return;
        await this.pc.setRemoteDescription(
          new (
            loadNative()!.RTCSessionDescription as new (value: unknown) => any
          )({
            type: "answer",
            sdp: String(message.sdp ?? ""),
          }),
        );
        await this.flushPending();
        return;
      }
      if (sub === "ice") {
        const candidate = message.candidate as { candidate?: unknown } | null;
        if (!candidate?.candidate) return;
        const ice = new (
          loadNative()!.RTCIceCandidate as new (value: unknown) => any
        )(candidate);
        // Chưa có mô tả của máy kia thì giữ lại, thêm sau (nếu không sẽ lỗi).
        if (!this.pc.remoteDescription) {
          this.pending.push(ice);
          return;
        }
        await this.pc.addIceCandidate(ice);
        return;
      }
      if (sub === "bye") {
        this.fail("Người thương đã chuyển sang đường tiếng khác.");
      }
    } catch {}
  }

  private async flushPending() {
    while (this.pending.length) {
      const ice = this.pending.shift();
      try {
        await this.pc?.addIceCandidate(ice);
      } catch {}
    }
  }

  /** Bật/tắt micro: tắt thì WebRTC gửi im lặng, máy kia vẫn thấy mình trong cuộc gọi. */
  setMic(on: boolean) {
    try {
      const tracks = this.mic?.getAudioTracks?.() ?? [];
      for (const track of tracks) track.enabled = Boolean(on);
    } catch {}
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.live = false;
    if (this.watchdog) {
      clearTimeout(this.watchdog);
      this.watchdog = null;
    }
    if (this.dropTimer) {
      clearTimeout(this.dropTimer);
      this.dropTimer = null;
    }
    this.pending = [];
    try {
      for (const track of this.mic?.getTracks?.() ?? []) track.stop();
    } catch {}
    this.mic = null;
    try {
      this.pc?.close?.();
    } catch {}
    this.pc = null;
    this.report("closed");
  }
}
