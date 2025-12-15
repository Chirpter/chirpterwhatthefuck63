// src/features/library/components/PieceItemCard.tsx

"use client";

import React from 'react';
import Link from 'next/link';
import type { Piece, LibraryItem } from "@/lib/types";
import { PieceRenderer } from '@/features/reader/components/PieceRenderer'; // UPDATED IMPORT

interface PieceItemCardProps {
    work: Piece;
    onDelete?: (item: LibraryItem) => void;
}

/**
 * A simple, static "thumbnail" of a Piece item for the library view.
 * It renders the new lightweight PieceRenderer component, ensuring visual consistency.
 * It acts as a link to the full reader view.
 */
export function PieceItemCard({ work, onDelete }: PieceItemCardProps) {
  if (!work) return null;

  const isReadable = work.contentState === 'ready';

  if (!isReadable) {
    // For now, we don't render processing/error cards for pieces in the library
    // as they are generated quickly. This can be expanded later if needed.
    return null;
  }

  // A simple wrapper could be added here to include a delete button if needed,
  // similar to how BookItemCard handles it.
  // For now, we keep it as a direct link.

  return (
    <Link href={`/read/${work.id}`} className="block break-inside-avoid">
        <PieceRenderer item={work}>
            {/* The actual content is rendered on the reader page. 
                This preview could show a snippet or a placeholder. 
                For now, it's handled by the renderer's logic. */}
        </PieceRenderer>
    </Link>
  );
}
