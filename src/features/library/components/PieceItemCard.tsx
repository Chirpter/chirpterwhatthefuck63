// src/features/library/components/PieceItemCard.tsx

"use client";

import React from 'react';
import Link from 'next/link';
import type { Piece, LibraryItem } from "@/lib/types";
import { PieceRenderer } from '@/features/reader/components/PieceRenderer'; // UPDATED: Path to the new central renderer

interface PieceItemCardProps {
    work: Piece;
    onDelete?: (item: LibraryItem) => void;
}

/**
 * A simple, static "thumbnail" of a Piece item for the library view.
 * It wraps the centralized PieceRenderer component in a link.
 */
export function PieceItemCard({ work, onDelete }: PieceItemCardProps) {
  if (!work) return null;

  const isReadable = work.contentState === 'ready';

  if (!isReadable) {
    return null;
  }
  
  return (
    <Link href={`/read/${'${work.id}'}`} className="block break-inside-avoid">
        {/* The actual rendering is now fully delegated */}
        <PieceRenderer item={work} />
    </Link>
  );
}
