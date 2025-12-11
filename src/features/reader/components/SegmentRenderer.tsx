
'use client';

import React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { Segment, PhraseMap, BilingualFormat, MultilingualContent } from '@/lib/types';

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

// Renders inline phrase-by-phrase: "Primary phrase (Secondary phrase)"
const renderPhrases = (
  phrases: PhraseMap[],
  displayLang1: string,
  displayLang2: string,
  isSegmentPlaying: boolean,
  spokenLang: string | null,
  speechBoundary: { charIndex: number, charLength: number } | null,
) => {
  return phrases.map((phrase, index) => {
    const primaryText = phrase[displayLang1];
    const secondaryText = displayLang2 !== 'none' ? phrase[displayLang2] : null;

    if (!primaryText) return null;

    const primaryContent = (isSegmentPlaying && spokenLang === displayLang1)
      ? getWordHighlightContent(primaryText, speechBoundary)
      : primaryText;

    const secondaryContent = secondaryText ? ((isSegmentPlaying && spokenLang === displayLang2)
      ? getWordHighlightContent(secondaryText, speechBoundary)
      : secondaryText) : null;
      
    return (
      <span key={index} className={cn("inline-block mr-1", isSegmentPlaying && 'tts-highlight')}>
        <span lang={displayLang1}>{primaryContent}</span>
        {secondaryContent && (
          <span className="text-muted-foreground text-[0.85em] font-light italic ml-1">({secondaryContent})</span>
        )}
      </span>
    );
  });
};

// Renders sentence-by-sentence:
// Monolingual: "Primary sentence."
// Bilingual: "Primary sentence." on one line, "Secondary sentence." on the line below.
const renderSentence = (
  content: MultilingualContent,
  displayLang1: string,
  displayLang2: string,
  isBilingualMode: boolean,
  isSegmentPlaying: boolean,
  spokenLang: string | null,
  speechBoundary: { charIndex: number, charLength: number } | null,
) => {
    const primaryText = content[displayLang1];
    if (!primaryText) return null;

    const primaryContent = (isSegmentPlaying && spokenLang === displayLang1)
      ? getWordHighlightContent(primaryText, speechBoundary)
      : primaryText;
      
    const secondaryText = isBilingualMode && displayLang2 !== 'none' ? content[displayLang2] : null;
    const secondaryContent = (secondaryText && isSegmentPlaying && spokenLang === displayLang2) 
      ? getWordHighlightContent(secondaryText, speechBoundary) 
      : secondaryText;

    if (isBilingualMode) {
      return (
        <span className={cn('inline', isSegmentPlaying && 'tts-highlight')}>
          <span className="block" lang={displayLang1}>{primaryContent}</span>
          {secondaryContent && <span className="block text-muted-foreground italic text-[0.9em] mt-1" lang={displayLang2}>{secondaryContent}</span>}
        </span>
      );
    }

    // Monolingual mode
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
  const bilingualFormat = segment.metadata.bilingualFormat;

  const renderContent = () => {
    // If format is phrase, use phrase renderer
    if (isBilingualMode && bilingualFormat === 'phrase' && Array.isArray(segment.content)) {
      return renderPhrases(segment.content as PhraseMap[], displayLang1, displayLang2, isSegmentPlaying, spokenLang, speechBoundary);
    }
    // Otherwise, fall back to rendering the full sentence content
    if (typeof segment.content === 'object' && !Array.isArray(segment.content)) {
      return renderSentence(segment.content as MultilingualContent, displayLang1, displayLang2, isBilingualMode, isSegmentPlaying, spokenLang, speechBoundary);
    }
    return null;
  };
  
  const primaryText = (Array.isArray(segment.content) ? segment.content[0]?.[displayLang1] : (segment.content as MultilingualContent)[displayLang1]) || '';

  switch (segment.type) {
    case 'heading':
      return (
        <h3 data-segment-id={segment.id} className={cn(
          isSegmentPlaying && 'tts-highlight', 
          "text-2xl font-bold mt-2 mb-2 font-headline", 
          "dark:text-gray-200"
        )}>
            {renderContent()}
        </h3>
      );
    
    case 'blockquote':
        return (
            <blockquote data-segment-id={segment.id} className={cn(isSegmentPlaying && 'tts-highlight', "my-4 w-full")}>
                {renderContent()}
            </blockquote>
        );
    
    case 'list_item':
        return (
            <li data-segment-id={segment.id} className={cn(isSegmentPlaying && 'tts-highlight', 'w-full')}>
                {renderContent()}
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
        return <span data-segment-id={segment.id}>{renderContent()}</span>;
    
    default:
        return null;
  }
};
