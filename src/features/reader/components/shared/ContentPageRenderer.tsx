// src/features/reader/components/shared/ContentPageRenderer.tsx
'use client';

import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { cn } from '@/lib/utils';
import type { LibraryItem, EditorSettings, Page, Segment, LanguageBlock, ContentUnit } from '@/lib/types';
import { useAudioPlayer } from '@/contexts/audio-player-context';

interface ContentPageRendererProps {
  page: Page;
  presentationStyle: 'book' | 'doc' | 'card';
  editorSettings: EditorSettings;
  itemData: LibraryItem | null;
  displayLang1: string;
  displayLang2: string; // 'none' or language code
}

/**
 * Reconstructs the final markdown string from a segment object based on display settings.
 * @param segment - The structured segment object.
 * @param displayLang1 - The primary language to display.
 * @param displayLang2 - The secondary language to display ('none' if monolingual).
 * @param unit - The unit for bilingual display ('sentence' or 'phrase').
 * @returns A markdown-ready string.
 */
function reconstructMarkdown(
    segment: Segment,
    displayLang1: string,
    displayLang2: string,
    unit: ContentUnit
): string {
    const prefix = segment.content[0] as string;
    const langBlock = segment.content[1] as LanguageBlock;
    const suffix = segment.content[2] as string;

    const primaryText = langBlock[displayLang1] || '';
    const secondaryText = langBlock[displayLang2] || '';

    if (displayLang2 !== 'none' && secondaryText) {
        if (unit === 'phrase') {
            return `${prefix}${primaryText} (${secondaryText})${suffix}`;
        }
        // Default to sentence mode
        return `${prefix}${primaryText}${suffix}\n\n<em class="text-muted-foreground">${secondaryText}</em>`;
    }

    // Monolingual mode
    return `${prefix}${primaryText}${suffix}`;
}

export function ContentPageRenderer({ 
    page, 
    presentationStyle, 
    editorSettings, 
    itemData,
    displayLang1 = 'en',
    displayLang2 = 'none',
}: ContentPageRendererProps) {
  const { position, currentSpeechBoundary: speechBoundary } = useAudioPlayer();
  const segments = page?.items || [];
  
  const currentSpokenSegmentId = position.originalSegmentId;

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
      {segments.map((segment) => {
        const finalMarkdown = reconstructMarkdown(
          segment, 
          displayLang1, 
          displayLang2, 
          itemData?.unit || 'sentence'
        );
        
        return (
          <div 
              key={segment.id} 
              data-segment-id={segment.id}
          >
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{finalMarkdown}</ReactMarkdown>
          </div>
        );
      })}
    </div>
  );
}
