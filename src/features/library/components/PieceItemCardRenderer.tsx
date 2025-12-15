// src/features/library/components/PieceItemCardRenderer.tsx
// NEW COMPONENT: This is the single source of truth for rendering a Piece "card" or "preview".

"use client";

import React, { useMemo } from 'react';
import type { Piece } from "@/lib/types";
import { PieceRenderer } from '@/features/reader/components/PieceRenderer';
import { BookRenderer } from '@/features/reader/components/BookRenderer';
import { getItemSegments } from '@/services/shared/SegmentParser';
import { useEditorSettings } from '@/hooks/useEditorSettings';
import { useAudioPlayer } from '@/contexts/audio-player-context';

interface PieceItemCardRendererProps {
  item: Piece;
}

export function PieceItemCardRenderer({ item }: PieceItemCardRendererProps) {
  const [editorSettings] = useEditorSettings(item.id);
  const segments = useMemo(() => getItemSegments(item, 0), [item]);
  
  // Get language display settings from the audio player or fall back to defaults
  const { displayLang1 = item.langs[0] || 'en', displayLang2 = item.langs[1] || 'none' } = useAudioPlayer();

  const firstPage = useMemo(() => ({
    pageIndex: 0,
    items: segments, // For cards, we show all content, letting the frame handle overflow
    estimatedHeight: 0
  }), [segments]);
  
  return (
    <PieceRenderer item={item}>
      <BookRenderer
        page={firstPage}
        presentationStyle={item.presentationStyle}
        editorSettings={editorSettings}
        itemData={item}
        displayLang1={displayLang1}
        displayLang2={displayLang2}
      />
    </PieceRenderer>
  );
}
