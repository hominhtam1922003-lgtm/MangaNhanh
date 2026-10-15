export type PetState = {
  name: string;
  species: "duck" | "cat";
  totalExp: number;
  todayExp: number;
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

export declare const PET_MAX_ENERGY: number;
export declare const PET_DAILY_EXP_GOAL: number;
export declare const PET_SPEECH_BUBBLES: string[];
export declare const PET_GIFTS: {
  id: string;
  emoji: string;
  label: string;
  text: string;
}[];

export declare function petDayKey(now?: number): string;
export declare function defaultPet(now?: number): PetState;
export declare function normalizePet(raw: unknown, now?: number): PetState;
export declare function mergePet(
  localPet: unknown,
  remotePet: unknown,
  now?: number,
): PetState;
export declare function interactPet(
  current: unknown,
  action: string,
  by?: "me" | "partner",
  now?: number,
  extra?: { species?: string; name?: string },
): PetState;
export declare function computePetStatus(
  state: unknown,
  now?: number,
): {
  pet: PetState;
  level: number;
  todayExp: number;
  dailyGoal: number;
  progressRatio: number;
  energy: number;
  energyIcons: string;
  mood: string;
  moodLabel: string;
  speech: string;
  todayChats: number;
  todayCalls: number;
};
