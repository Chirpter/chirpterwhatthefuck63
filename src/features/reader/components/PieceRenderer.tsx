// src/features/reader/components/PieceRenderer.tsx

"use client";

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { Piece, EditorSettings, CreationFormValues } from '@/lib/types';
import { BookRenderer } from '@/features/reader/components/BookRenderer';
import { getItemSegments } from '@/services/shared/SegmentParser';
import { Icon } from '@/components/ui/icons';
import { useEditorSettings } from '@/hooks/useEditorSettings';

const PREVIEW_SEGMENT_LIMIT = 5;

const getAspectRatioClass = (ratio?: '1:1' | '3:4' | '4:3'): string => {
  switch (ratio) {
    case '1:1': return 'aspect-square';
    case '4:3': return 'aspect-[4/3]';
    case '3:4':
    default:
      return 'aspect-[3/4]';
  }
};

interface PieceRendererProps {
  item: Piece | null;
  isBusy?: boolean;
  formData?: Partial<CreationFormValues>;
  mode?: 'full' | 'preview';
  className?: string;
}

/**
 * This is the CENTRALIZED component for rendering a "Piece".
 * It can render in two modes:
 * - 'full': For the reader page, displays all content and scrolls.
 * - 'preview': For library cards and the create page preview, displays only the first
 *   few segments and does not scroll, acting as a static thumbnail.
 */
export const PieceRenderer: React.FC<PieceRendererProps> = ({
  item,
  isBusy = false,
  formData = {},
  mode = 'full',
  className,
}) => {
  const { t } = useTranslation(['createPage']);
  const [editorSettings] = useEditorSettings(item?.id || null);

  const constructedItem: Piece = useMemo(() => {
    return {
      ...(item || {}),
      presentationStyle: formData?.presentationStyle || item?.presentationStyle || 'card',
      aspectRatio: formData?.aspectRatio || item?.aspectRatio || '3:4',
      title: item?.title || { primary: t('previewArea.pieceTitleDesktop') },
      generatedContent: item?.generatedContent || [],
      contentState: isBusy ? 'processing' : (item ? item.contentState : 'pending'),
      id: item?.id || 'preview',
      userId: item?.userId || '',
      type: 'piece',
      origin: item?.origin || formData?.origin || 'en',
      langs: item?.langs || formData?.availableLanguages || ['en'],
      status: item?.status || 'draft',
      unit: item?.unit || formData?.unit || 'sentence',
    } as Piece;
  }, [item, isBusy, formData, t]);
  
  const allSegments = useMemo(() => getItemSegments(constructedItem, 0), [constructedItem]);
  const aspectRatioClass = useMemo(() => getAspectRatioClass(constructedItem.aspectRatio), [constructedItem.aspectRatio]);

  const cardClassName = useMemo(() => {
    return cn(
      "w-full shadow-xl rounded-lg overflow-hidden",
      "transition-all duration-300",
      aspectRatioClass,
      mode === 'preview' ? 'bg-card' : editorSettings.background,
      item?.presentationStyle === 'doc' ? 'max-w-3xl mx-auto' : 'max-w-md',
      className
    );
  }, [item?.presentationStyle, aspectRatioClass, className, mode, editorSettings.background]);


  const renderInnerContent = () => {
    if (isBusy) {
      return (
        <div className="flex h-full w-full items-center justify-center">
            <Icon name="Wand2" className="h-16 w-16 text-primary/80 animate-pulse" />
        </div>
      );
    }
    
    if (!item || allSegments.length === 0) {
        return (
             <div className="flex h-full w-full items-center justify-center p-8 text-center text-muted-foreground">
                <p>{t('previewArea.piecePlaceholder')}</p>
            </div>
        );
    }
    
    const segmentsToRender = mode === 'preview' ? allSegments.slice(0, PREVIEW_SEGMENT_LIMIT) : allSegments;
    const pageToRender = { pageIndex: 0, items: segmentsToRender, estimatedHeight: 0 };
    
    return (
        <BookRenderer
            page={pageToRender}
            presentationStyle={constructedItem.presentationStyle}
            editorSettings={editorSettings}
            itemData={constructedItem}
            displayLang1={formData?.primaryLanguage || constructedItem.langs[0] || 'en'}
            displayLang2={formData?.availableLanguages?.[1] || constructedItem.langs[1] || 'none'}
        />
    );
  };
  
  return (
    <div className={cardClassName}>
      <div className={cn("w-full h-full", mode === 'full' && 'overflow-y-auto')}>
        {renderInnerContent()}
      </div>
    </div>
  );
};
