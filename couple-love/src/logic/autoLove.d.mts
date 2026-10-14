// Kiểu dữ liệu cho nhắc nhở & lời yêu tự động (hàm thật trong autoLove.mjs).
export type WaitingNotice = {
  key: string;
  stage: string;
  title: string;
  body: string;
};
export declare const QUIET_FROM_HOUR: number;
export declare const QUIET_TO_HOUR: number;
export declare const LOVE_EVERY_MS: number;
export declare const WAIT_NUDGE_MS: number;
export declare const WAIT_HOUR_MS: number;
export declare const WAIT_NUDGE_TEXT: string;
export declare const WAIT_NUDGE_TITLE: string;
export declare function isQuietTime(when: number | Date): boolean;
export declare function unansweredMessage(messages: unknown[]): {
  id: string;
  createdAt: string;
} | null;
export declare function waitingNotice(input: {
  messages: unknown[];
  now?: number;
  lastNotice?: { key: string; stage: string; at: number } | null;
  quiet?: boolean;
  enabled?: boolean;
}): WaitingNotice | null;
export declare function dueLoveNote(input: {
  now?: number;
  lastAt?: number;
  quiet?: boolean;
  enabled?: boolean;
}): boolean;
export declare function minutesToNextLoveNote(input: {
  now?: number;
  lastAt?: number;
}): number;
