/** Kiểu dữ liệu cho chatExtras.mjs (viết tay, khớp từng hàm). */
export type React = { me: string | null; them: string | null };
export type Reaction = { who: "me" | "them"; emoji: string };
export type PreviewMessage = {
  kind?: string;
  body?: string;
  recalledAt?: string | null;
  photo?: string | null;
  audio?: string | null;
};
export type LevelReport = { forEach?: (cb: (item: unknown) => void) => void };

export declare const REACTIONS: string[];
export declare const TYPING_HOLD_MS: number;
export declare const TYPING_SEND_MS: number;
export declare const REPLY_MAX: number;
export declare const LEVEL_GAIN: number;

export declare function emptyReact(): React;
export declare function normalizeReact(raw: unknown): React;
export declare function toggleReact(
  current: string | null | undefined,
  emoji: string | null | undefined,
): string | null;
export declare function setReact(
  message: Record<string, unknown> | null | undefined,
  side: "me" | "them",
  emoji: string | null | undefined,
): Record<string, unknown>;
export declare function reactList(react: unknown): Reaction[];
export declare function recallMessage(
  message: Record<string, unknown> | null | undefined,
  at?: string,
): Record<string, unknown>;
export declare function isRecalled(message: unknown): boolean;
export declare function recallText(mine: boolean): string;
export declare function replyPreview(message: PreviewMessage | null): string;
export declare function typingText(name: string): string;
export declare function audioLevelFromReport(report: LevelReport | null): {
  source: string;
  level: number | null;
};
export declare function audioLevelFromBytes(
  previousBytes: number,
  bytes: number,
  dtMs: number,
): { source: string; level: number };
export declare function smoothLevel(previous: number, next: number): number;
export declare function heartScale(level: number): number;
export declare function heartIdleScale(ms: number): number;
