// src/features/library/components/PieceItemCard.tsx
"use client";

import React from 'react';
import Link from 'next/link';
import type { Piece, LibraryItem } from "@/lib/types";
import PieceReader from '@/features/reader/components/piece/PieceReader';

interface PieceItemCardProps {
    work: Piece;
    onDelete?: (item: LibraryItem) => void;
}

/**
 * REFACTORED: The PieceItemCard now renders a preview of the content
 * using the centralized PieceReader in `isPreview` mode.
 * It is wrapped in a Link to navigate to the full reader view.
 */
export function PieceItemCard({ work, onDelete }: PieceItemCardProps) {
  if (!work || work.contentState !== 'ready') return null;
  
  return (
    <Link href={`/read/${work.id}`} className="block break-inside-avoid">
        {/* We render the PieceReader directly here in preview mode */}
        <PieceReader piece={work} isPreview />
    </Link>
  );
}
