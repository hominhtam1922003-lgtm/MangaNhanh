export declare const ACCOUNT_PROJECT_URL: string;
export declare const ACCOUNT_PROJECT_KEY: string;
export type ResolvedAccountConfig = {
  url: string;
  key: string;
  source: "build" | "env";
};
export declare function resolveAccountConfig(
  envUrl?: unknown,
  envKey?: unknown,
): ResolvedAccountConfig | null;
export declare function accountConfig(): ResolvedAccountConfig | null;
