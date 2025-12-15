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
 * The PieceItemCard component is now a simple wrapper.
 * Its sole responsibility is to provide the Link to the full reader view.
 * The actual visual representation is handled by the centralized PieceReader
 * in "preview" mode.
 */
export function PieceItemCard({ work, onDelete }: PieceItemCardProps) {
  if (!work || work.contentState !== 'ready') return null;
  
  return (
    <Link href={`/read/${work.id}`} className="block break-inside-avoid">
        {/* We pass a simplified version of the Piece to the reader for preview */}
        <PieceReader piece={work} isPreview />
    </Link>
  );
}
