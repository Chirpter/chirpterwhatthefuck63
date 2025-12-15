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

const MarkdownContent: React.FC<{ text: string; boundary?: { charIndex: number, charLength: number } | null }> = ({ text, boundary }) => {
    if (boundary) {
        return <WordHighlight text={text} boundary={boundary} />;
    }
    
    if (/[*_~`#]/.test(text)) {
      return <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>;
    }
    return <>{text}</>;
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

  if (isBilingualMode && unit === 'sentence') {
    const primaryText = content[displayLang1] as string || '';
    const secondaryText = content[displayLang2] as string || '';
    
    return (
      <div className={cn('bilingual-sentence-block mb-2')}>
        {primaryText && (
          <div lang={displayLang1} className={cn(isSegmentPlaying && spokenLang === displayLang1 && 'tts-highlight')}>
            <MarkdownContent text={primaryText} boundary={isSegmentPlaying && spokenLang === displayLang1 ? speechBoundary : null} />
          </div>
        )}
        {secondaryText && (
          <div lang={displayLang2} className={cn('text-muted-foreground italic text-[0.9em] mt-1', isSegmentPlaying && spokenLang === displayLang2 && 'tts-highlight')}>
            <MarkdownContent text={secondaryText} boundary={isSegmentPlaying && spokenLang === displayLang2 ? speechBoundary : null} />
          </div>
        )}
      </div>
    );
  }

  if (isBilingualMode && unit === 'phrase') {
      const primaryPhrases = content[displayLang1];
      const secondaryPhrases = content[displayLang2];
      
      if (!Array.isArray(primaryPhrases)) {
          const primaryText = content[displayLang1] as string || '';
          const secondaryText = content[displayLang2] as string || '';
          return (
             <span className={cn('inline', isSegmentPlaying && 'tts-highlight')}>
                <MarkdownContent text={primaryText} boundary={isSegmentPlaying && spokenLang === displayLang1 ? speechBoundary : null} />
                {secondaryText && (
                  <span className="text-muted-foreground italic text-[0.9em] ml-1">
                      (<MarkdownContent text={secondaryText} />)
                  </span>
                )}
             </span>
          );
      }

      return (
        <span className={cn('inline', isSegmentPlaying && 'tts-highlight')}>
            {primaryPhrases.map((phrase, index) => {
                const secondaryPhrase = Array.isArray(secondaryPhrases) ? secondaryPhrases[index] : '';
                return (
                    <span key={index} className="inline mr-1">
                        <MarkdownContent text={phrase} />
                        {secondaryPhrase && (
                            <span className="text-muted-foreground italic text-[0.9em] ml-1">
                                (<MarkdownContent text={secondaryPhrase} />)
                            </span>
                        )}
                        {' '}
                    </span>
                );
            })}
        </span>
      );
  }

  const monolingualText = content[displayLang1] as string || '';
  if (!monolingualText) return null;
  
  return (
    <span className={cn('inline', isSegmentPlaying && 'tts-highlight')} lang={displayLang1}>
      <MarkdownContent text={monolingualText} boundary={isSegmentPlaying ? speechBoundary : null} />
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
  
  const Wrapper = unit === 'sentence' ? 'div' : 'span';

  return (
    <Wrapper data-segment-id={segment.id}>
      {renderSegmentContent(segment, displayLang1, displayLang2, isBilingualMode, isSegmentPlaying, spokenLang || null, speechBoundary || null, unit)}
    </Wrapper>
  );
};
