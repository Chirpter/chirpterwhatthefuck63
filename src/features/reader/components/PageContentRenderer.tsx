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

export function PageContentRenderer({ 
    page, 
    presentationStyle, 
    editorSettings, 
    itemData,
    displayLang1,
    displayLang2,
}: PageContentRendererProps) {
  const { currentPlayingItem, currentSpeechBoundary, currentSpokenSegmentLang, currentSegment } = useAudioPlayer();
  const segments = page.items;
  
  const currentPlayingSegmentId = useMemo(() => {
    if (currentPlayingItem?.type !== itemData?.type || !itemData || currentPlayingItem.id !== itemData.id) {
        return null;
    }
    return currentSegment?.originalSegmentId || null;
  }, [currentPlayingItem, itemData, currentSegment]);

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

  return (
    <div className={contentContainerClasses}>
        {segments.map((segment, index) => {
            const isNewPara = segment.metadata.isNewPara;
            const applyDropCap = isNewPara && index === 0; // Only apply drop cap to the very first segment of a new paragraph on a page

            const content = (
              <SegmentRenderer 
                  key={segment.id} 
                  segment={segment} 
                  isPlaying={currentPlayingSegmentId === segment.id}
                  speechBoundary={currentSpeechBoundary}
                  spokenLang={currentSpokenSegmentLang}
                  isBilingualMode={isBilingualMode}
                  displayLang1={displayLang1}
                  displayLang2={displayLang2}
              />
            );
            
            if(isNewPara) {
              return (
                <p key={`p-${segment.id}`} className={cn(applyDropCap && "first-letter:text-5xl first-letter:font-bold first-letter:mr-3 first-letter:float-left first-letter:text-primary")}>
                    {content}
                </p>
              );
            }
            
            return content;
        })}
    </div>
  );
}
