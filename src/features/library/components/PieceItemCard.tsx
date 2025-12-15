// src/features/library/components/PieceItemCard.tsx

"use client";

import React from 'react';
import Link from 'next/link';
import type { Piece, LibraryItem } from "@/lib/types";
import { PieceItemCardRenderer } from './PieceItemCardRenderer'; 

interface PieceItemCardProps {
    work: Piece;
    onDelete?: (item: LibraryItem) => void;
}

/**
 * A simple, static "thumbnail" of a Piece item for the library view.
 * It renders the centralized PieceItemCardRenderer component and wraps it in a link.
 */
export function PieceItemCard({ work, onDelete }: PieceItemCardProps) {
  if (!work) return null;

  const isReadable = work.contentState === 'ready';

  if (!isReadable) {
    // For now, we don't render processing/error cards for pieces in the library
    // as they are generated quickly. This can be expanded later if needed.
    return null;
  }
  
  // This component acts as a linkable card for the library.
  // The actual visual representation is handled by PieceItemCardRenderer.
  return (
    <Link href={`/read/${work.id}`} className="block break-inside-avoid">
        <PieceItemCardRenderer item={work} />
    </Link>
  );
}
