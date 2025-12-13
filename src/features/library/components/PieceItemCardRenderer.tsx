// src/features/library/components/PieceItemCardRenderer.tsx

"use client";

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useEditorSettings } from '@/hooks/useEditorSettings';
import { PageContentRenderer } from '@/features/reader/components/PageContentRenderer';
import type { LibraryItem } from '@/lib/types';
import { getItemSegments } from '@/services/shared/MarkdownParser';
import { Icon } from '@/components/ui/icons';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface PieceItemCardRendererProps {
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
export const PieceItemCardRenderer: React.FC<PieceItemCardRendererProps> = ({ item, isPreview, chapterIndex = 0 }) => {
  const { t } = useTranslation('createPage');
  const [editorSettings] = useEditorSettings(item?.id || null);

  const aspectRatioClass = item?.type === 'piece' ? getAspectRatioClass(item.aspectRatio) : '';

  const segmentsToRender = useMemo(() => {
      if (!item) return [];
      const allSegments = getItemSegments(item, chapterIndex);
      if (isPreview) {
          // Only take a few segments for the preview to optimize performance
          return allSegments.slice(0, MAX_PREVIEW_SEGMENTS);
      }
      return allSegments;
  }, [item, chapterIndex, isPreview]);
  
  const cardClassName = useMemo(() => {
    return cn(
      "w-full shadow-xl overflow-hidden",
      item?.display === 'card' 
        ? `max-w-md ${aspectRatioClass}` 
        : 'max-w-3xl h-full', // For book mode, allow full height
      editorSettings.background,
      isPreview ? "h-full" : "max-h-full"
    );
  }, [item?.display, editorSettings.background, aspectRatioClass, isPreview]);


  // ---- RENDER LOGIC ----
  
  // Loading state (used in CreateView)
  if (!item && !isPreview) {
     return (
      <div className={cn("flex flex-col items-center justify-center text-center h-full")}>
        <Icon name="Wand2" className="h-16 w-16 text-primary/80 mx-auto mb-4 animate-pulse" />
        <p className="text-md text-muted-foreground font-body">{t('status.contentProcessing')}</p>
        <p className="text-sm text-muted-foreground/70 font-body mt-2">{t('loading.stayOnPage')}</p>
      </div>
    );
  }
  
  // Finalized state (used in CreateView)
  if (item && item.contentState !== 'processing' && !isPreview) {
     return (
        <div className={cn("h-full w-full flex flex-col items-center justify-center")}>
            <div className={cardClassName}>
                <div className="h-full overflow-y-auto @container/content-card">
                    <PageContentRenderer
                        page={{ pageIndex: 0, items: segmentsToRender, estimatedHeight: 0 }}
                        presentationStyle={item.display}
                        editorSettings={editorSettings}
                        itemData={item}
                    />
                </div>
            </div>
             <div className="mt-4 text-center space-y-2">
                <Button variant="link" asChild className="text-lg font-semibold font-headline p-0 h-auto">
                    <Link href="/library/piece">
                        <Icon name="Library" className="mr-2 h-5 w-5" />
                        {t('status.complete')}
                    </Link>
                </Button>
            </div>
        </div>
    );
  }

  // Initial state or library preview state
  const isInitialState = !item;
  const finalSegments = isInitialState ? [{ id: 'p1', order: 1, type: 'text', content: { primary: t('previewArea.piecePlaceholderDesktopHint') }, formatting: {}, metadata: { isNewPara: true, wordCount: {primary: 0}} }] : segmentsToRender;
  
  return (
      <div className="piece-preview-container w-full h-full flex flex-col items-center justify-center">
          {isInitialState && <h3 className="font-headline text-xl text-primary mb-2 md:text-2xl md:mb-4">{t('previewArea.pieceTitleDesktop')}</h3>}
          <div className={cardClassName}>
              <div className="h-full w-full overflow-y-auto @container/content-card" >
                  <PageContentRenderer
                      page={{ pageIndex: 0, items: finalSegments, estimatedHeight: 0 }}
                      presentationStyle={item?.display || 'card'}
                      editorSettings={editorSettings}
                      itemData={item}
                  />
              </div>
          </div>
      </div>
  );
};
