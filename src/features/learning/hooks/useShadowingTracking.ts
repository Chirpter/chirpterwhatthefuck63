// src/features/learning/hooks/useShadowingTracking.ts (REFACTORED)

import { useState, useCallback, useMemo, useEffect } from 'react';
import { SmartErrorTracker, type WordTracking } from '../services/smart-error-tracker';
import { convertDiffToErrors } from '../services/pattern-detection-helper';
import type { DiffSegment } from '../services/diff-service';

export interface ErrorStats {
  correct: number;
  omission: number;
  spelling: number;
  wrong_word: number;
  insertion: number;
  ending_sound: number;
  morphology: number;
}

export interface DiffResult {
  original: DiffSegment[];
  user: DiffSegment[];
  errorTypes: string[];
  isMatch: boolean;
}

interface LocalBehaviors {
  replayCount: number;
  wasRevealed: boolean;
  startTime: number;
}

/**
 * Simplified tracking hook - wrapper around SmartErrorTracker
 * 
 * Responsibilities:
 * - Track local behaviors (replay, reveal, time) per line
 * - Convert diff results to error format
 * - Delegate to SmartErrorTracker for aggregation
 * - Provide words needing attention for UI
 */
export const useShadowingTracking = (videoId: string | null) => {
  // Initialize tracker
  const [tracker] = useState<SmartErrorTracker | null>(() => 
    videoId ? new SmartErrorTracker(videoId) : null
  );

  // Local behavior tracking (reset per submission)
  const [localBehaviors, setLocalBehaviors] = useState<LocalBehaviors>({
    replayCount: 0,
    wasRevealed: false,
    startTime: Date.now(),
  });

  // Force re-render when tracker data changes
  const [updateTrigger, setUpdateTrigger] = useState(0);
  const triggerUpdate = useCallback(() => setUpdateTrigger(prev => prev + 1), []);

  // Reset local behaviors when video changes
  useEffect(() => {
    setLocalBehaviors({
      replayCount: 0,
      wasRevealed: false,
      startTime: Date.now(),
    });
  }, [videoId]);

  // Track replay
  const onReplay = useCallback(() => {
    setLocalBehaviors(prev => ({
      ...prev,
      replayCount: prev.replayCount + 1,
    }));
  }, []);

  // Track reveal
  const onReveal = useCallback(() => {
    setLocalBehaviors(prev => ({
      ...prev,
      wasRevealed: true,
    }));
  }, []);

  // Main submission handler
  const onSubmit = useCallback((
    diffResult: DiffResult,
    lineIndex: number,
    lineText: string
  ) => {
    if (!tracker) return;

    const timeSpent = (Date.now() - localBehaviors.startTime) / 1000;

    // Convert diff to errors
    const errors = convertDiffToErrors(diffResult, lineIndex, lineText);

    // Track submission
    tracker.trackSubmission(errors, {
      replayCount: localBehaviors.replayCount,
      wasRevealed: localBehaviors.wasRevealed,
      timeSpent,
    });

    // Reset local behaviors for next line
    setLocalBehaviors({
      replayCount: 0,
      wasRevealed: false,
      startTime: Date.now(),
    });

    // Trigger re-render
    triggerUpdate();
  }, [tracker, localBehaviors, triggerUpdate]);

  // Get words needing attention
  const getWordsNeedingAttention = useCallback((): WordTracking[] => {
    if (!tracker) return [];
    return tracker.getWordsNeedingAttention();
  }, [tracker, updateTrigger]); // Include updateTrigger to force recalculation

  // Dismiss word (false positive)
  const dismissWord = useCallback((word: string) => {
    if (!tracker) return;
    tracker.dismissWord(word);
    triggerUpdate();
  }, [tracker, triggerUpdate]);

  // Confirm word (is difficult)
  const confirmWord = useCallback((word: string) => {
    if (!tracker) return;
    tracker.confirmWord(word);
    triggerUpdate();
  }, [tracker, triggerUpdate]);

  // Restore dismissed word
  const restoreWord = useCallback((word: string) => {
    if (!tracker) return;
    tracker.restoreWord(word);
    triggerUpdate();
  }, [tracker, triggerUpdate]);

  // Compute error stats from all tracked words
  const errorStats = useMemo((): ErrorStats => {
    if (!tracker) {
      return {
        correct: 0,
        omission: 0,
        spelling: 0,
        wrong_word: 0,
        insertion: 0,
        ending_sound: 0,
        morphology: 0,
      };
    }

    const allWords = tracker.getAllStats();
    const stats: ErrorStats = {
      correct: 0,
      omission: 0,
      spelling: 0,
      wrong_word: 0,
      insertion: 0,
      ending_sound: 0,
      morphology: 0,
    };

    allWords.forEach(word => {
      Object.entries(word.errorBreakdown).forEach(([type, breakdown]) => {
        if (type === 'substitution') {
          stats.wrong_word += breakdown.count;
        } else if (type in stats) {
          stats[type as keyof ErrorStats] += breakdown.count;
        }
      });

      // Count correct occurrences (total - errors)
      const totalErrors = Object.values(word.errorBreakdown)
        .reduce((sum, b) => sum + b.count, 0);
      stats.correct += Math.max(0, word.totalOccurrences - totalErrors);
    });

    return stats;
  }, [tracker, updateTrigger]);

  // Show chart every 10 lines
  const shouldShowChart = useCallback((lineIndex: number) => {
    return (lineIndex + 1) % 10 === 0;
  }, []);

  return {
    onReplay,
    onReveal,
    onSubmit,
    getWordsNeedingAttention,
    dismissWord,
    confirmWord,
    restoreWord,
    errorStats,
    shouldShowChart,
  };
};