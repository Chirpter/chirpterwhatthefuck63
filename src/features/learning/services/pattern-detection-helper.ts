// src/features/learning/services/pattern-detection-helper.ts

import type { DiffSegment } from './diff-service';
import type { DetectedError } from './smart-error-tracker';

/**
 * Convert diff result to DetectedError format for SmartErrorTracker
 * This bridges the gap between diff-service output and error tracking input
 */
export function convertDiffToErrors(
  diffResult: {
    original: DiffSegment[];
    user: DiffSegment[];
    errorTypes: string[];
  },
  lineIndex: number,
  fullLineText?: string
): DetectedError[] {
  const errors: DetectedError[] = [];
  const errorTypesSet = new Set(diffResult.errorTypes);

  // Process original (what should have been said)
  diffResult.original.forEach((segment, idx) => {
    if (segment.type === 'missing' || segment.type === 'incorrect') {
      const word = segment.text.trim();
      if (!word || word.match(/\s+/)) return;

      // Determine error type and confidence
      let errorType = 'substitution';
      let confidence = 0.8;

      if (segment.type === 'missing') {
        errorType = 'omission';
        confidence = 0.85;
      } else if (errorTypesSet.has('spelling')) {
        errorType = 'spelling';
        confidence = 0.7;
      } else if (errorTypesSet.has('ending_sound')) {
        errorType = 'morphology';
        confidence = 0.75;
      } else if (errorTypesSet.has('wrong_word')) {
        errorType = 'substitution';
        confidence = 0.8;
      }

      // Get context (word after, if exists)
      let context: string | undefined;
      if (errorType === 'omission' && fullLineText) {
        const wordIndex = fullLineText.toLowerCase().indexOf(word.toLowerCase());
        if (wordIndex !== -1) {
          const afterText = fullLineText.slice(wordIndex + word.length).trim();
          const nextWord = afterText.split(/\s+/)[0];
          if (nextWord) {
            context = nextWord;
          }
        }
      }

      errors.push({
        word,
        type: errorType,
        confidence,
        lineIndex,
        context,
      });
    }
  });

  // Process user input for insertions
  diffResult.user.forEach((segment) => {
    if (segment.type === 'extra') {
      const word = segment.text.trim();
      if (!word || word.match(/\s+/)) return;

      errors.push({
        word,
        type: 'insertion',
        confidence: 0.6,
        lineIndex,
      });
    }
  });

  return errors;
}

/**
 * Calculate similarity between two words (for spelling detection)
 * Returns value between 0 and 1
 */
export function calculateSimilarity(word1: string, word2: string): number {
  const longer = word1.length > word2.length ? word1 : word2;
  const shorter = word1.length > word2.length ? word2 : word1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Levenshtein distance algorithm
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Check if a word is likely a morphological variant
 * (e.g., "study" vs "studying", "walk" vs "walked")
 */
export function isMorphologicalVariant(word1: string, word2: string): boolean {
  const w1 = word1.toLowerCase();
  const w2 = word2.toLowerCase();

  // Check common endings
  const endings = ['s', 'ed', 'ing', 'es', 'er', 'est'];
  
  for (const ending of endings) {
    if (w1.endsWith(ending) && w1.slice(0, -ending.length) === w2) {
      return true;
    }
    if (w2.endsWith(ending) && w2.slice(0, -ending.length) === w1) {
      return true;
    }
  }

  // Check for doubling (e.g., "run" vs "running")
  if (w1.length > 3 && w2.length > 3) {
    for (const ending of ['ing', 'ed']) {
      if (w1.endsWith(ending)) {
        const base = w1.slice(0, -ending.length);
        if (base.length > 0 && base[base.length - 1] === base[base.length - 2]) {
          const singleBase = base.slice(0, -1);
          if (singleBase === w2) return true;
        }
      }
      if (w2.endsWith(ending)) {
        const base = w2.slice(0, -ending.length);
        if (base.length > 0 && base[base.length - 1] === base[base.length - 2]) {
          const singleBase = base.slice(0, -1);
          if (singleBase === w1) return true;
        }
      }
    }
  }

  return false;
}