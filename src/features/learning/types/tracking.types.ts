// src/features/learning/types/tracking.types.ts (CLEANED)

export interface ErrorStats {
  correct: number;
  omission: number;
  spelling: number;
  wrong_word: number;
  insertion: number;
  ending_sound: number;
  morphology?: number;
}

export interface DiffResult {
  original: Array<{ text: string; type: string }>;
  user: Array<{ text: string; type: string }>;
  errorTypes: string[];
  isMatch: boolean;
}