// src/features/reader/components/shared/SegmentRenderer.tsx

"use client";

import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import type { Segment, ContentUnit, LanguageBlock } from '@/lib/types';
import { useAudioPlayer } from '@/contexts/audio-player-context';

interface SegmentRendererProps {
  segment: Segment;
  isBilingualMode: boolean;
  displayLang1: string;
  displayLang2: string; // 'none' or language code
  unit: ContentUnit;
}

/**
 * Reconstructs the final markdown string from a segment object based on display settings.
 * @param segment - The structured segment object.
 * @param displayLang1 - The primary language to display.
 * @param displayLang2 - The secondary language to display ('none' if monolingual).
 * @param unit - The unit for bilingual display ('sentence' or 'phrase').
 * @returns A markdown-ready string.
 */
function reconstructMarkdown(
    segment: Segment,
    displayLang1: string,
    displayLang2: string,
    unit: ContentUnit
): string {
    const prefix = segment.content[0] as string;
    const langBlock = segment.content[1] as LanguageBlock;
    const suffix = segment.content[2] as string;

    const primaryText = langBlock[displayLang1] || '';
    const secondaryText = langBlock[displayLang2] || '';

    if (displayLang2 !== 'none' && secondaryText) {
        if (unit === 'phrase') {
            return `${prefix}${primaryText} (${secondaryText})${suffix}`;
        }
        // Default to sentence mode
        return `${prefix}${primaryText}${suffix}\n\n<em class="text-muted-foreground">${secondaryText}</em>`;
    }

    // Monolingual mode
    return `${prefix}${primaryText}${suffix}`;
}


export const SegmentRenderer: React.FC<SegmentRendererProps> = ({ 
    segment, 
    isBilingualMode,
    displayLang1,
    displayLang2,
    unit
}) => {
  const finalMarkdown = reconstructMarkdown(
    segment, 
    displayLang1, 
    isBilingualMode ? displayLang2 : 'none', 
    unit
  );

  return (
    <div data-segment-id={segment.id}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{finalMarkdown}</ReactMarkdown>
    </div>
  );
};
