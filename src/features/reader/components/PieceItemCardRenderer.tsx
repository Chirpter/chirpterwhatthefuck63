// src/features/library/components/PieceItemCardRenderer.tsx

"use client";

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { LibraryItem, Piece, Segment } from '@/lib/types';
import { Icon } from '@/components/ui/icons';
import { useTranslation } from 'react-i18next';

interface PieceItemCardRendererProps {
  item: Piece | null;
  children: React.ReactNode;
  className?: string;
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

/**
 * REFACTORED: This component is now ONLY a "frame" or "Lego block for ratio".
 * It is responsible for creating a container with the correct presentation style
 * and aspect ratio for 'doc' and 'card' types.
 * It renders any children passed into it, which will typically be the PageContentRenderer.
 */
export const PieceItemCardRenderer: React.FC<PieceItemCardRendererProps> = ({ 
  item,
  children,
  className,
}) => {
  const { t } = useTranslation(['createPage']);

  const aspectRatioClass = useMemo(() => {
    if (item?.presentationStyle === 'card') {
      return getAspectRatioClass(item.aspectRatio);
    }
    // 'doc' style always defaults to 3:4 portrait.
    return getAspectRatioClass('3:4');
  }, [item]);

  const cardClassName = useMemo(() => {
    return cn(
      "w-full shadow-xl overflow-hidden rounded-lg bg-background/95",
      // Set aspect ratio for the card itself.
      aspectRatioClass,
      // For a 'doc', it will have max-width, for 'card' it might be smaller.
      item?.presentationStyle === 'doc' ? 'max-w-3xl' : 'max-w-md',
      className,
    );
  }, [item?.presentationStyle, aspectRatioClass, className]);

  return (
      <div className={cardClassName}>
          <div className="h-full w-full overflow-y-auto @container/content-card">
              {children}
          </div>
      </div>
  );
};
