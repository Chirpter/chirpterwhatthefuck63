// src/features/learning/services/diff-service.ts
'use client';

export type DiffSegment = {
  text: string;
  type: 'correct' | 'incorrect' | 'missing' | 'extra';
};

interface DiffOptions {
  checkMode?: 'strict' | 'gentle';
}

/**
 * ✅ FIXED: Gentle mode bỏ qua punctuation-only differences
 */
const processWord = (word: string, mode: 'strict' | 'gentle'): string => {
  if (mode === 'gentle') {
    // Remove all punctuation and lowercase
    return word.toLowerCase().replace(/[.,!?;:'"\-—"""''`]/g, '');
  }
  // Strict: only remove problematic dashes
  return word.replace(/[—]/g, '');
};

/**
 * ✅ NEW: Check if a word is punctuation-only
 */
const isPunctuationOnly = (word: string): boolean => {
  return word.replace(/[.,!?;:'"\-—"""''`\s]/g, '').length === 0;
};

/**
 * Compares two strings and returns detailed diff
 */
export const getDiff = (
  originalText: string,
  userText: string,
  options: DiffOptions = { checkMode: 'gentle' }
): { original: DiffSegment[]; user: DiffSegment[]; isMatch: boolean; errorTypes: string[] } => {
  const mode = options.checkMode || 'gentle';
  
  // Split into words (preserve whitespace for reconstruction)
  const originalWords = originalText.split(/(\s+)/).filter(Boolean);
  const userWords = userText.split(/(\s+)/).filter(Boolean);

  // ✅ FIXED: In gentle mode, filter out punctuation-only words BEFORE processing
  const filteredOriginal = mode === 'gentle' 
    ? originalWords.filter(w => w.match(/\s+/) || !isPunctuationOnly(w))
    : originalWords;
    
  const filteredUser = mode === 'gentle'
    ? userWords.filter(w => w.match(/\s+/) || !isPunctuationOnly(w))
    : userWords;

  // Process words (lowercase, remove punctuation in gentle mode)
  const processedOriginal = filteredOriginal.map(w => 
    w.match(/\s+/) ? w : processWord(w, mode)
  );
  const processedUser = filteredUser.map(w => 
    w.match(/\s+/) ? w : processWord(w, mode)
  );

  const n = processedOriginal.length;
  const m = processedUser.length;

  // Initialize DP table for LCS
  const dp = Array(n + 1).fill(0).map(() => Array(m + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (processedOriginal[i - 1] === processedUser[j - 1]) {
        dp[i][j] = 1 + dp[i-1][j-1];
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const originalDiff: DiffSegment[] = [];
  const userDiff: DiffSegment[] = [];
  const errorTypes = new Set<string>();
  let i = n, j = m;

  // Backtrack to build diff
  while (i > 0 || j > 0) {
    const currentOriginal = i > 0 ? processedOriginal[i - 1] : '';
    const currentUser = j > 0 ? processedUser[j - 1] : '';

    if (i > 0 && j > 0 && currentOriginal === currentUser) {
      originalDiff.unshift({ text: filteredOriginal[i - 1], type: 'correct' });
      userDiff.unshift({ text: filteredUser[j - 1], type: 'correct' });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      if (!currentUser.match(/\s+/)) {
        userDiff.unshift({ text: filteredUser[j - 1], type: 'extra' });
        errorTypes.add('insertion');
      } else {
        userDiff.unshift({ text: filteredUser[j - 1], type: 'correct' });
      }
      j--;
    } else if (i > 0) {
      if (!currentOriginal.match(/\s+/)) {
        originalDiff.unshift({ text: filteredOriginal[i - 1], type: 'missing' });
        errorTypes.add('omission');
      } else {
        originalDiff.unshift({ text: filteredOriginal[i - 1], type: 'correct' });
      }
      i--;
    }
  }
  
  // Pair incorrect words
  let k = 0, l = 0;
  while (k < originalDiff.length && l < userDiff.length) {
    const orig = originalDiff[k];
    const user = userDiff[l];
    
    if (orig.type === 'missing' && user.type === 'extra') {
      orig.type = 'incorrect';
      user.type = 'incorrect';
      errorTypes.delete('omission');
      errorTypes.delete('insertion');
      errorTypes.add('wrong_word');
      
      // Spelling/morphology detection
      const origClean = orig.text.toLowerCase().replace(/[.,!?;:'"\-—"""''`]/g, '');
      const userClean = user.text.toLowerCase().replace(/[.,!?;:'"\-—"""''`]/g, '');
      
      if (origClean.length > 3 && userClean.length > 3 && origClean !== userClean) {
        const similarity = calculateSimilarity(origClean, userClean);
        if (similarity > 0.5) {
          errorTypes.add('spelling');
        }
      }
      
      // Morphology checks
      if (origClean.endsWith('s') && origClean.slice(0, -1) === userClean) {
        errorTypes.add('morphology');
      } else if (origClean.endsWith('ed') && origClean.slice(0, -2) === userClean) {
        errorTypes.add('morphology');
      } else if (origClean.endsWith('ing') && origClean.slice(0, -3) === userClean) {
        errorTypes.add('morphology');
      }
      
      k++;
      l++;
    } else if (orig.type === 'correct' && user.type === 'correct') {
      k++;
      l++;
    } else if (orig.type === 'missing') {
      k++;
    } else if (user.type === 'extra') {
      l++;
    }
  }

  const isMatch = errorTypes.size === 0;

  return { original: originalDiff, user: userDiff, isMatch, errorTypes: Array.from(errorTypes) };
};

// Helper functions
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

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
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}