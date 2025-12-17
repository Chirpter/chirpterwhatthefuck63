// src/features/reader/components/shared/ContentPageRenderer.tsx
"use client";

import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import type { LibraryItem, EditorSettings, Page, Segment, LanguageBlock } from '@/lib/types';
import { useAudioPlayer } from '@/contexts/audio-player-context';

interface ContentPageRendererProps {
  page: Page;
  presentationStyle: 'book' | 'doc' | 'card';
  editorSettings: EditorSettings;
  itemData: LibraryItem | null;
  displayLang1: string;
  displayLang2: string; // 'none' or language code
}

const SegmentRenderer: React.FC<{
  segment: Segment,
  displayLang1: string,
  displayLang2: string,
  unit: 'sentence' | 'phrase',
  isSegmentPlaying: boolean,
  speechBoundary: { charIndex: number, charLength: number } | null
}> = ({ segment, displayLang1, displayLang2, unit, isSegmentPlaying, speechBoundary }) => {
  
  const reconstructedMarkdown = useMemo(() => {
    let finalString = '';
    const isBilingual = displayLang2 !== 'none';
    
    segment.content.forEach(part => {
      if (typeof part === 'string') {
        finalString += part;
      } else { // It's a LanguageBlock
        const langBlock = part as LanguageBlock;
        const text1 = langBlock[displayLang1] || '';
        
        if (isBilingual) {
          const text2 = langBlock[displayLang2] || '';
          if (unit === 'phrase') {
            finalString += `${text1} (${text2})`;
          } else { // sentence
            finalString += `${text1}\n\n_${text2}_`;
          }
        } else {
          finalString += text1;
        }
      }
    });
    
    return finalString;
  }, [segment.content, displayLang1, displayLang2, unit]);

  // For now, word highlighting on the reconstructed string is complex.
  // We can add it back later if necessary.
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{reconstructedMarkdown}</ReactMarkdown>;
};


export function ContentPageRenderer({ 
    page, 
    presentationStyle, 
    editorSettings, 
    itemData,
    displayLang1 = 'en',
    displayLang2 = 'none',
}: ContentPageRendererProps) {
  const { currentPlayingItem, position, currentSpeechBoundary: speechBoundary } = useAudioPlayer();
  const segments = page?.items || [];
  
  // This logic would need to be updated if audio playback needs to sync with the new structure.
  const currentSpokenSegmentId = null;

  const proseThemeClass = useMemo(() => {
    switch (editorSettings.background) {
        case 'bg-reader-sepia': return 'prose-on-sepia';
        case 'bg-reader-slate': return 'prose-on-slate dark';
        case 'bg-reader-lined': return 'prose-on-lined-paper';
        case 'bg-reader-grid': return 'prose-on-grid';
        case 'bg-reader-crumbled': return 'prose-on-crumbled';
        default: return 'prose dark:prose-invert';
    }
  }, [editorSettings.background]);
  
  const proseSizeClass = useMemo(() => {
    if (presentationStyle === 'book') {
        switch(editorSettings.fontSize) {
            case 'sm': return 'prose-sm';
            case 'lg': return 'prose-lg';
            default: return 'prose-base';
        }
    }
    return 'prose-dynamic';
  }, [presentationStyle, editorSettings.fontSize]);

  const layoutClasses = useMemo(() => {
    if (presentationStyle === 'card' || presentationStyle === 'doc') {
        return cn(
            'flex flex-col h-full p-6 md:p-8',
            editorSettings.verticalAlign,
            editorSettings.textAlign
        );
    }
    return 'p-8 md:p-12';
  }, [presentationStyle, editorSettings]);
  
  const contentContainerClasses = cn(
    "max-w-none font-serif w-full h-full",
    proseThemeClass,
    proseSizeClass,
    layoutClasses,
    "overflow-hidden"
  );

  return (
    <div className={contentContainerClasses}>
      {segments.map((segment) => (
        <div 
            key={segment.id} 
            data-segment-id={segment.id}
            className={cn(segment.type === 'heading1' && 'font-headline text-3xl mt-4 mb-6 border-b pb-2')}
        >
            <SegmentRenderer
                segment={segment}
                displayLang1={displayLang1}
                displayLang2={displayLang2}
                unit={itemData?.unit || 'sentence'}
                isSegmentPlaying={currentSpokenSegmentId === segment.id}
                speechBoundary={speechBoundary}
            />
        </div>
      ))}
    </div>
  );
}
