// src/features/reader/components/BookRenderer.tsx

"use client";

import React, { useMemo } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { Segment, LibraryItem, EditorSettings, Page, Book } from '@/lib/types';
import { SegmentRenderer } from './SegmentRenderer';
import { useAudioPlayer } from '@/contexts/audio-player-context';
import { getItemSegments } from '@/services/shared/SegmentParser';


interface BookRendererProps {
  page: Page;
  presentationStyle: 'book' | 'doc' | 'card';
  editorSettings: EditorSettings;
  itemData: LibraryItem | null;
  displayLang1?: string;
  displayLang2?: string; // 'none' or language code
}

// Function to group segments into paragraphs
const groupSegmentsIntoParagraphs = (segments: Segment[]): Segment[][] => {
    if (!segments || segments.length === 0) return [];
    
    const paragraphs: Segment[][] = [];
    let currentParagraph: Segment[] = [];

    segments.forEach((segment, index) => {
        currentParagraph.push(segment);
        // This is a simplified logic. A paragraph ends when the NEXT segment is a start_para.
        const nextIsNewPara = segments[index + 1]?.type === 'start_para';

        if (nextIsNewPara || index === segments.length - 1) {
            paragraphs.push(currentParagraph);
            currentParagraph = [];
        }
    });

    return paragraphs;
};


export function BookRenderer({ 
    page, 
    presentationStyle, 
    editorSettings, 
    itemData,
    displayLang1 = 'en',
    displayLang2 = 'none',
}: BookRendererProps) {
  const { currentPlayingItem, position, currentSpeechBoundary: speechBoundary, currentSegmentLanguage } = useAudioPlayer();
  const segments = page.items;
  
  const currentSpokenSegment = useMemo(() => {
    if (!itemData || !currentPlayingItem || currentPlayingItem.id !== itemData.id || !position) {
      return null;
    }
    
    const allSegments = getItemSegments(itemData, position.chapterIndex ?? 0);
    // The spoken segment is determined by the engine's internal queue
    const spokenSegmentFromEngine = (currentPlayingItem as any)._internal_segments?.[position.segmentIndex];
    if (!spokenSegmentFromEngine) return null;
    
    // Find the original segment data using the ID
    return allSegments.find(s => s.id === spokenSegmentFromEngine.originalSegmentId) || null;

  }, [currentPlayingItem, itemData, position]);

  const currentPlayingSegmentId = currentSpokenSegment?.id || null;
  const currentSpokenLang = currentSegmentLanguage;

  const proseThemeClass = useMemo(() => {
    switch (editorSettings.background) {
        case 'bg-reader-sepia': return 'prose-on-sepia prose-dynamic';
        case 'bg-reader-slate': return 'prose-on-slate dark prose-dynamic';
        case 'bg-reader-lined': return 'prose-on-lined-paper prose-dynamic';
        case 'bg-reader-grid': return 'prose-on-grid prose-dynamic';
        case 'bg-reader-crumbled': return 'prose-on-crumbled prose-dynamic';
        default: return 'prose dark:prose-invert prose-dynamic';
    }
  }, [editorSettings.background]);
  
  const layoutClasses = useMemo(() => {
    if (presentationStyle === 'card') {
        return cn(
            'flex flex-col h-full p-6 md:p-8',
            editorSettings.verticalAlign,
            editorSettings.textAlign
        );
    }
    // For 'doc' or 'book' style
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
      {paragraphs.map((paraSegments, paraIndex) => (
        <p key={paraIndex}>
          {paraSegments.map((segment) => (
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
        </p>
      ))}
    </div>
  );
}
