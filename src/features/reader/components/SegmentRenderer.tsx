'use client';

import React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { Segment } from '@/lib/types';
import { useAudioPlayer } from '@/contexts/audio-player-context';

interface SegmentRendererProps {
  segment: Segment;
  currentPlayingSegmentId?: string | null;
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


export const SegmentRenderer: React.FC<SegmentRendererProps> = ({ 
    segment, 
    currentPlayingSegmentId,
    speechBoundary,
    spokenLang,
    isBilingualMode,
    displayLang1,
    displayLang2,
}) => {
  const { currentPlayingItem } = useAudioPlayer();
  const isSegmentPlaying = segment.id === currentPlayingSegmentId;
  const isThisLangSpeaking = (lang?: string) => lang === spokenLang;

  const renderContent = (content: string, lang?: string) => {
    if (isSegmentPlaying && isThisLangSpeaking(lang)) {
        return getWordHighlightContent(content, speechBoundary);
    }
    return content;
  }

  const primaryContent = segment.content[displayLang1];
  const secondaryContent = displayLang2 !== 'none' ? segment.content[displayLang2] : undefined;

  const renderText = () => {
    const primarySpan = primaryContent && (
      <span lang={displayLang1} className="font-serif">
        {renderContent(primaryContent, displayLang1)}
      </span>
    );
    
    const secondarySpan = secondaryContent && (
      <span lang={displayLang2} className="font-serif text-muted-foreground italic text-sm ml-1">
        {renderContent(secondaryContent, displayLang2)}
      </span>
    );

    const space = ' ';
    
    if (isBilingualMode) {
      return (
        <span data-segment-id={segment.id} className={cn('inline', isSegmentPlaying && 'tts-highlight')}>
            <span className="block">{primarySpan}</span>
            <span className="block">{secondarySpan}</span>
        </span>
      );
    }
    
    // Monolingual view
    return (
        <span data-segment-id={segment.id} className={cn(isSegmentPlaying && 'tts-highlight')}>
            {primarySpan}{space}
        </span>
    );
  };


  switch (segment.type) {
    case 'heading':
      return (
        <h3 data-segment-id={segment.id} className={cn(
          isSegmentPlaying && 'tts-highlight', 
          "text-2xl font-bold mt-2 mb-2 font-headline", 
          "dark:text-gray-200"
        )}>
            {renderContent(primaryContent, displayLang1)}
            {isBilingualMode && secondaryContent && (
                <span className="text-muted-foreground dark:text-gray-400 font-normal text-base ml-2">
                    / {renderContent(secondaryContent, displayLang2)}
                </span>
            )}
        </h3>
      );
    
    case 'blockquote':
        return (
            <blockquote data-segment-id={segment.id} className={cn(isSegmentPlaying && 'tts-highlight', "my-4 w-full")}>
                {renderContent(primaryContent, displayLang1)}
            </blockquote>
        );
    
    case 'list_item':
        return (
            <li data-segment-id={segment.id} className={cn(isSegmentPlaying && 'tts-highlight', 'w-full')}>
                {renderContent(primaryContent, displayLang1)}
            </li>
        );

    case 'image':
      return (
        <div data-segment-id={segment.id} className="my-4 w-full">
          <Image
            src={primaryContent}
            alt={secondaryContent || "content image"}
            width={500}
            height={300}
            className="mx-auto rounded-md shadow-md"
          />
        </div>
      );

    case 'text':
    case 'dialog':
        return renderText();
    
    default:
        return null;
  }
};
