// src/features/create/components/piece/PiecePreview.tsx
// This file is the wrapper for the PieceRenderer in the create view.

"use client";

import React from 'react';
import type { Piece, CreationFormValues } from '@/lib/types';
import { PieceRenderer } from '@/features/reader/components/PieceRenderer';

interface PiecePreviewProps {
  item: Piece | null;
  isBusy: boolean;
  formData: Partial<CreationFormValues>;
}

/**
 * A simple wrapper component for the create page.
 * It passes all necessary data down to the centralized PieceRenderer
 * configured for "preview" mode.
 */
export const PiecePreview: React.FC<PiecePreviewProps> = ({
  item,
  isBusy,
  formData
}) => {
  return (
    <PieceRenderer
      item={item}
      isBusy={isBusy}
      formData={formData}
      mode="preview"
    />
  );
};
