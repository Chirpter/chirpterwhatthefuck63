// src/features/library/components/PieceItemCard.tsx

"use client";

import React from 'react';
import Link from 'next/link';
import type { Piece, LibraryItem } from "@/lib/types";
import { PieceRenderer } from '@/features/reader/components/PieceRenderer';

interface PieceItemCardProps {
    work: Piece;
    onDelete?: (item: LibraryItem) => void;
}

/**
 * The PieceItemCard component is now a simple wrapper.
 * Its sole responsibility is to provide the Link to the full reader view.
 * The actual visual representation is handled by the centralized PieceRenderer
 * in "preview" mode.
 */
export function PieceItemCard({ work, onDelete }: PieceItemCardProps) {
  if (!work || work.contentState !== 'ready') return null;
  
  return (
    <Link href={`/read/${work.id}`} className="block break-inside-avoid">
        <PieceRenderer 
          item={work} 
          mode="preview" 
        />
    </Link>
  );
}
