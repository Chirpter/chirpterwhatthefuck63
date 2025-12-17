// src/services/shared/MarkdownParser.ts

import type { Segment, Book, Piece, MultilingualContent, LanguageBlock } from '@/lib/types';
import { generateLocalUniqueId } from '@/lib/utils';
import { segmentize } from './SegmentParser';

/**
 * Calculates total word count from segments, handling both string and array content.
 */
function calculateTotalWords(segments: Segment[], primaryLang: string): number {
    return segments.reduce((sum, seg) => {
        const langBlock = seg.content.find(c => typeof c === 'object') as LanguageBlock | undefined;
        if (langBlock && langBlock[primaryLang]) {
            const text = langBlock[primaryLang];
            return sum + (text.split(/\s+/).filter(Boolean).length || 0);
        }
        return sum;
    }, 0);
}


/**
 * Helper to extract segments from library items.
 */
export function getItemSegments(
    item: Book | Piece | null
): Segment[] {
    if (!item) return [];

    // The content is already a Segment[] array, so just return it.
    if(item.type === 'book' || item.type === 'piece') {
        return item.generatedContent || [];
    }
    return [];
}
