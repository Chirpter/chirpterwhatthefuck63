
// src/features/learning/types/tracking.types.ts
import { z } from 'zod';
import type { AnalyzeShadowingInput, AnalyzeShadowingOutput } from './analysis.types';

export const AnalyzeShadowingInputSchema = z.object({
  originalText: z.string(),
  userTranscript: z.string(),
  errorTypes: z.array(z.string()),
  playCount: z.number(),
  editCount: z.number(),
});

export const AnalyzeShadowingOutputSchema = z.object({
  insight: z.string().describe("A single, concise, and encouraging sentence providing specific feedback."),
  encouragement: z.string().optional().describe("An optional encouraging follow-up sentence."),
  suggestions: z.array(z.string()).optional().describe("A short list of actionable suggestions for improvement."),
});

// Type aliases for external use
export type { AnalyzeShadowingInput, AnalyzeShadowingOutput };


export interface WordInteractions {
  missingCount: number;
  errorCount: number;
  replayCount: number;
  revealCount: number;
  submitCount: number;
}

export interface WordTracking {
  word: string;
  positions: number[];
  score: number;
  interactions: WordInteractions;
  errorTypes: Set<string>;
}

export interface SentenceTracking {
  score: number;
  replayCount: number;
  revealCount: number;
  submitCount: number;
}

export interface ActiveTracking {
  boxIndex: number;
  sentenceTracking: SentenceTracking;
  wordTracking: Map<string, WordTracking>;
  pendingConfirm: Set<string>;
}

export interface NeedAttentionWord {
  word: string;
  firstSeenBox: number;
  totalScore: number;
  errorTypes: string[];
}

export interface ErrorStats {
  correct: number;
  omission: number;
  spelling: number;
  wrong_word: number;
  insertion: number;
  ending_sound: number;
}

export interface DiffResult {
  original: Array<{ text: string; type: string }>;
  user: Array<{ text: string; type: string }>;
  errorTypes: string[];
  isMatch: boolean;
}
