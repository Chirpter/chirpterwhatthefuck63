
// src/features/learning/hooks/useShadowingTracking.ts

import { useState, useCallback, useEffect, useRef } from 'react';

// ===== TYPE DEFINITIONS =====

interface WordTracking {
  word: string;
  score: number;
  errorTypes: string[];
}

interface SessionTracking {
  wordTracking: Map<string, WordTracking>;
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

// ===== SCORING CONSTANTS =====
const SCORE = {
  REPLAY: 0.2,
  REVEAL: 2.0,
  MISSING: 0.2,
  ERROR: 1.0,
  RESUBMIT: 1.0,
} as const;

const ATTENTION_THRESHOLD = 4.0;

// ===== MAIN HOOK =====

export const useShadowingTracking = (videoId: string | null) => {
  const [currentSessionIndex, setCurrentSessionIndex] = useState(-1);
  const [currentSession, setCurrentSession] = useState<SessionTracking>({
    wordTracking: new Map(),
  });
  const [needAttentionWords, setNeedAttentionWords] = useState<Map<string, WordTracking>>(new Map());
  const [errorStats, setErrorStats] = useState<ErrorStats>({
    correct: 0,
    omission: 0,
    spelling: 0,
    wrong_word: 0,
    insertion: 0,
    ending_sound: 0,
  });

  const sentenceScoreRef = useRef(0);

  // ===== LOAD FROM LOCALSTORAGE =====
  useEffect(() => {
    if (!videoId) return;

    try {
      const savedWords = localStorage.getItem(`shadowing-attention-${videoId}`);
      if (savedWords) {
        const parsed = JSON.parse(savedWords);
        setNeedAttentionWords(new Map(Object.entries(parsed)));
      }

      const savedStats = localStorage.getItem(`shadowing-stats-${videoId}`);
      if (savedStats) {
        setErrorStats(JSON.parse(savedStats));
      }
    } catch (e) {
      console.error('Failed to load tracking data', e);
    }
  }, [videoId]);

  // ===== PERSIST TO LOCALSTORAGE =====
  const persistData = useCallback(() => {
    if (!videoId) return;

    try {
      const wordsObj = Object.fromEntries(needAttentionWords);
      localStorage.setItem(`shadowing-attention-${videoId}`, JSON.stringify(wordsObj));
      localStorage.setItem(`shadowing-stats-${videoId}`, JSON.stringify(errorStats));
    } catch (e) {
      console.error('Failed to persist tracking data', e);
    }
  }, [videoId, needAttentionWords, errorStats]);

  // ===== BEHAVIOR TRACKING (PRE-SUBMIT) =====

  const onReplay = useCallback(() => {
    sentenceScoreRef.current += SCORE.REPLAY;
  }, []);

  const onReveal = useCallback(() => {
    sentenceScoreRef.current += SCORE.REVEAL;
  }, []);

  // ===== FIRST SUBMIT TO A SESSION =====

  const onFirstSubmit = useCallback((diffResult: DiffResult, sessionIndex: number) => {
    // If starting a new session, finalize previous session
    if (currentSessionIndex >= 0 && sessionIndex !== currentSessionIndex) {
      // Move words >= 4.0 from previous session to needAttentionWords
      currentSession.wordTracking.forEach((tracking) => {
        if (tracking.score >= ATTENTION_THRESHOLD) {
          setNeedAttentionWords(prev => new Map(prev).set(tracking.word, tracking));
        }
      });
      // Words < 4.0 are automatically discarded when session ends
    }

    // Start new session tracking
    setCurrentSessionIndex(sessionIndex);
    const newWordTracking = new Map<string, WordTracking>();

    // Track errors from diff result
    diffResult.original.forEach((segment) => {
      if ((segment.type === 'missing' || segment.type === 'incorrect') && !segment.text.match(/\s+/)) {
        const word = segment.text.trim().toLowerCase();
        if (!word) return;

        const baseScore = sentenceScoreRef.current;
        const errorScore = segment.type === 'missing' ? SCORE.MISSING : SCORE.ERROR;
        const totalScore = baseScore + errorScore;

        newWordTracking.set(word, {
          word,
          score: totalScore,
          errorTypes: [...diffResult.errorTypes],
        });

        // If score meets threshold, add to needAttentionWords immediately
        if (totalScore >= ATTENTION_THRESHOLD) {
          setNeedAttentionWords(prev => new Map(prev).set(word, {
            word,
            score: totalScore,
            errorTypes: [...diffResult.errorTypes],
          }));
        }
      }
    });

    setCurrentSession({ wordTracking: newWordTracking });

    // Update error stats
    setErrorStats(prev => {
      const next = { ...prev };
      diffResult.errorTypes.forEach(type => {
        if (type in next) next[type as keyof ErrorStats]++;
      });

      const correctCount = diffResult.original.filter(s => 
        s.type === 'correct' && !s.text.match(/\s+/)
      ).length;
      next.correct += correctCount;

      return next;
    });

    // Reset sentence score for next interaction
    sentenceScoreRef.current = 0;
    persistData();
  }, [currentSessionIndex, currentSession, persistData]);

  // ===== RESUBMIT TO CURRENT SESSION =====

  const onResubmit = useCallback((diffResult: DiffResult) => {
    setCurrentSession(prev => {
      const updatedWords = new Map(prev.wordTracking);

      diffResult.original.forEach((segment) => {
        if ((segment.type === 'missing' || segment.type === 'incorrect') && !segment.text.match(/\s+/)) {
          const word = segment.text.trim().toLowerCase();
          const existing = updatedWords.get(word);

          if (existing) {
            const newScore = existing.score + SCORE.RESUBMIT;
            existing.score = newScore;

            // If score now meets threshold, add to needAttentionWords
            if (newScore >= ATTENTION_THRESHOLD) {
              setNeedAttentionWords(prevNeed => new Map(prevNeed).set(word, existing));
            }
          }
        }
      });

      return { wordTracking: updatedWords };
    });

    setErrorStats(prev => {
      const next = { ...prev };
      diffResult.errorTypes.forEach(type => {
        if (type in next) next[type as keyof ErrorStats]++;
      });
      return next;
    });

    persistData();
  }, [persistData]);

  // ===== GET WORDS NEEDING ATTENTION FOR CURRENT SESSION =====

  const getWordsNeedingAttention = useCallback(() => {
    const words: Array<{ word: string; score: number; errorTypes: string[] }> = [];

    // Add words from current session that meet threshold
    currentSession.wordTracking.forEach((tracking) => {
      if (tracking.score >= ATTENTION_THRESHOLD) {
        words.push(tracking);
      }
    });

    return words;
  }, [currentSession]);

  // ===== CONFIRM WORD =====

  const confirmWord = useCallback((word: string, isHard: boolean) => {
    if (!isHard) {
      // User clicked "No" - reset score to remove from display
      setCurrentSession(prev => {
        const updated = new Map(prev.wordTracking);
        const existing = updated.get(word);
        if (existing) {
          existing.score = 0;
        }
        return { wordTracking: updated };
      });

      // Also remove from needAttentionWords if present
      setNeedAttentionWords(prev => {
        const updated = new Map(prev);
        updated.delete(word);
        return updated;
      });
    }
    // User clicked "Yes" - no action needed, word remains displayed
    // This is intentional to filter out false positives while keeping truly difficult words
    persistData();
  }, [persistData]);

  // ===== CHART DISPLAY (EVERY 10 SESSIONS) =====

  const shouldShowChart = useCallback((sessionIndex: number) => {
    return (sessionIndex + 1) % 10 === 0;
  }, []);

  return {
    onReplay,
    onReveal,
    onFirstSubmit,
    onResubmit,
    getWordsNeedingAttention,
    confirmWord,
    needAttentionWords: Array.from(needAttentionWords.values()),
    errorStats,
    shouldShowChart,
    currentSessionIndex,
  };
};
