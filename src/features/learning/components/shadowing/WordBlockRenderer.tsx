// src/features/learning/components/shadowing/WordBlockRenderer.tsx (ENHANCED)

"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import type { DiffSegment } from '@/features/learning/services/diff-service';

interface WordBlockRendererProps {
  text: string;
  hideMode: 'block' | 'blur' | 'hidden';
  isRevealed: boolean;
  diff?: DiffSegment[] | null;
  showCorrect?: boolean; // ✨ Deprecated - green always shown for consistency
  checkMode?: 'strict' | 'gentle'; // ✨ NEW: Hide punctuation errors in gentle mode
}

// ✨ ENHANCED COLOR SYSTEM - Always show green for correct words in diff mode
const DIFF_COLORS = {
  // Correct words - subtle green background (always, not just when showCorrect=true)
  correct: 'bg-green-500/10 text-foreground rounded-sm px-0.5',
  
  // Wrong words (ALL incorrect types) - RED
  incorrect: 'bg-red-500/20 text-red-800 dark:bg-red-900/40 dark:text-red-300 border border-red-300/30 rounded-[4px] px-1 mx-0.5',
  
  // Missing words - YELLOW
  missing: 'bg-yellow-500/20 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 border border-yellow-300/30 rounded-[4px] px-1 mx-0.5',
  
  // Extra words - BLUE (insertions)
  extra: 'bg-blue-500/20 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-300/30 rounded-[4px] px-1 mx-0.5',
};

const WordBlockRenderer: React.FC<WordBlockRendererProps> = ({ 
  text, 
  hideMode, 
  isRevealed, 
  diff,
  showCorrect = false,
  checkMode = 'gentle',
}) => {
  // ✨ Helper: Check if difference is only punctuation/capitalization
  const isPunctuationOnly = (segment: DiffSegment): boolean => {
    if (checkMode === 'strict') return false; // Strict mode shows all errors
    
    // Check if text is only punctuation/whitespace
    const cleaned = segment.text.replace(/[.,!?;:'"\-—"""''`\s]/g, '');
    return cleaned.length === 0;
  };

  // If there's a diff result, show with color system
  if (diff) {
    return (
      <>
        {diff.map((segment, index) => {
          const isSpace = segment.text.match(/\s+/);
          
          // Don't highlight whitespace
          if (isSpace) {
            return <span key={index}>{segment.text}</span>;
          }

          // ✨ GENTLE MODE: Don't highlight punctuation-only differences
          if ((segment.type === 'incorrect' || segment.type === 'missing' || segment.type === 'extra') 
              && isPunctuationOnly(segment)) {
            return <span key={index} className="text-foreground">{segment.text}</span>;
          }

          // ✨ CONSISTENT: Always show green for correct words
          if (segment.type === 'correct') {
            return (
              <span
                key={index}
                className={DIFF_COLORS.correct}
              >
                {segment.text}
              </span>
            );
          }

          // Error highlighting
          return (
            <span
              key={index}
              className={cn(
                segment.type === 'incorrect' && DIFF_COLORS.incorrect,
                segment.type === 'missing' && DIFF_COLORS.missing,
                segment.type === 'extra' && DIFF_COLORS.extra
              )}
            >
              {segment.text}
            </span>
          );
        })}
      </>
    );
  }

  // Original hide/reveal logic when no diff result
  if (hideMode !== 'block' || isRevealed) {
    return <>{text}</>;
  }

  // Hide words with background (only for words, not whitespace)
  const words = text.split(/(\s+)/);
  return (
    <>
      {words.map((part, index) => {
        if (part.match(/\s+/)) {
          return <span key={index}>{part}</span>;
        }
        return (
          <span 
            key={index}
            style={{ display: 'inline-block' }}
            className="bg-gray-300 dark:bg-gray-600 text-transparent rounded-[3px] select-none"
          >
            {part}
          </span>
        );
      })}
    </>
  );
};

export default React.memo(WordBlockRenderer);