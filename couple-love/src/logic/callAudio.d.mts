export declare const CALL_FRAME_MS: number;
export declare const CALL_QUEUE_MAX: number;
export declare const CALL_SILENT_BYTES: number;
export declare const CALL_PREBUFFER: number;
export declare const CALL_PLAY_GAP_MS: number;
export declare const CALL_CLOSE_MS: number;
export type AudioFrame = {
  seq: number;
  uri?: string;
  bytes?: number;
  at?: number;
};
export declare function newAudioQueue(): AudioFrame[];
export declare function frameBytesFor(bitRate: number, ms?: number): number;
export declare function pushFrame(
  queue: AudioFrame[] | undefined,
  frame: Partial<AudioFrame> | null | undefined,
  max?: number,
): AudioFrame[];
export declare function takeFrame(
  queue: AudioFrame[] | undefined,
  now: number,
  lastAt: number,
  gap?: number,
): { frame: AudioFrame | null; queue: AudioFrame[] };
export declare function queueSize(queue: AudioFrame[] | undefined): number;
export declare function frameUsable(bytes: unknown, micOn?: boolean): boolean;
export declare function frameIsSilent(bytes: unknown): boolean;
export declare function callLogText(
  call: { startedAt?: number; phase?: string; role?: string; reason?: string },
  now?: number,
): string;
export declare function isMissedCall(call: unknown): boolean;
export declare function callBarText(
  call: { phase?: string; role?: string; startedAt?: number; reason?: string },
  now?: number,
): string;
