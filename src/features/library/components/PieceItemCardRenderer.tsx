// src/features/library/components/PieceItemCardRenderer.tsx
// UPDATED: This is now the single source of truth for rendering a Piece "card" or "preview".

"use client";

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Piece, EditorSettings, CreationFormValues } from "@/lib/types";
import { PieceRenderer } from '@/features/reader/components/PieceRenderer';
import { BookRenderer } from '@/features/reader/components/BookRenderer';
import { getItemSegments } from '@/services/shared/SegmentParser';
import { Icon } from '@/components/ui/icons';
import { useEditorSettings } from '@/hooks/useEditorSettings';

interface PieceItemCardRendererProps {
  item: Piece | null;
  isBusy?: boolean;
  formData?: Partial<CreationFormValues>;
}

/**
 * A component that acts as a preview or card for a 'Piece'.
 * It is responsible for rendering a static, non-scrollable view of the first part of a piece.
 */
export const PieceItemCardRenderer: React.FC<PieceItemCardRendererProps> = ({
  item,
  isBusy = false,
  formData = {},
}) => {
  const { t } = useTranslation(['createPage']);
  const [editorSettings] = useEditorSettings(item?.id || null);

  // Construct a temporary item for rendering based on form data or existing item data
  const constructedItem: Piece = useMemo(() => {
    return {
      ...(item || {}),
      presentationStyle: formData?.presentationStyle || item?.presentationStyle || 'card',
      aspectRatio: formData?.aspectRatio || item?.aspectRatio || '3:4',
      title: item?.title || { primary: t('previewArea.pieceTitleDesktop') },
      generatedContent: item?.generatedContent || [],
      contentState: isBusy ? 'processing' : (item ? item.contentState : 'pending'),
      // Ensure required fields for BaseLibraryItem are present
      id: item?.id || 'preview',
      userId: item?.userId || '',
      type: 'piece',
      origin: item?.origin || formData?.origin || 'en',
      langs: item?.langs || formData?.availableLanguages || ['en'],
      status: item?.status || 'draft',
      unit: item?.unit || formData?.unit || 'sentence',
    } as Piece;
  }, [item, isBusy, formData, t]);
  
  // Get all segments for the item.
  const allSegments = useMemo(() => getItemSegments(constructedItem, 0), [constructedItem]);

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
    
    // ✅ FIX: Simulate a "first page" by taking only the first few segments.
    // This is a simple heuristic to prevent overflow without full pagination logic.
    // A more advanced version could calculate height, but this is sufficient for a preview card.
    const firstPageSegments = allSegments.slice(0, 5);
    const firstPage = { pageIndex: 0, items: firstPageSegments, estimatedHeight: 0 };
    
    return (
        <BookRenderer
            page={firstPage}
            presentationStyle={constructedItem.presentationStyle}
            editorSettings={editorSettings}
            itemData={constructedItem}
            displayLang1={formData?.primaryLanguage || constructedItem.langs[0] || 'en'}
            displayLang2={formData?.availableLanguages?.[1] || constructedItem.langs[1] || 'none'}
        />
    );
  };
  
  return (
    <PieceRenderer item={constructedItem}>
        {renderInnerContent()}
    </PieceRenderer>
  );
};
