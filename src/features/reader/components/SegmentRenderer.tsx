// src/features/reader/components/SegmentRenderer.tsx

'use client';

import React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { Segment, PhraseMap } from '@/lib/types';

interface SegmentRendererProps {
  segment: Segment;
  isPlaying?: boolean;
  speechBoundary?: { charIndex: number, charLength: number } | null;
  spokenLang?: string | null;
  isBilingualMode: boolean;
  displayLang1: string;
  displayLang2: string; // 'none' or language code
}

const getWordHighlightContent = (text: string, boundary: { charIndex: number, charLength: number } | null): React.ReactNode => {
    if (boundary) {
      const { charIndex, charLength } = boundary;
      if (charIndex <= text.length) {
        return (
          <>
            {text.substring(0, charIndex)}
            <span className="tts-word-highlight">{text.substring(charIndex, charIndex + charLength)}</span>
            {text.substring(charIndex + charLength)}
          </>
        );
      }
    }
    return text;
};

// This function now handles all rendering logic, using the metadata flag.
const renderSegmentContent = (
  segment: Segment,
  displayLang1: string,
  displayLang2: string,
  isBilingualMode: boolean,
  isSegmentPlaying: boolean,
  spokenLang: string | null,
  speechBoundary: { charIndex: number, charLength: number } | null,
) => {
  const { content, metadata } = segment;
  const { bilingualFormat } = metadata;

  // Render as inline phrases: "Primary (Secondary)"
  if (isBilingualMode && bilingualFormat === 'phrase') {
    return (content as PhraseMap[]).map((phrase, index) => {
      const primaryText = phrase[displayLang1];
      const secondaryText = displayLang2 !== 'none' ? phrase[displayLang2] : null;

      if (!primaryText) return null;

      const isThisPhraseBlockPlaying = isSegmentPlaying; // Highlight whole block for phrases for now

      return (
        <span key={index} className={cn("inline-block mr-1", isThisPhraseBlockPlaying && 'tts-highlight')}>
          <span lang={displayLang1}>{primaryText}</span>
          {secondaryText && (
            <span className="text-muted-foreground text-[0.85em] font-light italic ml-1">({secondaryText})</span>
          )}
        </span>
      );
    });
  }
  
  // Render as sentences (either stacked bilingual or monolingual)
  const sentenceMap = (content as PhraseMap[])[0]; // Sentence mode always has one item in the array
  if (!sentenceMap) return null;

  const primaryText = sentenceMap[displayLang1];
  if (!primaryText) return null;

  const primaryContent = (isSegmentPlaying && spokenLang === displayLang1)
    ? getWordHighlightContent(primaryText, speechBoundary)
    : primaryText;

  if (isBilingualMode) {
    const secondaryText = displayLang2 !== 'none' ? sentenceMap[displayLang2] : null;
    const secondaryContent = (secondaryText && isSegmentPlaying && spokenLang === displayLang2) 
      ? getWordHighlightContent(secondaryText, speechBoundary) 
      : secondaryText;
    
    return (
      <span className={cn('inline', isSegmentPlaying && 'tts-highlight')}>
        <span className="block" lang={displayLang1}>{primaryContent}</span>
        {secondaryContent && <span className="block text-muted-foreground italic text-[0.9em] mt-1" lang={displayLang2}>{secondaryContent}</span>}
      </span>
    );
  }

  // Default: Monolingual sentence mode
  return (
    <span className={cn(isSegmentPlaying && 'tts-highlight')}>
      <span lang={displayLang1}>{primaryContent}</span>
      {' '}
    </span>
  );
};


export const SegmentRenderer: React.FC<SegmentRendererProps> = ({ 
    segment, 
    isPlaying = false,
    speechBoundary,
    spokenLang,
    isBilingualMode,
    displayLang1,
    displayLang2,
}) => {
  
  const isSegmentPlaying = isPlaying;

  const renderMainContent = () => renderSegmentContent(segment, displayLang1, displayLang2, isBilingualMode, isSegmentPlaying, spokenLang, speechBoundary);
  
  const primaryText = segment.content[0]?.[displayLang1] || '';

  switch (segment.type) {
    case 'heading':
      return (
        <h3 data-segment-id={segment.id} className={cn(
          isSegmentPlaying && 'tts-highlight', 
          "text-2xl font-bold mt-2 mb-2 font-headline", 
          "dark:text-gray-200"
        )}>
            {renderMainContent()}
        </h3>
      );
    
    case 'blockquote':
        return (
            <blockquote data-segment-id={segment.id} className={cn(isSegmentPlaying && 'tts-highlight', "my-4 w-full")}>
                {renderMainContent()}
            </blockquote>
        );
    
    case 'list_item':
        return (
            <li data-segment-id={segment.id} className={cn(isSegmentPlaying && 'tts-highlight', 'w-full')}>
                {renderMainContent()}
            </li>
        );

    case 'image':
      return (
        <div data-segment-id={segment.id} className="my-4 w-full">
          <Image
            src={primaryText}
            alt={"content image"}
            width={500}
            height={300}
            className="mx-auto rounded-md shadow-md"
          />
        </div>
      );

    case 'text':
    case 'dialog':
        return <span data-segment-id={segment.id}>{renderMainContent()}</span>;
    
    default:
        return null;
  }
};
