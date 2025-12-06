
"use client";

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface ContextSentencesProps {
  context: string;
  searchTerm: string;
  currentSentence: string; // This prop is kept for interface consistency but the logic now relies on context
}

export const ContextSentences: React.FC<ContextSentencesProps> = ({
  context,
  searchTerm,
  currentSentence,
}) => {
  const highlightedContent = useMemo(() => {
    const textToHighlight = context || currentSentence;
    if (!textToHighlight) {
      return null;
    }
    if (!searchTerm.trim()) {
      return <span>{textToHighlight}</span>;
    }

    const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(\\b${escapedSearchTerm}\\b)`, 'gi');
    const parts = textToHighlight.split(regex);

    return (
      <>
        {parts.map((part, index) =>
          regex.test(part) ? (
            <mark 
              key={index} 
              className="bg-primary/20 text-primary font-medium px-0.5 rounded border border-primary/30"
            >
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  }, [context, searchTerm, currentSentence]);


  return (
    <p className="text-sm text-muted-foreground break-words select-text line-clamp-2">
      {highlightedContent}
    </p>
  );
};
