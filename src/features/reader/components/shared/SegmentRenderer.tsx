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

// This component now trusts that the content is clean and relies on type for structure.
const ContentRenderer: React.FC<{ text: string; boundary?: { charIndex: number, charLength: number } | null }> = ({ text, boundary }) => {
    if (boundary) {
        return <WordHighlight text={text} boundary={boundary} />;
    }
    // Use ReactMarkdown for any potential inline markdown like bold/italic
    return <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>;
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
  
  // ✅ NEW LOGIC: Use the 'type' to determine the wrapper component (h1, p, etc.)
  const Wrapper = type === 'heading1' ? 'h1' : 'span';
  const wrapperClasses = type === 'heading1' 
    ? "font-headline text-3xl mt-4 mb-6 border-b pb-2" 
    : "inline";

  // --- Monolingual Mode ---
  if (!isBilingualMode) {
    const monolingualText = content[displayLang1] as string || '';
    if (!monolingualText) return null;
    
    return (
      <Wrapper className={cn(wrapperClasses, isSegmentPlaying && 'tts-highlight')} lang={displayLang1}>
        <ContentRenderer text={monolingualText} boundary={isSegmentPlaying ? speechBoundary : null} />
        {type === 'text' && ' '}
      </Wrapper>
    );
  }

  // --- Bilingual Sentence Mode ---
  if (unit === 'sentence') {
    const primaryText = content[displayLang1] as string || '';
    const secondaryText = content[displayLang2] as string || '';
    
    return (
      <Wrapper className={wrapperClasses}>
        <div lang={displayLang1} className={cn("mb-1", isSegmentPlaying && spokenLang === displayLang1 && 'tts-highlight')}>
            <ContentRenderer text={primaryText} boundary={isSegmentPlaying && spokenLang === displayLang1 ? speechBoundary : null} />
        </div>
        {secondaryText && (
          <div lang={displayLang2} className={cn('text-muted-foreground italic text-[0.9em]', isSegmentPlaying && spokenLang === displayLang2 && 'tts-highlight')}>
            <ContentRenderer text={secondaryText} boundary={isSegmentPlaying && spokenLang === displayLang2 ? speechBoundary : null} />
          </div>
        )}
      </Wrapper>
    );
  }

  // --- Bilingual Phrase Mode ---
  if (unit === 'phrase') {
      const primaryPhrases = content[displayLang1] as string[] || [];
      const secondaryPhrases = content[displayLang2] as string[] || [];

      return (
        <Wrapper className={cn(wrapperClasses, isSegmentPlaying && 'tts-highlight')}>
            {primaryPhrases.map((phrase, index) => {
                const secondaryPhrase = secondaryPhrases[index] || '';
                return (
                    <span key={index} className="inline whitespace-nowrap mr-1">
                        <ContentRenderer text={phrase} />
                        {secondaryPhrase && (
                            <span className="text-muted-foreground italic text-[0.9em] ml-1">
                                (<ContentRenderer text={secondaryPhrase} />)
                            </span>
                        )}
                        {' '}
                    </span>
                );
            })}
        </Wrapper>
      );
  }
  
  return null;
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
  // Use div for block-level elements like headings or sentence pairs
  const Wrapper = (segment.type === 'heading1' || (isBilingualMode && unit === 'sentence')) ? 'div' : 'span';
  
  // Add a specific class for block-level segments for styling if needed
  const blockClass = Wrapper === 'div' ? 'block-segment mb-4' : '';

  return (
    <Wrapper data-segment-id={segment.id} className={blockClass}>
      {renderSegmentContent(
        segment, 
        displayLang1, 
        displayLang2, 
        isBilingualMode, 
        isPlaying, 
        spokenLang || null, 
        speechBoundary || null, 
        unit
      )}
    </Wrapper>
  );
};
