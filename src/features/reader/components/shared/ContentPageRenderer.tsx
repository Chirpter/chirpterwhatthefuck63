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
  displayLang2: string;
  showPageNumber?: boolean;
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
  const langBlock = segment.content[1] as LanguageBlock;
  const suffix = segment.content[2] as string;

  const primaryText = langBlock[displayLang1] || '';
  const secondaryText = langBlock[displayLang2] || '';

  if (displayLang2 !== 'none' && secondaryText) {
    if (unit === 'phrase') {
      // Bilingual phrase mode: inline with parentheses
      return `${prefix}${primaryText} (${secondaryText})${suffix}`;
    }
    // Bilingual sentence mode: two lines
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
  showPageNumber = true
}: ContentPageRendererProps) {
  const { position } = useAudioPlayer();
  const segments = page?.items || [];

  const currentSpokenSegmentId = position.originalSegmentId;

  // Determine prose theme based on background
  const proseThemeClass = useMemo(() => {
    switch (editorSettings.background) {
      case 'bg-reader-sepia':
        return 'prose-on-sepia';
      case 'bg-reader-slate':
        return 'prose-on-slate dark';
      case 'bg-reader-lined':
        return 'prose-on-lined-paper';
      case 'bg-reader-grid':
        return 'prose-on-grid';
      case 'bg-reader-crumbled':
        return 'prose-on-crumbled';
      default:
        return 'prose dark:prose-invert';
    }
  }, [editorSettings.background]);

  // Determine prose size class based on presentation style
  const proseSizeClass = useMemo(() => {
    if (presentationStyle === 'book') {
      // Book uses hardcoded font sizes
      switch (editorSettings.fontSize) {
        case 'sm':
          return 'prose-sm';
        case 'lg':
          return 'prose-lg';
        default:
          return 'prose-base';
      }
    }
    // Card and Doc use CQI-based sizing
    return 'prose-dynamic';
  }, [presentationStyle, editorSettings.fontSize]);

  // Layout classes based on presentation style
  const layoutClasses = useMemo(() => {
    const baseClasses = 'relative w-full h-full';

    if (presentationStyle === 'card' || presentationStyle === 'doc') {
      // Card and Doc support vertical alignment
      return cn(
        baseClasses,
        'flex flex-col overflow-y-auto p-6 md:p-8',
        editorSettings.verticalAlign,
        editorSettings.textAlign
      );
    }

    // Book has fixed padding
    return cn(baseClasses, 'p-8 md:p-12 overflow-hidden', editorSettings.textAlign);
  }, [presentationStyle, editorSettings]);

  const contentContainerClasses = cn(
    'max-w-none font-serif w-full',
    proseThemeClass,
    proseSizeClass,
    layoutClasses
  );

  return (
    <div className={contentContainerClasses}>
      {/* Content segments */}
      <div className="flex-1">
        {segments.map((segment) => {
          const finalMarkdown = reconstructMarkdown(
            segment,
            displayLang1,
            displayLang2,
            itemData?.unit || 'sentence'
          );

          return (
            <div key={segment.id} data-segment-id={segment.id}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                {finalMarkdown}
              </ReactMarkdown>
            </div>
          );
        })}
      </div>

      {/* Page number - only for book and doc */}
      {showPageNumber && (presentationStyle === 'book' || presentationStyle === 'doc') && (
        <div className="absolute bottom-4 right-6 text-xs text-muted-foreground font-sans">
          {page.pageIndex + 1}
        </div>
      )}
    </div>
  );
}