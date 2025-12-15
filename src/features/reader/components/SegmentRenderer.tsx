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
 * Parses a string with simple markdown (bold, italic, strikethrough, headings) and returns an array of React nodes.
 * This is a client-side component responsible for rendering raw markdown.
 * @param text The string to parse.
 * @returns A React fragment containing the parsed elements.
 */
const parseSimpleMarkdown = (text: string): React.ReactNode => {
    if (!text) return null;
    
    // Split by newlines to handle paragraphs and headings line by line
    const lines = text.split('\n');

    return (
        <>
            {lines.map((line, lineIndex) => {
                // Check for headings
                if (line.startsWith('### ')) {
                    return <h3 key={lineIndex} className="font-headline font-semibold text-lg mt-4">{line.substring(4)}</h3>;
                }
                if (line.startsWith('## ')) {
                    return <h2 key={lineIndex} className="font-headline font-bold text-xl mt-6 border-b pb-1">{line.substring(3)}</h2>;
                }
                
                // Regex to capture **bold**, *italic*, or ~~strikethrough~~ text
                const regex = /(\*\*.*?\*\*|\*.*?\*|~~.*?~~)/g;
                const parts = line.split(regex);
                
                // Render line as a paragraph if it's not a heading
                return (
                    <span key={lineIndex}>
                        {parts.map((part, partIndex) => {
                            if (part.startsWith('**') && part.endsWith('**')) {
                                return <strong key={partIndex}>{part.slice(2, -2)}</strong>;
                            }
                            if (part.startsWith('*') && part.endsWith('*')) {
                                return <em key={partIndex}>{part.slice(1, -1)}</em>;
                            }
                            if (part.startsWith('~~') && part.endsWith('~~')) {
                                return <s key={partIndex}>{part.slice(2, -2)}</s>;
                            }
                            return part;
                        })}
                        <br/>
                    </span>
                );
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
          // Fallback for non-array phrase content
          const primaryText = content[displayLang1] as string || '';
          const secondaryText = content[displayLang2] as string || '';
          const isThisLangPlaying = isSegmentPlaying && spokenLang === displayLang1;
          const contentToRender = isThisLangPlaying ? getWordHighlightContent(primaryText, speechBoundary) : parseSimpleMarkdown(primaryText);
          
          return (
             <span className={cn('inline', isSegmentPlaying && 'tts-highlight')}>
                {contentToRender}
                {secondaryText && (
                  <span className="text-muted-foreground italic text-[0.9em] ml-1">
                      ({parseSimpleMarkdown(secondaryText)})
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
  
  return <div data-segment-id={segment.id}>{renderMainContent()}</div>;
};
