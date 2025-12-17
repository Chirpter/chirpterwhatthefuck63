// src/features/reader/components/shared/SegmentRenderer.tsx

'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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

const WordHighlight: React.FC<{ text: string; boundary: { charIndex: number, charLength: number } | null }> = ({ text, boundary }) => {
    if (boundary) {
        const { charIndex, charLength } = boundary;
        if (charIndex <= text.length) {
            const pre = text.substring(0, charIndex);
            const highlighted = text.substring(charIndex, charIndex + charLength);
            const post = text.substring(charIndex + charLength);
            
            return (
                <>
                    {pre}
                    <span className="tts-word-highlight">{highlighted}</span>
                    {post}
                </>
            );
        }
    }
    return <>{text}</>;
};

const ContentRenderer: React.FC<{ text: string; boundary?: { charIndex: number, charLength: number } | null }> = ({ text, boundary }) => {
    const content = boundary ? <WordHighlight text={text} boundary={boundary} /> : text;
    // Use ReactMarkdown to render any markdown within the content (like bold, italic)
    return <ReactMarkdown remarkPlugins={[remarkGfm]}>{content as string}</ReactMarkdown>;
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
  const { content, type } = segment;
  const primaryText = content[displayLang1] as string || '';
  const secondaryText = content[displayLang2] as string || '';

  // --- Monolingual Mode ---
  if (!isBilingualMode) {
    if (!primaryText) return null;
    const boundary = isSegmentPlaying ? speechBoundary : null;
    return <ContentRenderer text={primaryText} boundary={boundary} />;
  }

  // --- Bilingual Sentence Mode ---
  if (unit === 'sentence') {
    return (
      <>
        <div lang={displayLang1} className={cn("mb-1", isSegmentPlaying && spokenLang === displayLang1 && 'tts-highlight')}>
            <ContentRenderer text={primaryText} boundary={isSegmentPlaying && spokenLang === displayLang1 ? speechBoundary : null} />
        </div>
        {secondaryText && (
          <div lang={displayLang2} className={cn('text-muted-foreground italic text-[0.9em]', isSegmentPlaying && spokenLang === displayLang2 && 'tts-highlight')}>
            <ContentRenderer text={secondaryText} boundary={isSegmentPlaying && spokenLang === displayLang2 ? speechBoundary : null} />
          </div>
        )}
      </>
    );
  }
  
  // --- Fallback for other units or default behavior ---
  return <ContentRenderer text={primaryText} />;
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
  const Wrapper = segment.type === 'heading1' ? 'h1' : 'div';
  
  const blockClass = segment.type === 'heading1' 
    ? 'font-headline text-3xl mt-4 mb-6 border-b pb-2' 
    : (isBilingualMode && unit === 'sentence') 
      ? 'block-segment mb-4' 
      : 'inline';

  return (
    <Wrapper data-segment-id={segment.id} className={cn(blockClass)}>
      {renderSegmentContent(
        segment, 
        displayLang1, 
        displayLang2, 
        isBilingualMode, 
        isPlaying, 
        spokenLang, 
        speechBoundary, 
        unit
      )}
      {segment.type !== 'heading1' && unit === 'sentence' && !isBilingualMode && ' '}
    </Wrapper>
  );
};
