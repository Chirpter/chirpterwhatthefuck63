// src/features/reader/components/shared/ContentPageRenderer.tsx
"use client";

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { LibraryItem, EditorSettings, Page, Segment, LanguageBlock, ContentUnit } from '@/lib/types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
  isBilingualMode: boolean;
  isSegmentPlaying: boolean;
  spokenLang: string | null;
  speechBoundary: { charIndex: number, charLength: number } | null;
  unit: ContentUnit;
}> = ({ segmentContent, displayLang1, displayLang2, isBilingualMode, isSegmentPlaying, spokenLang, speechBoundary, unit }) => {
  
  const reconstructedMarkdown = useMemo(() => {
    let text = '';
    for (const part of segmentContent) {
      if (typeof part === 'string') {
        text += part;
      } else {
        // This is the language block
        if (!isBilingualMode) {
          text += part[displayLang1] || '';
        } else if (unit === 'sentence') {
          const primary = part[displayLang1] || '';
          const secondary = part[displayLang2] || '';
          // Render on separate lines for sentence mode
          text += `${primary}\n_${secondary}_`;
        } else { // phrase mode
          const primary = part[displayLang1] || '';
          const secondary = part[displayLang2] || '';
          // Render inline for phrase mode
          text += `${primary} (${secondary})`;
        }
      }
    }
    return text;
  }, [segmentContent, displayLang1, displayLang2, isBilingualMode, unit]);

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
        <div key={segment.id} data-segment-id={segment.id}>
            <ContentRenderer
                segmentContent={segment.content}
                displayLang1={displayLang1}
                displayLang2={displayLang2}
                isBilingualMode={isBilingualMode}
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
