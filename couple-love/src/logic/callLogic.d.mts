// Kiểu dữ liệu cho trạng thái cuộc gọi (hàm thật nằm trong callLogic.mjs).
export type CallInfo = {
  id: string;
  role: "caller" | "callee";
  name: string;
  phase: "ringing" | "active" | "ended";
  at: number;
  startedAt: number;
  endedAt: number;
  reason: string;
  minimized: boolean;
  micOn: boolean;
  /** Cuộc gọi có bật hình (Video Call) hay gọi thoại thường. */
  video?: boolean;
  /** Trạng thái bật/tắt camera trong cuộc gọi. */
  camOn?: boolean;
  /** Trạng thái bật/tắt loa ngoài (Speakerphone). */
  speakerOn?: boolean;
  /** Mốc cuối cùng còn nghe được nhịp "còn đây" của máy kia. */
  lastSeen: number;
};
export declare const CALL_RING_TIMEOUT_MS: number;
export declare const CALL_ALIVE_MS: number;
export declare const CALL_SILENT_END_MS: number;
export declare function newCall(input: {
  id: string;
  role: "caller" | "callee";
  name?: string;
  video?: boolean;
  at?: number;
}): CallInfo;
export declare function callEvent(
  call: CallInfo | null,
  event: { type: string; on?: boolean; min?: boolean },
  now?: number,
): CallInfo | null;
export declare function callTimedOut(
  call: CallInfo | null,
  now?: number,
): boolean;
export declare function ringTimedOut(
  call: CallInfo | null,
  now?: number,
): boolean;
export declare function callSeconds(
  call: CallInfo | null,
  now?: number,
): number;
export declare function callClock(seconds: number): string;
