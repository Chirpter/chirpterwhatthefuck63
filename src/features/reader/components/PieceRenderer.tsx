// src/features/reader/components/PieceRenderer.tsx

"use client";

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { Piece } from '@/lib/types';
import { useEditorSettings } from '@/hooks/useEditorSettings';
import { BookRenderer } from './BookRenderer';
import { getItemSegments } from '@/services/shared/SegmentParser';
import { Icon } from '@/components/ui/icons';

interface PieceRendererProps {
  item: Piece | null; // Allow null
  children?: React.ReactNode;
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
 * The PieceRenderer acts as a 'frame' for Piece content.
 * It is responsible for creating a container with the correct presentation style
 * and aspect ratio. It renders children passed into it.
 */
export const PieceRenderer: React.FC<PieceRendererProps> = ({ 
  item,
  children,
  className,
}) => {
  const [editorSettings] = useEditorSettings(item?.id || null);
  
  const aspectRatioClass = useMemo(() => {
    if (item?.presentationStyle === 'card') {
      return getAspectRatioClass(item.aspectRatio);
    }
    // 'doc' style always defaults to 3:4 portrait.
    return getAspectRatioClass('3:4');
  }, [item]);

  const cardClassName = useMemo(() => {
    return cn(
      "w-full shadow-xl rounded-lg bg-background/95", // Removed overflow-hidden from the main container
      aspectRatioClass,
      item?.presentationStyle === 'doc' ? 'max-w-3xl mx-auto' : 'max-w-md',
      className,
    );
  }, [item?.presentationStyle, aspectRatioClass, className]);

  return (
      <div className={cardClassName}>
          {/* ✅ FIX: Moved overflow-hidden to an inner div. 
              This clips the content inside the card but allows the card itself to have shadows etc.
              Removed overflow-y-auto to make it a static preview. */}
          <div className="h-full w-full overflow-hidden">
              {children}
          </div>
      </div>
  );
};
