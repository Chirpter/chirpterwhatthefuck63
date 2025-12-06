// src/features/learning/components/shadowing/WordBlockRenderer.tsx

"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import type { DiffSegment } from '@/services/diff-service';

interface WordBlockRendererProps {
  text: string;
  hideMode: 'block' | 'blur' | 'hidden';
  isRevealed: boolean;
  diff?: DiffSegment[] | null;
}

// SIMPLE COLOR SYSTEM for Diff Check
const DIFF_COLORS: { [key: string]: string } = {
  // Correct words - GREEN
  correct: 'text-foreground', // Normal text for correct words
  
  // Wrong words (ALL incorrect types) - RED
  incorrect: 'bg-red-500/20 text-red-800 dark:bg-red-900/40 dark:text-red-300 border border-red-300/30 rounded-[4px] px-1 mx-0.5',
  
  // Missing words - YELLOW
  missing: 'bg-yellow-500/20 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 border border-yellow-300/30 rounded-[4px] px-1 mx-0.5',
};

const WordBlockRenderer: React.FC<WordBlockRendererProps> = ({ 
  text, 
  hideMode, 
  isRevealed, 
  diff 
}) => {
  // If there's a diff result, show with SIMPLE color system
  if (diff) {
    return (
      <>
        {diff.map((segment, index) => {
          const isSpace = segment.text.match(/\s+/);
          
          // Don't highlight whitespace
          if (isSpace) {
            return <span key={index}>{segment.text}</span>;
          }

          return (
            <span
              key={index}
              className={cn(
                segment.type === 'incorrect' && DIFF_COLORS.incorrect,
                segment.type === 'missing' && DIFF_COLORS.missing
                // correct words use default text color (no highlight)
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