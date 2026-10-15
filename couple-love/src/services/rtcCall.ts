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
  METERED_ICE_SERVERS,
  PEER_CLOUD,
  RTC_DROP_MS,
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
  round?: unknown;
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
  MediaStream?: new () => any;
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

/**
 * Địa chỉ IP nội bộ `10.0.2.x` của máy ảo Android (LDPlayer / QEMU / AVD):
 * mỗi máy ảo đều có đúng IP `10.0.2.15` trong mạng ảo riêng của nó, nên nếu gửi
 * địa chỉ `typ host` này sang máy kia thì máy kia sẽ tự bắn gói tin vào chính
 * mình thay vì đi qua máy chủ TURN `couple-love.metered.live`.
 */
export function isEmulatorLoopbackHost(candidateText: string): boolean {
  return (
    /\b10\.0\.2\.\d+\b/.test(candidateText) &&
    /\btyp\s+host\b/i.test(candidateText)
  );
}

/**
 * Cấu hình STUN/TURN chính thức của Metered.ca cho RTCPeerConnection.
 */
const METERED_STANDARD_ICE_SERVERS = [
  {
    urls: "stun:stun.relay.metered.ca:80",
  },
  {
    urls: "turn:global.relay.metered.ca:80",
    username: "5cddad6cdc6b69bdedd42c87",
    credential: "nYuBOYJvrOiMo6IG",
  },
  {
    urls: "turn:global.relay.metered.ca:80?transport=tcp",
    username: "5cddad6cdc6b69bdedd42c87",
    credential: "nYuBOYJvrOiMo6IG",
  },
  {
    urls: "turn:global.relay.metered.ca:443",
    username: "5cddad6cdc6b69bdedd42c87",
    credential: "nYuBOYJvrOiMo6IG",
  },
  {
    urls: "turns:global.relay.metered.ca:443?transport=tcp",
    username: "5cddad6cdc6b69bdedd42c87",
    credential: "nYuBOYJvrOiMo6IG",
  },
];

function primaryIceServers() {
  return METERED_STANDARD_ICE_SERVERS.length
    ? METERED_STANDARD_ICE_SERVERS
    : METERED_ICE_SERVERS;
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
  private stage: "peer" | "native" = "native";
  private early: Signal[] = [];
  private peerWait: (() => void) | null = null;
  private mic: any = null;
  private closed = false;
  private live = false;
  private forcedRelay = false;
  private round = 1;
  private lastOfferSdp = "";
  private lastAnswerSdp = "";
  private localCandidates: {
    candidate: string;
    sdpMid: unknown;
    sdpMLineIndex: unknown;
  }[] = [];
  private state: RtcState = "off";
  private seen: string[] = [];
  private pending: any[] = [];
  private dropTimer: ReturnType<typeof setTimeout> | null = null;
  private watchdog: ReturnType<typeof setTimeout> | null = null;
  private offerRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private candidateSyncTimer: ReturnType<typeof setTimeout> | null = null;
  private peerTimer: ReturnType<typeof setTimeout> | null = null;
  private statsTimer: ReturnType<typeof setInterval> | null = null;
  /** Mức tiếng nói đã làm mượt + mốc byte lần trước (cho trái tim đập). */
  private lastLevel = 0;
  private lastLevelAt = 0;
  private lastInBytes = 0;
  private lastAudioAt = 0;
  private readonly micReady: Promise<boolean>;
  private signalChain: Promise<void> = Promise.resolve();

  constructor(private readonly opts: Options) {
    this.micReady = this.openMic();
    void this.setup();
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
    this.report("trying", "Đang nối tiếng trực tiếp (WebRTC + TURN riêng)…");
    // Micro dùng chung cho cả hai lớp: mở một lần, không giành micro giữa chừng.
    if (!(await this.micReady)) {
      this.report(
        "failed",
        "Không mở được micro cho cuộc gọi trực tiếp, vẫn gọi bằng kênh ghép nối.",
      );
      return;
    }
    if (this.closed) return;
    this.statsTimer = setInterval(() => void this.pollStats(), RTC_STATS_MS);
    // Mở ngay kết nối WebRTC + cụm TURN riêng (couple-love.metered.live) qua kênh
    // ghép nối đã thông sẵn; KHÔNG mở PeerJS cùng lúc để tránh 2 RTCPeerConnection
    // tranh nhau micro và cổng TURN trên cùng máy Android.
    await this.nativeStage(false);
  }

  private async openMic(): Promise<boolean> {
    if (this.mic) return true;
    const rtc = loadNative();
    try {
      const stream = await rtc?.mediaDevices?.getUserMedia?.(RTC_MEDIA);
      if (stream) {
        this.mic = stream;
        return true;
      }
    } catch {}
    // Máy ảo LDPlayer thứ hai trên cùng PC không gắn micro (hoặc Windows đang
    // khoá mic cho cửa sổ kia): vẫn tạo luồng rỗng để WebRTC kết nối trực tiếp
    // và nghe được tiếng của bên kia.
    try {
      if (rtc?.MediaStream) {
        this.mic = new rtc.MediaStream();
        return true;
      }
    } catch {}
    return false;
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
    const cleanId =
      "mmy" +
      String(this.opts.callId).replace(/[^a-zA-Z0-9]/g, "") +
      (this.opts.role === "caller" ? "a" : "b") +
      Math.random().toString(36).slice(2, 7);
    try {
      this.peer = new mod.Peer(cleanId, {
        host: PEER_CLOUD.host,
        port: PEER_CLOUD.port,
        path: PEER_CLOUD.path,
        secure: PEER_CLOUD.secure,
        debug: 0,
        config: {
          iceServers: primaryIceServers(),
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
    if (this.watchdog) {
      clearTimeout(this.watchdog);
      this.watchdog = null;
    }
    if (this.offerRetryTimer) {
      clearTimeout(this.offerRetryTimer);
      this.offerRetryTimer = null;
    }
    if (this.candidateSyncTimer) {
      clearTimeout(this.candidateSyncTimer);
      this.candidateSyncTimer = null;
    }
    if (engine === "WebRTC") this.stopPeer();
    else if (this.pc) {
      try {
        this.pc.onicecandidate = null;
        this.pc.onconnectionstatechange = null;
        this.pc.oniceconnectionstatechange = null;
        this.pc.close?.();
      } catch {}
      this.pc = null;
    }
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
  private async nativeStage(forceRelay = false) {
    if (this.closed || this.live) return;
    this.stage = "native";
    const rtc = loadNative();
    if (!rtc?.RTCPeerConnection) {
      this.report("failed", "Máy này không có WebRTC.");
      return;
    }
    if (this.pc) {
      try {
        this.pc.onicecandidate = null;
        this.pc.onconnectionstatechange = null;
        this.pc.oniceconnectionstatechange = null;
        this.pc.close?.();
      } catch {}
      this.pc = null;
    }
    this.pending = [];
    this.localCandidates = [];
    this.lastOfferSdp = "";
    this.lastAnswerSdp = "";
    const relayOnly = "relay" as const;
    const iceServers = [
      {
        urls: "stun:stun.relay.metered.ca:80",
      },
      {
        urls: "turn:global.relay.metered.ca:80",
        username: "5cddad6cdc6b69bdedd42c87",
        credential: "nYuBOYJvrOiMo6IG",
      },
      {
        urls: "turn:global.relay.metered.ca:80?transport=tcp",
        username: "5cddad6cdc6b69bdedd42c87",
        credential: "nYuBOYJvrOiMo6IG",
      },
      {
        urls: "turn:global.relay.metered.ca:443",
        username: "5cddad6cdc6b69bdedd42c87",
        credential: "nYuBOYJvrOiMo6IG",
      },
      {
        urls: "turns:global.relay.metered.ca:443?transport=tcp",
        username: "5cddad6cdc6b69bdedd42c87",
        credential: "nYuBOYJvrOiMo6IG",
      },
    ];
    const config = forceRelay
      ? {
          iceServers,
          iceTransportPolicy: relayOnly,
          iceCandidatePoolSize: 6,
          bundlePolicy: "max-bundle",
          rtcpMuxPolicy: "require",
        }
      : {
          iceServers,
          // Ưu tiên P2P: chỉ nhờ máy chủ trung chuyển khi không nối thẳng được.
          iceTransportPolicy: ICE_POLICY,
          // Giữ sẵn vài địa chỉ: mạng 4G đổi trạm hoặc Wi-Fi ↔ 4G thì có sẵn đường
          // mới để chuyển ngay, không phải chờ thu thập lại từ đầu.
          iceCandidatePoolSize: 6,
          bundlePolicy: "max-bundle",
          rtcpMuxPolicy: "require",
        };
    const pc = new (rtc.RTCPeerConnection as new (cfg: unknown) => any)(config);
    this.pc = pc;
    pc.onicecandidate = (event: any) => {
      const candidate = event?.candidate;
      if (!candidate?.candidate || this.closed) return;
      const text = String(candidate.candidate);
      if (isEmulatorLoopbackHost(text)) return;
      const item = {
        candidate: text,
        sdpMid: candidate.sdpMid ?? null,
        sdpMLineIndex: candidate.sdpMLineIndex ?? null,
      };
      if (this.localCandidates.length < 32) this.localCandidates.push(item);
      // Gửi từng địa chỉ 1 lần lúc thu thập (tránh dồn hàng chục gói làm nghẽn
      // MQTT), các địa chỉ TURN/STUN quan trọng sẽ được đồng bộ nhắc sau 1,2 giây.
      this.sendSignal(
        "ice",
        {
          round: this.round,
          candidate: item,
        },
        0,
      );
    };
    pc.onconnectionstatechange = () => this.readConnection();
    pc.oniceconnectionstatechange = () => this.readConnection();
    try {
      const tracks = this.mic?.getAudioTracks?.() ?? [];
      if (tracks.length > 0) {
        for (const track of tracks) pc.addTrack(track, this.mic);
      } else {
        pc.addTransceiver?.("audio", { direction: "recvonly" });
      }
    } catch {}
    if (this.watchdog) clearTimeout(this.watchdog);
    // Hết thời gian chờ đợt 1 mà chưa nối trực tiếp được: thử ép đi 100% qua
    // máy chủ trung chuyển TURN (couple-love.metered.live) cho trường hợp 2 máy
    // ảo LDPlayer hoặc NAT chặn P2P; hết đợt 2 mới quay về kênh ghép nối.
    this.watchdog = setTimeout(
      () => {
        if (this.live || this.closed) return;
        const iceState = String(this.pc?.iceConnectionState ?? "");
        const connState = String(this.pc?.connectionState ?? "");
        // Đang trong bước bắt tay DTLS/ICE ("checking" / "connecting") thì cho
        // thêm 3 giây để hoàn tất thay vì cắt ngang làm đứt kết nối sắp thành.
        if (
          !this.forcedRelay &&
          (iceState === "checking" || connState === "connecting")
        ) {
          this.forcedRelay = true;
          this.resendLocalCandidates();
          this.watchdog = setTimeout(() => {
            if (this.live || this.closed) return;
            this.round += 1;
            this.report(
              "trying",
              "Đang nối qua máy chủ trung chuyển TURN riêng…",
            );
            void this.nativeStage(true);
          }, 3000);
          return;
        }
        if (!this.forcedRelay) {
          this.forcedRelay = true;
          this.round += 1;
          this.report(
            "trying",
            "Đang nối qua máy chủ trung chuyển TURN riêng…",
          );
          void this.nativeStage(true);
          return;
        }
        void this.peerStage();
        this.report(
          "failed",
          "Chưa nối trực tiếp được, tiếng đang đi qua kênh ghép nối.",
        );
      },
      forceRelay ? RTC_TRY_MS + 2500 : RTC_TRY_MS,
    );
    this.scheduleCandidateSync();
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
      this.lastOfferSdp = sdp;
      this.sendSignal("offer", { sdp, round: this.round }, 1);
      this.scheduleOfferRetry();
    } catch {
      this.report("failed", "Không tạo được lời mời nối trực tiếp.");
    }
  }

  private scheduleOfferRetry() {
    if (this.offerRetryTimer) clearTimeout(this.offerRetryTimer);
    if (this.closed || this.live) return;
    this.offerRetryTimer = setTimeout(() => {
      if (this.closed || this.live || !this.pc || !this.lastOfferSdp) return;
      if (this.pc.signalingState !== "have-local-offer") return;
      this.sendSignal(
        "offer",
        { sdp: this.lastOfferSdp, round: this.round },
        0,
      );
      this.resendLocalCandidates();
      this.scheduleOfferRetry();
    }, 1200);
  }

  private resendLocalCandidates() {
    // Ưu tiên gửi lại địa chỉ TURN (typ relay) và STUN (typ srflx) trước.
    const sorted = [...this.localCandidates].sort((a, b) => {
      const score = (text: string) =>
        /\btyp\s+relay\b/i.test(text)
          ? 0
          : /\btyp\s+srflx\b/i.test(text)
            ? 1
            : 2;
      return score(a.candidate) - score(b.candidate);
    });
    for (const candidate of sorted.slice(0, 10)) {
      this.sendSignal("ice", { round: this.round, candidate }, 0);
    }
  }

  private scheduleCandidateSync() {
    if (this.candidateSyncTimer) clearTimeout(this.candidateSyncTimer);
    if (this.closed || this.live) return;
    this.candidateSyncTimer = setTimeout(() => {
      if (this.closed || this.live || !this.pc) return;
      this.resendLocalCandidates();
    }, 1300);
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
      if (!this.forcedRelay && !this.live) {
        this.forcedRelay = true;
        this.round += 1;
        this.report("trying", "Đang nối qua máy chủ trung chuyển TURN riêng…");
        void this.nativeStage(true);
        return;
      }
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
    if (this.closed) return;
    const sub = String(message?.sub ?? "");
    const sid = String(message?.sid ?? "");
    if (!sub || !sid) return;
    // Mã máy PeerJS của người thương: dùng được ngay cả khi lớp WebRTC chưa dựng.
    if (sub === "pid") {
      if (hasSignal(this.seen, sid)) return;
      this.seen = rememberSignal(this.seen, sid);
      this.remotePeerId = String(message.id ?? "");
      if (this.myPeerId) {
        this.sendSignal("pid", { id: this.myPeerId, role: this.opts.role }, 0);
      }
      await this.micReady;
      this.tryPeerCall();
      return;
    }
    // Chưa dựng xong RTCPeerConnection (hoặc đang ở bước chuẩn bị): giữ lại tín
    // hiệu để áp dụng ngay khi lớp 2 mở xong, không bao giờ làm rơi gói đến sớm.
    if (this.stage === "peer" || !this.pc) {
      if (this.early.length < 40) this.early.push(message);
      return;
    }
    this.signalChain = this.signalChain
      .then(() => this.applySignal(message))
      .catch(() => {});
    await this.signalChain;
  }

  private async applySignal(message: Signal) {
    if (this.closed || !this.pc) return;
    const sub = String(message?.sub ?? "");
    const sid = String(message?.sid ?? "");
    if (!sub || !sid) return;
    const msgRound = Number(message?.round ?? 1);
    if (
      sub === "offer" &&
      Number.isFinite(msgRound) &&
      msgRound > this.round &&
      !this.live
    ) {
      this.forcedRelay = true;
      this.round = msgRound;
      await this.nativeStage(true);
    }
    // Nếu bên gọi gửi lại cùng một lời mời (do gói trả lời bị rớt trên MQTT),
    // bên nghe gửi lại ngay gói answer + danh sách địa chỉ ICE của mình.
    if (hasSignal(this.seen, sid)) {
      if (sub === "offer" && this.lastAnswerSdp && !this.live) {
        this.sendSignal(
          "answer",
          { sdp: this.lastAnswerSdp, round: this.round },
          0,
        );
        this.resendLocalCandidates();
      }
      return;
    }
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
        this.seen = rememberSignal(this.seen, sid);
        await this.flushPending();
        if (this.mic) {
          const answer = await this.pc.createAnswer();
          const sdp = tuneOpusSdp(answer.sdp);
          await this.pc.setLocalDescription({ type: "answer", sdp });
          this.lastAnswerSdp = sdp;
          this.sendSignal("answer", { sdp, round: this.round }, 1);
          this.resendLocalCandidates();
        }
        return;
      }
      if (sub === "answer") {
        if (this.pc.signalingState !== "have-local-offer") return;
        if (this.offerRetryTimer) {
          clearTimeout(this.offerRetryTimer);
          this.offerRetryTimer = null;
        }
        await this.pc.setRemoteDescription(
          new (
            loadNative()!.RTCSessionDescription as new (value: unknown) => any
          )({
            type: "answer",
            sdp: String(message.sdp ?? ""),
          }),
        );
        this.seen = rememberSignal(this.seen, sid);
        await this.flushPending();
        this.resendLocalCandidates();
        return;
      }
      if (sub === "ice") {
        const candidate = message.candidate as { candidate?: unknown } | null;
        if (!candidate?.candidate) return;
        const text = String(candidate.candidate);
        if (isEmulatorLoopbackHost(text)) return;
        const ice = new (
          loadNative()!.RTCIceCandidate as new (value: unknown) => any
        )(candidate);
        this.seen = rememberSignal(this.seen, sid);
        // Chưa có mô tả của máy kia thì giữ lại, thêm sau (nếu không sẽ lỗi).
        if (!this.pc.remoteDescription) {
          this.pending.push(ice);
          return;
        }
        await this.pc.addIceCandidate(ice);
        return;
      }
      if (sub === "bye") {
        this.seen = rememberSignal(this.seen, sid);
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
    if (this.offerRetryTimer) {
      clearTimeout(this.offerRetryTimer);
      this.offerRetryTimer = null;
    }
    if (this.candidateSyncTimer) {
      clearTimeout(this.candidateSyncTimer);
      this.candidateSyncTimer = null;
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
    this.localCandidates = [];
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
