
"use client";

import React, { useMemo } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { Segment, LibraryItem, EditorSettings, BilingualFormat, Page, BilingualViewMode } from '@/lib/types';
import { SegmentRenderer } from './SegmentRenderer';
import { useAudioPlayer } from '@/contexts/audio-player-context';


interface PageContentRendererProps {
  page: Page;
  currentPlayingItemId?: string | null;
  presentationStyle: 'book' | 'card';
  editorSettings: EditorSettings;
  itemData: LibraryItem | null;
  displayLang1: string;
  displayLang2: string; // 'none' or language code
}

export function PageContentRenderer({ 
    page, 
    currentPlayingItemId, 
    presentationStyle, 
    editorSettings, 
    itemData,
    displayLang1,
    displayLang2
}: PageContentRendererProps) {
  const { currentSpeechBoundary, currentSpokenSegmentLang, currentPlayingItem } = useAudioPlayer();
  const segments = page.items;

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
            'flex flex-col h-full p-6 md:p-8', // Added padding for card view
            editorSettings.verticalAlign,
            editorSettings.textAlign
        );
    }
    return 'p-8 md:p-12';
  }, [presentationStyle, editorSettings]);
  
  const isBilingualMode = displayLang2 !== 'none';
  
  const groupSegmentsByParagraph = () => {
      const paragraphs: Segment[][] = [];
      let currentParagraph: Segment[] = [];

      segments.forEach(segment => {
          if (segment.metadata.isNewPara && currentParagraph.length > 0) {
              paragraphs.push(currentParagraph);
              currentParagraph = [];
          }
          currentParagraph.push(segment);
      });

      if (currentParagraph.length > 0) {
          paragraphs.push(currentParagraph);
      }
      return paragraphs;
  };
  
  const contentContainerClasses = cn(
    "max-w-none font-serif w-full h-full",
    proseThemeClass,
    layoutClasses,
    "overflow-hidden"
  );

  const paragraphs = groupSegmentsByParagraph();

  return (
    <div className={contentContainerClasses}>
        {paragraphs.map((paraSegments, pIndex) => {
             const applyDropCap = paraSegments.some(s => s.metadata.applyDropCap);
             const currentPlayingSegment = paraSegments.find(s => s.id === currentPlayingItem?.id);
             return (
                <div key={`p-${pIndex}`}>
                    {paraSegments[0].type === 'text' || paraSegments[0].type === 'dialog' ? (
                        <p className={cn(applyDropCap && "first-letter:text-5xl first-letter:font-bold first-letter:mr-3 first-letter:float-left first-letter:text-primary")}>
                            {paraSegments.map((segment) => (
                            <SegmentRenderer 
                                key={segment.id} 
                                segment={segment} 
                                isPlaying={currentPlayingItem?.id === segment.id}
                                speechBoundary={currentSpeechBoundary}
                                spokenLang={currentSpokenSegmentLang}
                                isBilingualMode={isBilingualMode}
                                displayLang1={displayLang1}
                                displayLang2={displayLang2}
                            />
                            ))}
                        </p>
                    ) : (
                        paraSegments.map((segment) => (
                            <div key={segment.id}>
                            <SegmentRenderer 
                                segment={segment} 
                                isPlaying={currentPlayingItem?.id === segment.id}
                                speechBoundary={currentSpeechBoundary}
                                spokenLang={currentSpokenSegmentLang}
                                isBilingualMode={isBilingualMode}
                                displayLang1={displayLang1}
                                displayLang2={displayLang2}
                            />
                            </div>
                        ))
                    )}
                </div>
            )
        })}
    </div>
  );
}
