// src/features/reader/components/SegmentRenderer.tsx

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
    
    // The `prose` classes are now applied in BookRenderer, so we don't need them here.
    return <ReactMarkdown remarkGfm={remarkGfm}>{text}</ReactMarkdown>;
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

  if (isBilingualMode && unit === 'phrase') {
      const primaryPhrases = content[displayLang1];
      const secondaryPhrases = content[displayLang2];
      
      if (!Array.isArray(primaryPhrases)) {
          const primaryText = content[displayLang1] as string || '';
          const secondaryText = content[displayLang2] as string || '';
          const isThisLangPlaying = isSegmentPlaying && spokenLang === displayLang1;
          
          return (
             <span className={cn('inline', isSegmentPlaying && 'tts-highlight')}>
                <MarkdownContent text={primaryText} boundary={isThisLangPlaying ? speechBoundary : null} />
                {secondaryText && (
                  <span className="text-muted-foreground italic text-[0.9em] ml-1">
                      (<MarkdownContent text={secondaryText} />)
                  </span>
                )}
             </span>
          );
      }

      return (
        <div className={cn('inline', isSegmentPlaying && 'tts-highlight')}>
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
        </div>
      );
  }

  const renderContentForLang = (lang: string) => {
      const langContent = content[lang];
      if (!langContent || Array.isArray(langContent)) return null;

      const isThisLangPlaying = isSegmentPlaying && spokenLang === lang;
      
      return (
          <span className={cn(!isBilingualMode && isSegmentPlaying && "tts-highlight")}>
              <MarkdownContent text={langContent} boundary={isThisLangPlaying ? speechBoundary : null} />
          </span>
      );
  };

  const primaryContent = renderContentForLang(displayLang1);
  if (!primaryContent) return null;

  if (isBilingualMode) {
      const secondaryContent = renderContentForLang(displayLang2);
      return (
        <div className={cn('inline-block w-full', isSegmentPlaying && 'tts-highlight')}>
            <span className="block" lang={displayLang1}>{primaryContent}</span>
            {secondaryContent && <span className="block text-muted-foreground italic text-[0.9em] mt-1" lang={displayLang2}>{secondaryContent}</span>}
        </div>
      );
  }

  // Monolingual
  return (
    <div className={cn(isSegmentPlaying && 'tts-highlight')}>
      {primaryContent}
    </div>
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
  
  return <div data-segment-id={segment.id}>{renderMainContent()}</div>;
};
