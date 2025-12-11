
"use client";

import React, { useMemo } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { Segment, LibraryItem, EditorSettings, BilingualFormat, Page, BilingualViewMode } from '@/lib/types';
import { SegmentRenderer } from './SegmentRenderer';
import { useAudioPlayer } from '@/contexts/audio-player-context';


interface PageContentRendererProps {
  page: Page;
  presentationStyle: 'book' | 'card';
  editorSettings: EditorSettings;
  itemData: LibraryItem | null;
  displayLang1: string;
  displayLang2: string; // 'none' or language code
  // NEW PROP: Determines the bilingual display format
  bilingualFormat: 'sentence' | 'phrase';
}

export function PageContentRenderer({ 
    page, 
    presentationStyle, 
    editorSettings, 
    itemData,
    displayLang1,
    displayLang2,
    bilingualFormat,
}: PageContentRendererProps) {
  const { currentPlayingItem, currentSpeechBoundary, currentSpokenSegmentLang } = useAudioPlayer();
  const segments = page.items;
  
  // The segment ID that is currently being played by the audio player.
  const currentPlayingSegmentId = useMemo(() => {
    if (currentPlayingItem?.type !== 'book' || !itemData || currentPlayingItem.id !== itemData.id) {
        return null;
    }
    // This logic needs to be robust. Assuming segment ID is derivable from audio player state.
    // For now, this is a simplified placeholder.
    return audioPlayer.currentSegment?.id || null;
  }, [currentPlayingItem, itemData, audioPlayer.currentSegment]);

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
  
  // ✅ FIX: Correctly group segments into paragraphs
  const groupSegmentsByParagraph = () => {
      const paragraphs: Segment[][] = [];
      let currentParagraph: Segment[] = [];

      segments.forEach((segment) => {
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
             
             // For sentence-by-sentence, each segment is a paragraph
             if (isBilingualMode && bilingualFormat === 'sentence') {
                return paraSegments.map((segment) => (
                     <div key={segment.id} className="my-3"> {/* Add vertical spacing */}
                        <SegmentRenderer 
                            segment={segment} 
                            isPlaying={currentPlayingSegmentId === segment.id}
                            speechBoundary={currentSpeechBoundary}
                            spokenLang={currentSpokenSegmentLang}
                            isBilingualMode={isBilingualMode}
                            displayLang1={displayLang1}
                            displayLang2={displayLang2}
                            bilingualFormat={bilingualFormat}
                        />
                     </div>
                ));
             }

             // For mono and phrase mode, group segments into a single <p>
             return (
                <div key={`p-${pIndex}`}>
                    <p className={cn(applyDropCap && "first-letter:text-5xl first-letter:font-bold first-letter:mr-3 first-letter:float-left first-letter:text-primary")}>
                        {paraSegments.map((segment) => (
                            <SegmentRenderer 
                                key={segment.id} 
                                segment={segment} 
                                isPlaying={currentPlayingSegmentId === segment.id}
                                speechBoundary={currentSpeechBoundary}
                                spokenLang={currentSpokenSegmentLang}
                                isBilingualMode={isBilingualMode}
                                displayLang1={displayLang1}
                                displayLang2={displayLang2}
                                bilingualFormat={bilingualFormat}
                            />
                        ))}
                    </p>
                </div>
            )
        })}
    </div>
  );
}
