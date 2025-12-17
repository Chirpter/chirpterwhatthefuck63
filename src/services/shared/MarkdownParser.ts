// src/services/shared/MarkdownParser.ts

import type { Segment, Book, Piece, MultilingualContent, LibraryItem } from '@/lib/types';
import { generateLocalUniqueId } from '@/lib/utils';
import { segmentize } from './SegmentParser';

/**
 * Helper to extract segments from library items.
 */
export function getItemSegments(
    item: LibraryItem | null
): Segment[] {
    if (!item) return [];

    // The content is already a Segment[] array, so just return it.
    return item.content || [];
}
