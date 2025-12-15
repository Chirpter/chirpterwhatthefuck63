// src/features/reader/components/SegmentRenderer.tsx

'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { Segment, ContentUnit } from '@/lib/types';

interface SegmentRendererProps {
  segment: Segment;
  isPlaying?: boolean;
  speechBoundary?: { charIndex: number, charLength: number } | null;
  spokenLang?: string | null;
  isBilingualMode: boolean;
  displayLang1: string;
  displayLang2: string; // 'none' or language code
  unit: ContentUnit;
}

/**
 * Parses a string with simple markdown (bold, italic, strikethrough) and returns an array of React nodes.
 * @param text The string to parse.
 * @returns A React fragment containing the parsed elements.
 */
const parseSimpleMarkdown = (text: string): React.ReactNode => {
    // Regex to capture **bold**, *italic*, or ~~strikethrough~~ text
    const regex = /(\*\*.*?\*\*|\*.*?\*|~~.*?~~)/g;
    const parts = text.split(regex);

    return (
        <>
            {parts.map((part, index) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={index}>{part.slice(2, -2)}</strong>;
                }
                if (part.startsWith('*') && part.endsWith('*')) {
                    return <em key={index}>{part.slice(1, -1)}</em>;
                }
                if (part.startsWith('~~') && part.endsWith('~~')) {
                    return <s key={index}>{part.slice(2, -2)}</s>;
                }
                return part;
            })}
        </>
    );
};

const getWordHighlightContent = (text: string, boundary: { charIndex: number, charLength: number } | null): React.ReactNode => {
    if (boundary) {
      const { charIndex, charLength } = boundary;
      if (charIndex <= text.length) {
        const pre = text.substring(0, charIndex);
        const highlighted = text.substring(charIndex, charIndex + charLength);
        const post = text.substring(charIndex + charLength);
        
        return (
          <>
            {parseSimpleMarkdown(pre)}
            <span className="tts-word-highlight">{parseSimpleMarkdown(highlighted)}</span>
            {parseSimpleMarkdown(post)}
          </>
        );
      }
    }
    return parseSimpleMarkdown(text);
};

const renderSegmentContent = (
  segment: Segment,
  displayLang1: string,
  displayLang2: string,
  isBilingualMode: boolean,
  isSegmentPlaying: boolean,
  spokenLang: string | null,
  speechBoundary: { charIndex: number, charLength: number } | null,
  unit: ContentUnit
) => {
  const { content } = segment;

  // --- NEW: BI-PHRASE MODE RENDERING ---
  if (isBilingualMode && unit === 'phrase') {
      const primaryPhrases = content[displayLang1];
      const secondaryPhrases = content[displayLang2];
      
      if (!Array.isArray(primaryPhrases)) {
          // Fallback if data is not in phrase format
          return <span className="text-destructive">Error: Phrase data format expected.</span>;
      }

      return (
        <span className={cn('inline', isSegmentPlaying && 'tts-highlight')}>
            {primaryPhrases.map((phrase, index) => {
                const secondaryPhrase = Array.isArray(secondaryPhrases) ? secondaryPhrases[index] : '';
                return (
                    <span key={index} className="inline mr-1">
                        {parseSimpleMarkdown(phrase)}
                        {secondaryPhrase && (
                            <span className="text-muted-foreground italic text-[0.9em] ml-1">
                                ({parseSimpleMarkdown(secondaryPhrase)})
                            </span>
                        )}
                        {' '}
                    </span>
                );
            })}
        </span>
      );
  }

  // --- EXISTING SENTENCE/MONOLINGUAL MODE RENDERING ---
  const renderContentForLang = (lang: string) => {
      const langContent = content[lang];
      if (!langContent || Array.isArray(langContent)) return null;

      const isThisLangPlaying = isSegmentPlaying && spokenLang === lang;
      
      return (
          <span className={cn(!isBilingualMode && isSegmentPlaying && "tts-highlight")}>
              {isThisLangPlaying ? getWordHighlightContent(langContent, speechBoundary) : parseSimpleMarkdown(langContent)}
          </span>
      );
  };

  const primaryContent = renderContentForLang(displayLang1);
  if (!primaryContent) return null;

  if (isBilingualMode) {
      const secondaryContent = renderContentForLang(displayLang2);
      return (
        <span className={cn('inline-block w-full', isSegmentPlaying && 'tts-highlight')}>
            <span className="block" lang={displayLang1}>{primaryContent}</span>
            {secondaryContent && <span className="block text-muted-foreground italic text-[0.9em] mt-1" lang={displayLang2}>{secondaryContent}</span>}
        </span>
      );
  }

  // Monolingual
  return (
    <span className={cn(isSegmentPlaying && 'tts-highlight')}>
      {primaryContent}
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
    unit
}) => {
  
  const isSegmentPlaying = isPlaying;

  const renderMainContent = () => renderSegmentContent(segment, displayLang1, displayLang2, isBilingualMode, isSegmentPlaying, spokenLang, speechBoundary, unit);
  
  return <span data-segment-id={segment.id}>{renderMainContent()}</span>;
};
