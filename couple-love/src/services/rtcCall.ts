/**
 * Cuộc gọi tiếng trực tiếp. Ba lớp, lớp trên không chạy được thì tự hạ xuống lớp
 * dưới, không cắt cuộc gọi:
 *
 * 1. **PeerJS** — thư viện gọi điện mã nguồn mở. Dùng máy chủ "chào hỏi" miễn phí
 *    của chính họ (`0.peerjs.com`) và cả máy chủ TRUNG CHUYỂN (TURN) miễn phí đi
 *    kèm trong thư viện. Không tài khoản, không khoá, không phải nuôi máy chủ nào.
 *    Đây là đường tiếng chính vì có TURN: nối được cả khi hai máy ở sau NAT khó.
 *    Chỉ mã máy (một chuỗi ngẫu nhiên) được trao đổi qua kênh ghép nối đang chạy
 *    sẵn; tiếng đi thẳng máy-tới-máy hoặc qua TURN, không qua máy chủ nào của ta.
 * 2. **WebRTC tự nối** — tín hiệu offer/answer/ICE qua kênh ghép nối, như 1.14.0.
 * 3. **Kênh ghép nối** — gửi từng mẩu tiếng 0,9 giây, chậm hơn nhưng luôn có tiếng.
 *
 * Tiếng của lớp 1 và 2 là RTP/Opus 20 ms một gói — liên tục như gọi thường, không
 * phải "gửi từng mẫu" như lớp 3.
 *
 * Chưa hết: sau khi lớp 1 hoặc 2 nối được, app vẫn đo số byte tiếng thật đang
 * vào/ra; nối rồi mà im quá lâu thì tự quay về lớp 3 và báo máy kia quay theo.
 */
import {
  ICE_POLICY,
  PEER_CLOUD,
  RTC_DROP_MS,
  RTC_ICE_SERVERS,
  RTC_MEDIA,
  RTC_PEER_MS,
  RTC_STATS_MS,
  RTC_TRY_MS,
  hasSignal,
  rememberSignal,
  rtcAudioIsDead,
  rtcPacket,
  rtcStateIsLive,
  rtcStateIsLost,
  rtcStatusText,
  tuneOpusSdp,
} from "../logic/rtcSignal.mjs";
import type { RtcState } from "../logic/rtcSignal.mjs";
import {
  audioLevelFromBytes,
  audioLevelFromReport,
  smoothLevel,
} from "../logic/chatExtras.mjs";

type Signal = {
  sub?: unknown;
  sid?: unknown;
  sdp?: unknown;
  id?: unknown;
  candidate?: unknown;
};

type Options = {
  callId: string;
  role: "caller" | "callee";
  /** Gửi một gói tín hiệu qua kênh ghép nối (retries = gửi lại thêm mấy lần). */
  send: (packet: Record<string, unknown>, retries?: number) => void;
  /** Báo cho giao diện biết đường tiếng đang ở bước nào. */
  onState: (state: RtcState, detail: string) => void;
  /**
   * Số liệu thật của đường tiếng: byte vào/ra và cường độ tiếng nói (0..1) để
   * màn hình gọi cho trái tim đập theo giọng của người thương.
   */
  onStats?: (info: {
    inBytes: number;
    outBytes: number;
    level: number;
    levelSource: string;
  }) => void;
};

// `require` muộn: chỉ nạp thư viện native khi thật sự gọi, để app vẫn chạy
// được nếu bản build không có WebRTC.
declare const require: (name: string) => unknown;

let nativeModule: {
  RTCPeerConnection?: unknown;
  RTCSessionDescription?: unknown;
  RTCIceCandidate?: unknown;
  mediaDevices?: { getUserMedia?: (constraints: unknown) => Promise<any> };
  registerGlobals?: () => void;
} | null = null;
let nativeProblem = "";
let peerModule: { Peer?: new (id?: unknown, options?: unknown) => any } | null =
  null;
let peerProblem = "";

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

function loadPeer() {
  if (peerModule) return peerModule;
  if (peerProblem) return null;
  try {
    // Vỏ bọc native của WebRTC phải nạp trước: peerjs dùng thẳng
    // RTCPeerConnection toàn cục, phải đăng ký toàn cục rồi mới nạp peerjs.
    const rtc = loadNative();
    if (!rtc?.RTCPeerConnection) return null;
    try {
      rtc.registerGlobals?.();
    } catch {}
    peerModule = require("peerjs") as typeof peerModule;
    return peerModule;
  } catch (error) {
    peerProblem =
      error instanceof Error
        ? error.message
        : "Máy này không nạp được thư viện gọi điện.";
    return null;
  }
}

/** Máy có sẵn WebRTC không (dùng cho màn hình Cài đặt và nhật ký kết nối). */
export function rtcSupport(): { ok: boolean; detail: string } {
  const rtc = loadNative();
  if (rtc?.RTCPeerConnection) return { ok: true, detail: "Có WebRTC" };
  return { ok: false, detail: nativeProblem || "Máy này không có WebRTC." };
}

/** Máy có nạp được PeerJS không (máy chủ chào hỏi + TURN miễn phí đi kèm). */
export function peerSupport(): { ok: boolean; detail: string } {
  const peer = loadPeer();
  if (peer?.Peer)
    return { ok: true, detail: `Có PeerJS (máy chủ ${PEER_CLOUD.host})` };
  return { ok: false, detail: peerProblem || "Máy này không nạp được PeerJS." };
}

export class RtcCall {
  private pc: any = null;
  private peer: any = null;
  private peerMedia: any = null;
  private myPeerId = "";
  private remotePeerId = "";
  private stage: "peer" | "native" = "peer";
  private early: Signal[] = [];
  private peerWait: (() => void) | null = null;
  private mic: any = null;
  private closed = false;
  private live = false;
  private state: RtcState = "off";
  private seen: string[] = [];
  private pending: any[] = [];
  private dropTimer: ReturnType<typeof setTimeout> | null = null;
  private watchdog: ReturnType<typeof setTimeout> | null = null;
  private peerTimer: ReturnType<typeof setTimeout> | null = null;
  private statsTimer: ReturnType<typeof setInterval> | null = null;
  /** Mức tiếng nói đã làm mượt + mốc byte lần trước (cho trái tim đập). */
  private lastLevel = 0;
  private lastLevelAt = 0;
  private lastInBytes = 0;
  private lastAudioAt = 0;
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
    this.report("trying", "Đang thử nối tiếng trực tiếp qua PeerJS…");
    // Micro dùng chung cho cả hai lớp: mở một lần, không giành micro giữa chừng.
    if (!(await this.openMic())) {
      this.report(
        "failed",
        "Không mở được micro cho cuộc gọi trực tiếp, vẫn gọi bằng kênh ghép nối.",
      );
      return;
    }
    this.statsTimer = setInterval(() => void this.pollStats(), RTC_STATS_MS);
    await this.peerStage();
    if (!this.closed && !this.live) await this.nativeStage();
  }

  private async openMic(): Promise<boolean> {
    if (this.mic) return true;
    try {
      const rtc = loadNative();
      const stream = await rtc?.mediaDevices?.getUserMedia?.(RTC_MEDIA);
      if (!stream) return false;
      this.mic = stream;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Lớp 1 — PeerJS: xin một mã máy từ máy chủ chào hỏi miễn phí của PeerJS, gửi
   * mã đó cho người thương qua kênh ghép nối, rồi để PeerJS tự lo phần còn lại
   * (nó tự đổi offer/answer/ICE và tự dùng TURN khi cần).
   */
  private async peerStage() {
    if (this.closed || this.live) return;
    const mod = loadPeer();
    if (!mod?.Peer) return;
    try {
      this.peer = new mod.Peer(undefined, {
        host: PEER_CLOUD.host,
        port: PEER_CLOUD.port,
        path: PEER_CLOUD.path,
        secure: PEER_CLOUD.secure,
        debug: 0,
        config: {
          iceServers: RTC_ICE_SERVERS,
          // Ưu tiên P2P: chỉ nhờ máy chủ trung chuyển khi không nối thẳng được.
          iceTransportPolicy: ICE_POLICY,
          sdpSemantics: "unified-plan",
        },
      });
    } catch {
      this.peer = null;
      return;
    }
    const peer = this.peer;
    try {
      peer.on?.("error", () => this.finishPeerWait());
      peer.on?.("call", (incoming: any) => void this.answerPeerCall(incoming));
      peer.on?.("open", (id: unknown) => {
        this.myPeerId = String(id ?? peer.id ?? "");
        if (!this.myPeerId) return;
        // Gửi mã máy qua kênh ghép nối (gửi lại vài lần cho chắc, mạng chợt mất).
        this.sendSignal("pid", { id: this.myPeerId, role: this.opts.role }, 2);
        this.tryPeerCall();
      });
    } catch {}
    await new Promise<void>((resolve) => {
      this.peerWait = resolve;
      this.peerTimer = setTimeout(() => this.finishPeerWait(), RTC_PEER_MS);
    });
    if (this.peerTimer) {
      clearTimeout(this.peerTimer);
      this.peerTimer = null;
    }
    if (this.live || this.closed) return;
    this.stopPeer();
  }

  private finishPeerWait() {
    const done = this.peerWait;
    this.peerWait = null;
    try {
      done?.();
    } catch {}
  }

  /** Bên gọi: đã có mã máy của người thương thì gọi thẳng qua PeerJS. */
  private tryPeerCall() {
    if (this.closed || this.live || this.peerMedia) return;
    if (this.opts.role !== "caller" || !this.peer || !this.remotePeerId) return;
    if (!this.myPeerId || !this.mic) return;
    try {
      this.watchPeerMedia(this.peer.call(this.remotePeerId, this.mic));
    } catch {}
  }

  /** Bên nghe: máy kia gọi tới thì nhấc máy bằng chính micro đang mở. */
  private async answerPeerCall(incoming: any) {
    if (this.closed || this.live || !incoming) return;
    if (!(await this.openMic())) return;
    try {
      incoming.answer(this.mic);
      this.watchPeerMedia(incoming);
    } catch {}
  }

  private watchPeerMedia(media: any) {
    if (!media || this.closed) return;
    this.peerMedia = media;
    const pc = media.peerConnection;
    if (pc) {
      // PeerJS tự đặt SDP nên chỉnh Opus ngay trên máy này: bật FEC (mất gói vẫn
      // nghe được) và tắt DTX (tiếng đi liên tục, không có khoảng lặng giả).
      const setLocal = pc.setLocalDescription?.bind?.(pc);
      if (setLocal) {
        pc.setLocalDescription = (desc: any) =>
          setLocal(desc?.sdp ? { ...desc, sdp: tuneOpusSdp(desc.sdp) } : desc);
      }
      pc.onconnectionstatechange = () => this.readPeerConnection(pc);
      pc.oniceconnectionstatechange = () => this.readPeerConnection(pc);
    }
    try {
      media.on?.("stream", () => this.readPeerConnection(pc));
      media.on?.("track", () => this.readPeerConnection(pc));
    } catch {}
    this.readPeerConnection(pc);
  }

  private readPeerConnection(pc: any) {
    if (this.closed) return;
    const state = String(pc?.connectionState ?? "");
    const ice = String(pc?.iceConnectionState ?? "");
    if (rtcStateIsLive(state) || rtcStateIsLive(ice)) this.markLive("PeerJS");
  }

  private markLive(engine: string) {
    if (this.live) return;
    this.live = true;
    this.lastAudioAt = Date.now();
    this.report("live", `Tiếng nét trực tiếp (${engine})`);
    this.finishPeerWait();
  }

  /** Dọn lớp PeerJS (mã máy + đường nối của nó), giữ nguyên micro đang mở. */
  private stopPeer() {
    this.stage = "native";
    this.peerMedia = null;
    const peer = this.peer;
    this.peer = null;
    this.myPeerId = "";
    try {
      peer?.destroy?.();
    } catch {}
  }

  /**
   * Lớp 2 — WebRTC tự nối, tín hiệu đi qua kênh ghép nối (như bản 1.14.0).
   */
  private async nativeStage() {
    if (this.closed || this.live) return;
    this.stage = "native";
    const rtc = loadNative();
    if (!rtc?.RTCPeerConnection) {
      this.report("failed", "Máy này không có WebRTC.");
      return;
    }
    const pc = new (rtc.RTCPeerConnection as new (config: unknown) => any)({
      iceServers: RTC_ICE_SERVERS,
      // Ưu tiên P2P: chỉ nhờ máy chủ trung chuyển khi không nối thẳng được.
      iceTransportPolicy: ICE_POLICY,
      // Giữ sẵn vài địa chỉ: mạng 4G đổi trạm hoặc Wi-Fi ↔ 4G thì có sẵn đường
      // mới để chuyển ngay, không phải chờ thu thập lại từ đầu.
      iceCandidatePoolSize: 6,
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
      for (const track of this.mic?.getAudioTracks?.() ?? [])
        pc.addTrack(track, this.mic);
    } catch {}
    // Hết thời gian chờ mà chưa nối trực tiếp được: vẫn gọi được bằng kênh
    // ghép nối, và nếu nối được muộn hơn thì tự chuyển sang tiếng trực tiếp.
    this.watchdog = setTimeout(() => {
      if (this.live || this.closed) return;
      this.report(
        "failed",
        "Chưa nối trực tiếp được, tiếng đang đi qua kênh ghép nối.",
      );
    }, RTC_TRY_MS);
    // Tín hiệu của máy kia tới sớm (máy kia đang chạy bản cũ) thì áp dụng ngay.
    const early = this.early.splice(0);
    for (const message of early) void this.handle(message);
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
      // Chỉnh Opus: bật FEC (mất gói vẫn nghe được) và tắt DTX (tiếng đi liên tục).
      const sdp = tuneOpusSdp(offer.sdp);
      await this.pc.setLocalDescription({ type: "offer", sdp });
      this.sendSignal("offer", { sdp }, 1);
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
      this.markLive("WebRTC");
      return;
    }
    if (rtcStateIsLost(state)) {
      this.fail("Đường tiếng trực tiếp bị ngắt.");
      return;
    }
    if (state === "disconnected" || ice === "disconnected") {
      if (this.dropTimer) return;
      // Mạng vừa chớp (4G đổi trạm, Wi-Fi ↔ 4G): thử nối lại NGAY trên cùng cuộc
      // gọi bằng ICE restart, vẫn chờ vài giây rồi mới quay về kênh ghép nối.
      try {
        this.pc?.restartIce?.();
      } catch {}
      try {
        this.peerMedia?.peerConnection?.restartIce?.();
      } catch {}
      this.dropTimer = setTimeout(() => {
        this.dropTimer = null;
        const now = String(this.pc?.connectionState ?? "");
        if (!rtcStateIsLive(now))
          this.fail("Mạng chập chờn, đã quay về kênh ghép nối.");
      }, RTC_DROP_MS);
    }
  }

  /** Đọc số liệu thật từ WebRTC: byte tiếng vào, byte tiếng ra. */
  private async pollStats() {
    const pc = this.pc ?? this.peerMedia?.peerConnection;
    if (!pc || this.closed) return;
    try {
      const report = await pc.getStats();
      let inBytes = 0;
      let outBytes = 0;
      report?.forEach?.((item: any) => {
        const kind = String(item?.kind ?? item?.mediaType ?? "");
        if (item?.type === "inbound-rtp" && kind === "audio")
          inBytes += Number(item.bytesReceived ?? 0);
        if (item?.type === "outbound-rtp" && kind === "audio")
          outBytes += Number(item.bytesSent ?? 0);
      });
      if (inBytes > 0 || outBytes > 0) this.lastAudioAt = Date.now();
      // Cường độ tiếng nói: ưu tiên audioLevel thật của WebRTC, không có thì
      // ước lượng theo lượng byte chảy qua (máy ảo thường không trả audioLevel).
      const now = Date.now();
      const span = Math.max(120, now - this.lastLevelAt);
      const measured = audioLevelFromReport(report);
      const level =
        measured.level === null
          ? audioLevelFromBytes(this.lastInBytes, inBytes, span)
          : { source: measured.source, level: measured.level };
      this.lastLevel = smoothLevel(this.lastLevel, level.level);
      this.lastLevelAt = now;
      this.lastInBytes = inBytes;
      this.opts.onStats?.({
        inBytes,
        outBytes,
        level: this.lastLevel,
        levelSource: level.source,
      });
      if (this.live && rtcAudioIsDead(Date.now(), this.lastAudioAt)) {
        this.fail(
          "Nối trực tiếp rồi mà không có tiếng, đã quay về đường tiếng qua kênh ghép nối.",
        );
      }
    } catch {}
  }

  private fail(detail: string) {
    if (this.live) this.opts.send(rtcPacket(this.opts.callId, "bye"), 0);
    this.live = false;
    this.report("failed", detail);
  }

  /** Nhận tín hiệu của máy kia (đã đi qua kênh ghép nối). */
  async handle(message: Signal) {
    await this.ready;
    if (this.closed) return;
    const sub = String(message?.sub ?? "");
    const sid = String(message?.sid ?? "");
    if (!sub || !sid) return;
    // Mã máy PeerJS của người thương: dùng được ngay cả khi lớp WebRTC chưa dựng.
    if (sub === "pid") {
      if (hasSignal(this.seen, sid)) return;
      this.seen = rememberSignal(this.seen, sid);
      this.remotePeerId = String(message.id ?? "");
      this.tryPeerCall();
      return;
    }
    // Đang thử lớp PeerJS: giữ lại tín hiệu WebRTC cũ để dùng khi hạ xuống lớp 2
    // (máy kia chạy bản cũ sẽ gửi offer/ICE ngay từ đầu).
    if (this.stage === "peer") {
      if (this.early.length < 40) this.early.push(message);
      return;
    }
    if (!this.pc) return;
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
          const sdp = tuneOpusSdp(answer.sdp);
          await this.pc.setLocalDescription({ type: "answer", sdp });
          this.sendSignal("answer", { sdp }, 1);
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

  /**
   * Người dùng bấm "nghe không được": chuyển ngay sang đường tiếng qua kênh
   * ghép nối, đồng thời báo máy kia cũng chuyển theo (gói "bye").
   */
  giveUp(detail: string) {
    if (!this.closed) this.sendSignal("bye", {}, 1);
    this.teardown();
    this.report("failed", detail);
  }

  /** Bật/tắt micro: tắt thì WebRTC gửi im lặng, máy kia vẫn thấy mình trong cuộc gọi. */
  setMic(on: boolean) {
    try {
      const tracks = this.mic?.getAudioTracks?.() ?? [];
      for (const track of tracks) track.enabled = Boolean(on);
    } catch {}
  }

  /** Dọn sạch tài nguyên native (mic, peer connection, các nhịp đếm). */
  private teardown() {
    this.closed = true;
    this.live = false;
    this.early = [];
    this.peerWait = null;
    if (this.watchdog) {
      clearTimeout(this.watchdog);
      this.watchdog = null;
    }
    if (this.dropTimer) {
      clearTimeout(this.dropTimer);
      this.dropTimer = null;
    }
    if (this.peerTimer) {
      clearTimeout(this.peerTimer);
      this.peerTimer = null;
    }
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
      this.statsTimer = null;
    }
    this.pending = [];
    try {
      this.peer?.destroy?.();
    } catch {}
    this.peer = null;
    this.peerMedia = null;
    try {
      for (const track of this.mic?.getTracks?.() ?? []) track.stop();
    } catch {}
    this.mic = null;
    try {
      this.pc?.close?.();
    } catch {}
    this.pc = null;
  }

  close() {
    if (this.closed) return;
    this.teardown();
    this.report("closed");
  }
}
