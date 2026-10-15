export const PET_MAX_ENERGY: number;
export const PET_DAILY_EXP_GOAL: number;
export const PET_BASE_LEVEL_EXP: number;
export const PET_DECAY_INTERVAL_MS: number;
export const PET_EXP_REWARDS: {
  room: number;
  feed: number;
  bath: number;
  sleep: number;
  poke: number;
  gift: number;
  chat: number;
  call: number;
};
export const PET_SPEECH_BUBBLES: string[];
export const PET_GIFTS: {
  id: string;
  emoji: string;
  label: string;
  text: string;
}[];

export type PetState = {
  name: string;
  species: "duck" | "cat";
  totalExp: number;
  todayExp: number;
  meTodayExp?: number;
  partnerTodayExp?: number;
  todayDate: string;
  energy: number;
  hunger: number;
  cleanliness: number;
  affection: number;
  sleeping: boolean;
  quoteIndex: number;
  lastAction: string;
  lastActionBy: "me" | "partner";
  lastActionAt: number;
  updatedAt: number;
};

export function petDayKey(now?: number): string;
export function levelExpRequirement(level?: number): number;
export function computeLevelProgress(totalExp?: number): {
  level: number;
  levelExp: number;
  levelGoal: number;
  levelProgressRatio: number;
};
export function defaultPet(now?: number): PetState;
export function normalizePet(raw: unknown, now?: number): PetState;
export function applyBiologicalDecay(
  pet: unknown,
  now?: number,
): {
  hunger: number;
  cleanliness: number;
  affection: number;
  decayCycles: number;
};
export function buildPetReminderText(pet: unknown, now?: number): string;
export function mergePet(
  localPet: unknown,
  remotePet: unknown,
  now?: number,
): PetState;
export function interactPet(
  current: unknown,
  action: string,
  by?: "me" | "partner",
  now?: number,
  extra?: { species?: "duck" | "cat"; name?: string },
): PetState;
export function computePetStatus(
  state: unknown,
  now?: number,
): {
  pet: PetState;
  level: number;
  levelExp: number;
  levelGoal: number;
  levelProgressRatio: number;
  todayExp: number;
  dailyGoal: number;
  progressRatio: number;
  decayCycles: number;
  energy: number;
  energyIcons: string;
  mood: string;
  moodLabel: string;
  speech: string;
  todayChats: number;
  todayCalls: number;
};
