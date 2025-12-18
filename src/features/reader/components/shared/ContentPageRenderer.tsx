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
 */
function reconstructMarkdown(
    segment: Segment,
    displayLang1: string,
    displayLang2: string,
    unit: ContentUnit
): string {
    const prefix = segment.content[0] as string;
    const contentData = segment.content[1];
    const suffix = segment.content[2] as string;

    // Handle Phrase Mode (contentData is an array of pairs)
    if (unit === 'phrase' && Array.isArray(contentData)) {
        const phrases = contentData.map(pair => {
            const primaryText = pair[displayLang1] || '';
            const secondaryText = pair[displayLang2] || '';
            if (displayLang2 !== 'none' && secondaryText) {
                return `${primaryText} <em class="text-muted-foreground/80">(${secondaryText})</em>`;
            }
            return primaryText;
        }).join(' '); // Join phrases with a space
        return `${prefix}${phrases}${suffix}`;
    }

    // Handle Sentence Mode (contentData is a single object)
    if (typeof contentData === 'object' && !Array.isArray(contentData)) {
        const langBlock = contentData as LanguageBlock;
        const primaryText = langBlock[displayLang1] || '';
        const secondaryText = langBlock[displayLang2] || '';

        if (displayLang2 !== 'none' && secondaryText) {
            return `${prefix}${primaryText}${suffix}\n\n<em class="text-muted-foreground">${secondaryText}</em>`;
        }
        return `${prefix}${primaryText}${suffix}`;
    }
    
    // Fallback for unexpected data structure
    return '';
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
            'flex flex-col h-full p-6 md:p-8 dark:bg-slate-800 dark:text-slate-200',
            editorSettings.verticalAlign,
            editorSettings.textAlign
        );
    }
    return 'p-8 md:p-12 dark:bg-slate-800 dark:text-slate-200';
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
