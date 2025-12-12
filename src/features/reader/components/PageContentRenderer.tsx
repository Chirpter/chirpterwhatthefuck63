// src/features/reader/components/PageContentRenderer.tsx

"use client";

import React, { useMemo } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { Segment, LibraryItem, EditorSettings, Page } from '@/lib/types';
import { SegmentRenderer } from './SegmentRenderer';
import { useAudioPlayer } from '@/contexts/audio-player-context';


interface PageContentRendererProps {
  page: Page;
  presentationStyle: 'book' | 'card';
  editorSettings: EditorSettings;
  itemData: LibraryItem | null;
  displayLang1: string;
  displayLang2: string; // 'none' or language code
}

// Function to group segments into paragraphs
const groupSegmentsIntoParagraphs = (segments: Segment[]): Segment[][] => {
    if (!segments || segments.length === 0) return [];
  
    const paragraphs: Segment[][] = [];
    let currentParagraph: Segment[] = [];
  
    segments.forEach(segment => {
      // Each 'start_para' or 'heading' begins a new paragraph block
      if (segment.type === 'start_para' || segment.type === 'heading' || segment.type === 'blockquote') {
        if (currentParagraph.length > 0) {
          paragraphs.push(currentParagraph);
        }
        currentParagraph = [segment];
      } else {
        if (currentParagraph.length === 0) {
          // Handle cases where the first segment isn't 'start_para'
          currentParagraph.push(segment);
        } else {
          currentParagraph.push(segment);
        }
      }
    });
  
    if (currentParagraph.length > 0) {
      paragraphs.push(currentParagraph);
    }
  
    return paragraphs;
};


export function PageContentRenderer({ 
    page, 
    presentationStyle, 
    editorSettings, 
    itemData,
    displayLang1,
    displayLang2,
}: PageContentRendererProps) {
  const { currentPlayingItem, position, currentSpeechBoundary: speechBoundary, currentSegmentLanguage } = useAudioPlayer();
  const segments = page.items;
  
  const currentSpokenSegment = useMemo(() => {
    if (!itemData || !currentPlayingItem || currentPlayingItem.id !== itemData.id || !position || position.chapterIndex === null) {
      return null;
    }

    if (itemData.type === 'book') {
        const chapter = itemData.chapters?.[position.chapterIndex];
        if (chapter && chapter.segments) {
            // The spoken segment is determined by the engine's internal queue
            const spokenSegmentFromEngine = (currentPlayingItem as any)._internal_segments?.[position.segmentIndex];
            if (!spokenSegmentFromEngine) return null;
            // Find the original segment data using the ID
            return chapter.segments.find(s => s.id === spokenSegmentFromEngine.originalSegmentId) || null;
        }
    }
    
    return null;
  }, [currentPlayingItem, itemData, position]);

  const currentPlayingSegmentId = currentSpokenSegment?.id || null;
  const currentSpokenLang = currentSegmentLanguage;

  const proseThemeClass = useMemo(() => {
    if (presentationStyle === 'book') return 'prose dark:prose-invert';
    if (presentationStyle === 'card') {
        switch (editorSettings.background) {
            case 'bg-reader-sepia': return 'prose-on-sepia prose-dynamic';
            case 'bg-reader-slate': return 'prose-on-slate dark prose-dynamic';
            case 'bg-reader-lined': return 'prose-on-lined-paper prose-dynamic';
            case 'bg-reader-grid': return 'prose-on-grid prose-dynamic';
            case 'bg-reader-crumbled': return 'prose-on-crumbled prose-dynamic';
            default: return 'prose-dynamic';
        }
    }
    return 'prose dark:prose-invert';
  }, [editorSettings.background, presentationStyle]);
  
  const layoutClasses = useMemo(() => {
    if (presentationStyle === 'card') {
        return cn(
            'flex flex-col h-full p-6 md:p-8',
            editorSettings.verticalAlign,
            editorSettings.textAlign
        );
    }
    return 'p-8 md:p-12';
  }, [presentationStyle, editorSettings]);
  
  const isBilingualMode = displayLang2 !== 'none';
  
  const contentContainerClasses = cn(
    "max-w-none font-serif w-full h-full",
    proseThemeClass,
    layoutClasses,
    "overflow-hidden"
  );
  
  const paragraphs = useMemo(() => groupSegmentsIntoParagraphs(segments), [segments]);

  return (
    <div className={contentContainerClasses}>
        {paragraphs.map((paragraph, pIndex) => {
            const firstSegment = paragraph[0];
            const ParagraphWrapper = firstSegment.type === 'blockquote' ? 'blockquote' : 'p';
            const applyDropCap = firstSegment.type === 'start_para' && pIndex === 0 && page.pageIndex === 0;

            return (
                <ParagraphWrapper key={pIndex} className={cn(
                    (firstSegment.type === 'start_para' || firstSegment.type === 'text') && "mt-4 first:mt-0",
                    applyDropCap && "first-letter:text-5xl first-letter:font-bold first-letter:mr-3 first-letter:float-left first-letter:text-primary"
                )}>
                    {paragraph.map((segment) => (
                        <SegmentRenderer 
                            key={segment.id} 
                            segment={segment} 
                            isPlaying={currentPlayingSegmentId === segment.id}
                            speechBoundary={speechBoundary}
                            spokenLang={currentSpokenLang}
                            isBilingualMode={isBilingualMode}
                            displayLang1={displayLang1}
                            displayLang2={displayLang2}
                            unit={itemData?.unit || 'sentence'}
                        />
                    ))}
                </ParagraphWrapper>
            );
        })}
    </div>
  );
}