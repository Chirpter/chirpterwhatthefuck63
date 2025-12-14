// src/features/library/components/PieceRenderer.tsx

"use client";

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useEditorSettings } from '@/hooks/useEditorSettings';
import { BookRenderer } from '@/features/reader/components/BookRenderer';
import type { LibraryItem, Piece, Segment } from '@/lib/types';
import { getItemSegments } from '@/services/shared/MarkdownParser';
import { Icon } from '@/components/ui/icons';
import { useTranslation } from 'react-i18next';

interface PieceRendererProps {
  item: LibraryItem | null;
  isPreview?: boolean;
  chapterIndex?: number;
}

const getAspectRatioClass = (ratio?: '1:1' | '3:4' | '4:3'): string => {
    switch (ratio) {
        case '1:1': return 'aspect-square';
        case '4:3': return 'aspect-[4/3]';
        case '3:4':
        default:
            return 'aspect-[3/4]';
    }
};

const MAX_PREVIEW_SEGMENTS = 10;

/**
 * RENAMED from PiecePreview.
 * This component is now responsible for rendering the VISUAL CARD of a Piece,
 * both in the library (as a preview) and potentially in other places.
 * It is NOT a full page reader.
 */
export const PieceRenderer: React.FC<PieceRendererProps> = ({ item, isPreview, chapterIndex = 0 }) => {
  const { t } = useTranslation(['createPage']);
  const [editorSettings] = useEditorSettings(item?.id || null);
  const pieceItem = item as Piece | null;

  const aspectRatioClass = useMemo(() => {
    if (pieceItem?.display === 'card') {
      return getAspectRatioClass(pieceItem.aspectRatio);
    }
    // For 'doc' style or when no item exists, default to portrait.
    return getAspectRatioClass('3:4');
  }, [pieceItem]);

  const segmentsToRender = useMemo((): Segment[] => {
    // If no item, show placeholder text.
    if (!pieceItem) {
      return [{ 
        id: 'p1', 
        order: 1, 
        type: 'text', 
        content: { primary: t('previewArea.piecePlaceholderDesktopHint') }, 
        formatting: {}, 
        metadata: { isNewPara: true, wordCount: {primary: 0}} as any
      }];
    }
    // If item is processing, show a loading indicator inside.
    if (pieceItem.contentState === 'processing') {
      return []; // Return empty array, the renderer will show a loading icon.
    }
    // Otherwise, get the actual segments.
    const allSegments = getItemSegments(pieceItem, chapterIndex);
    return isPreview ? allSegments.slice(0, MAX_PREVIEW_SEGMENTS) : allSegments;
  }, [pieceItem, chapterIndex, isPreview, t]);
  
  const cardClassName = useMemo(() => {
    return cn(
      "w-full shadow-xl overflow-hidden rounded-lg bg-background/95",
      // Set aspect ratio for the card itself.
      aspectRatioClass,
      // For a 'doc', it will have max-width, for 'card' it might be smaller.
      pieceItem?.display === 'doc' ? 'max-w-3xl' : 'max-w-md',
      editorSettings.background
    );
  }, [pieceItem?.display, editorSettings.background, aspectRatioClass]);

  const titleToDisplay = pieceItem?.title?.primary || t('previewArea.pieceTitleDesktop');

  return (
      <div className="piece-preview-container w-full h-full flex flex-col items-center justify-center gap-4">
          {!pieceItem && (
            <h3 className="font-headline text-xl text-primary md:text-2xl">{titleToDisplay}</h3>
          )}
          <div className={cardClassName}>
              <div className="h-full w-full overflow-y-auto @container/content-card">
                  {pieceItem?.contentState === 'processing' ? (
                      <div className="flex h-full w-full items-center justify-center">
                          <Icon name="Wand2" className="h-16 w-16 text-primary/80 animate-pulse" />
                      </div>
                  ) : (
                      <BookRenderer
                          page={{ pageIndex: 0, items: segmentsToRender, estimatedHeight: 0 }}
                          presentationStyle={pieceItem?.display || 'card'}
                          editorSettings={editorSettings}
                          itemData={item}
                      />
                  )}
              </div>
          </div>
      </div>
  );
};
