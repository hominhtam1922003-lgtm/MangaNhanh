export declare const PAIR_CODE_LENGTH: number;
export declare const PAIR_ALPHABET: string;
export declare function normalizePairCode(value: unknown): string;
export declare function isValidPairCode(value: unknown): boolean;
export declare function formatPairCode(value: unknown): string;
export type PairGateScreen = "login" | "code" | "paired" | "offline";
export type PairGate = {
  screen: PairGateScreen;
  allowRelay: boolean;
  clearCached: boolean;
  reason: string;
};
export declare function pairGate(input?: {
  hasConfig?: boolean;
  session?: boolean;
  checked?: boolean;
  partnerId?: string | null;
  secret?: string | null;
  cachedPair?: boolean;
  error?: string | null;
}): PairGate;
export declare function gateReasonText(
  gate: PairGate | null | undefined,
): string;
export declare function accountSummary(account: unknown): string;
