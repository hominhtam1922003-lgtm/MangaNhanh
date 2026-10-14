// Kiểu dữ liệu cho tín hiệu cuộc gọi tiếng trực tiếp (hàm thật ở rtcSignal.mjs).
export type RtcState = "off" | "trying" | "live" | "failed" | "closed";
export declare const RTC_TRY_MS: number;
export declare const RTC_RETRY_SIGNAL_MS: number;
export declare const RTC_SIGNAL_KEEP: number;
export declare const RTC_DROP_MS: number;
export declare const RTC_ICE_SERVERS: { urls: string | string[] }[];
export declare const RTC_MEDIA: {
  audio: {
    echoCancellation: boolean;
    noiseSuppression: boolean;
    autoGainControl: boolean;
  };
  video: boolean;
};
export declare const RTC_SUBS: string[];
export declare function signalFingerprint(value: unknown): string;
export declare function signalId(
  callId: unknown,
  sub: unknown,
  extra?: { sdp?: unknown; candidate?: unknown },
): string;
export declare function rtcPacket(
  callId: unknown,
  sub: unknown,
  extra?: { sdp?: unknown; candidate?: unknown },
): {
  kind: string;
  event: string;
  callId: string;
  sub: string;
  sid: string;
  sdp?: unknown;
  candidate?: unknown;
};
export declare function isRtcPacket(message: unknown): boolean;
export declare function hasSignal(
  seen: string[] | undefined,
  sid: unknown,
): boolean;
export declare function rememberSignal(
  seen: string[] | undefined,
  sid: unknown,
  keep?: number,
): string[];
export declare function rtcWaitingTooLong(
  now: number,
  startedAt: number,
  limit?: number,
): boolean;
export declare function rtcStateIsLive(state: unknown): boolean;
export declare function rtcStateIsLost(state: unknown): boolean;
export declare function rtcStatusText(state: unknown): string;
