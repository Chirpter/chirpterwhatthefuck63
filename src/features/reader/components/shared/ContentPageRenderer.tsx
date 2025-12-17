// src/features/reader/components/shared/ContentPageRenderer.tsx
"use client";

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { LibraryItem, EditorSettings, Page } from '@/lib/types';
import { SegmentRenderer } from './SegmentRenderer';
import { useAudioPlayer } from '@/contexts/audio-player-context';
import { parseMarkdownToSegments } from '@/services/shared/SegmentParser';


interface ContentPageRendererProps {
  page: Page;
  presentationStyle: 'book' | 'doc' | 'card';
  editorSettings: EditorSettings;
  itemData: LibraryItem | null;
  displayLang1?: string;
  displayLang2?: string; // 'none' or language code
}

export function ContentPageRenderer({ 
    page, 
    presentationStyle, 
    editorSettings, 
    itemData,
    displayLang1 = 'en',
    displayLang2 = 'none',
}: ContentPageRendererProps) {
  const { currentPlayingItem, position, currentSpeechBoundary: speechBoundary, currentSegmentLanguage } = useAudioPlayer();
  const segments = page?.items || [];
  
  const currentSpokenSegment = useMemo(() => {
    if (!itemData || !currentPlayingItem || currentPlayingItem.id !== itemData.id || !position || !itemData.content) {
      return null;
    }
    
    // ✅ This logic needs to be updated to work with the flat segment structure
    // The TTS engine will need to provide enough context to find the right segment
    const allSegments = parseMarkdownToSegments(itemData.content, itemData.origin, itemData.unit);
    const spokenSegmentFromEngine = (currentPlayingItem as any)._internal_segments?.[position.segmentIndex];
    if (!spokenSegmentFromEngine) return null;
    
    return allSegments.find(s => s.id === spokenSegmentFromEngine.originalSegmentId) || null;

  }, [currentPlayingItem, itemData, position]);

  const currentPlayingSegmentId = currentSpokenSegment?.id || null;
  const currentSpokenLang = currentSegmentLanguage;

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
    // ONLY apply user-configurable font size for 'book' presentation style
    if (presentationStyle === 'book') {
        switch(editorSettings.fontSize) {
            case 'sm': return 'prose-sm';
            case 'lg': return 'prose-lg';
            default: return 'prose-base';
        }
    }
    // For 'doc' and 'card', ALWAYS use the dynamic CQI-based font size
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
    // For 'book' style
    return 'p-8 md:p-12';
  }, [presentationStyle, editorSettings]);
  
  const isBilingualMode = displayLang2 !== 'none';
  
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
        <div key={segment.id}>
            <SegmentRenderer 
                segment={segment} 
                isPlaying={currentPlayingSegmentId === segment.id}
                speechBoundary={speechBoundary}
                spokenLang={currentSpokenLang}
                isBilingualMode={isBilingualMode}
                displayLang1={displayLang1}
                displayLang2={displayLang2}
                unit={itemData?.unit || 'sentence'}
            />
        </div>
      ))}
    </div>
  );
}
