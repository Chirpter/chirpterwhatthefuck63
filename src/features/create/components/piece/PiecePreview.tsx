// src/features/create/components/piece/PiecePreview.tsx
// NEW FILE: This component replaces the old PieceRenderer in the create feature.

"use client";

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { Piece, EditorSettings, CreationFormValues } from '@/lib/types';
import { PieceRenderer } from '@/features/reader/components/PieceRenderer';
import { BookRenderer } from '@/features/reader/components/BookRenderer';
import { getItemSegments } from '@/services/shared/SegmentParser';
import { Icon } from '@/components/ui/icons';

interface PiecePreviewProps {
  item: Piece | null;
  isBusy: boolean;
  editorSettings?: EditorSettings;
  formData?: CreationFormValues;
}

/**
 * A preview component specifically for the 'create' page.
 * It uses the main PieceRenderer as a frame and displays the content being generated.
 */
export const PiecePreview: React.FC<PiecePreviewProps> = ({
  item,
  isBusy,
  editorSettings,
  formData
}) => {
  const { t } = useTranslation(['createPage']);
  
  const constructedItem: Piece = useMemo(() => {
    // Construct a temporary item for rendering based on form data or job data
    return {
      ...(item || {}),
      presentationStyle: formData?.presentationStyle as 'doc' | 'card' || item?.presentationStyle || 'card',
      aspectRatio: formData?.aspectRatio || item?.aspectRatio || '3:4',
      title: item?.title || { primary: t('previewArea.pieceTitleDesktop') },
      generatedContent: item?.generatedContent || [],
      contentState: isBusy ? 'processing' : (item ? item.contentState : 'pending'),
    } as Piece;
  }, [item, isBusy, formData, t]);
  
  const segments = getItemSegments(constructedItem, 0);

  const renderInnerContent = () => {
    if (isBusy) {
      return (
        <div className="flex h-full w-full items-center justify-center">
            <Icon name="Wand2" className="h-16 w-16 text-primary/80 animate-pulse" />
        </div>
      );
    }
    
    if (!item || segments.length === 0) {
        return (
             <div className="flex h-full w-full items-center justify-center p-8 text-center text-muted-foreground">
                <p>{t('previewArea.piecePlaceholder')}</p>
            </div>
        )
    }

    return (
        <BookRenderer
            page={{ pageIndex: 0, items: segments, estimatedHeight: 0 }}
            presentationStyle={constructedItem.presentationStyle}
            editorSettings={editorSettings!}
            itemData={constructedItem}
            displayLang1={formData?.primaryLanguage || 'en'}
            displayLang2={formData?.availableLanguages[1] || 'none'}
        />
    );
  };
  
  return (
    <div className={cn("w-full h-full flex items-center justify-center p-4", editorSettings?.background)}>
        <PieceRenderer item={constructedItem}>
            {renderInnerContent()}
        </PieceRenderer>
    </div>
  );
};
