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

const ContentRenderer: React.FC<{
  segmentContent: (string | LanguageBlock)[];
  displayLang1: string;
  displayLang2: string;
  isSegmentPlaying: boolean;
  spokenLang: string | null;
  speechBoundary: { charIndex: number, charLength: number } | null;
  unit: 'sentence' | 'phrase';
}> = ({ segmentContent, displayLang1, displayLang2, isSegmentPlaying, spokenLang, speechBoundary, unit }) => {
  
  const reconstructedMarkdown = useMemo(() => {
    let finalString = '';
    const prefix = typeof segmentContent[0] === 'string' ? segmentContent[0] : '';
    const suffix = typeof segmentContent[segmentContent.length - 1] === 'string' ? segmentContent[segmentContent.length - 1] : '';
    const langBlock = segmentContent.find(p => typeof p === 'object') as LanguageBlock | undefined;

    const text1 = langBlock?.[displayLang1] as string || '';
    const text2 = langBlock?.[displayLang2] as string || '';

    if (displayLang2 !== 'none' && text2) {
      if (unit === 'phrase') {
        finalString = `${prefix}${text1} (${text2})${suffix}`;
      } else { // sentence
        finalString = `${prefix}${text1}${suffix}\n\n_${text2}_`;
      }
    } else {
      finalString = `${prefix}${text1}${suffix}`;
    }

    return finalString;
  }, [segmentContent, displayLang1, displayLang2, unit]);

  // For now, word highlighting is disabled in this new architecture,
  // as it would require parsing the reconstructed markdown.
  // We can add this back later if needed.
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
  const { currentPlayingItem, position, currentSpeechBoundary: speechBoundary, currentSegmentLanguage } = useAudioPlayer();
  const segments = page?.items || [];
  
  const currentSpokenSegmentId = useMemo(() => {
    // This logic will need to be adapted based on how audio engine tracks progress
    // with the new `Segment[]` structure.
    return null;
  }, [currentPlayingItem, itemData, position]);

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
        <div key={segment.id} data-segment-id={segment.id}>
            <ContentRenderer
                segmentContent={segment.content}
                displayLang1={displayLang1}
                displayLang2={displayLang2}
                isBilingualMode={displayLang2 !== 'none'}
                unit={itemData?.unit || 'sentence'}
                isSegmentPlaying={currentSpokenSegmentId === segment.id}
                spokenLang={currentSpokenLang}
                speechBoundary={speechBoundary}
            />
        </div>
      ))}
    </div>
  );
}
