// src/lib/pagination/PageCalculator.ts
'use client';

import type { Page, Segment, ContentUnit } from '@/lib/types';
import { PaginationCache } from './cache/PaginationCache';
import { paginateBook } from './strategies/BookPaginator';
import { paginateCard } from './strategies/CardPaginator';
import { paginateDoc } from './strategies/DocPaginator';

/**
 * Main pagination router with cache integration
 * Routes to appropriate strategy based on presentation style
 */
export async function calculatePages(
  segments: Segment[],
  container: HTMLElement,
  presentationStyle: 'book' | 'doc' | 'card',
  aspectRatio: '1:1' | '3:4' | '4:3' | undefined,
  displayLang1: string,
  displayLang2: string,
  unit: ContentUnit,
  itemId?: string,
  fontSize: 'sm' | 'base' | 'lg' = 'base'
): Promise<{ pages: Page[]; chapterStartPages: number[] }> {
  
  // Check cache first (if itemId provided)
  if (itemId) {
    const cached = PaginationCache.get({
      itemId,
      width: container.clientWidth,
      height: container.clientHeight,
      fontSize,
      displayLang1,
      displayLang2,
      presentationStyle,
      aspectRatio
    });

    if (cached) {
      console.log('[PageCalculator] ✅ Cache hit');
      return {
        pages: cached.pages,
        chapterStartPages: cached.chapterStartPages
      };
    }
  }

  console.log('[PageCalculator] 🔄 Calculating pages...');
  
  let result: { pages: Page[]; chapterStartPages: number[] };

  // Route to appropriate pagination strategy
  if (presentationStyle === 'book') {
    result = await paginateBook(segments, container, displayLang1, displayLang2, unit, fontSize);
  } else if (presentationStyle === 'doc') {
    result = await paginateDoc(segments, container, displayLang1, displayLang2, unit);
  } else {
    // Card style
    result = await paginateCard(segments, aspectRatio);
  }

  // Cache the result (if itemId provided)
  if (itemId) {
    PaginationCache.set(
      {
        itemId,
        width: container.clientWidth,
        height: container.clientHeight,
        fontSize,
        displayLang1,
        displayLang2,
        presentationStyle,
        aspectRatio
      },
      result.pages,
      result.chapterStartPages
    );
  }

  console.log('[PageCalculator] ✅ Pagination complete:', {
    pages: result.pages.length,
    chapters: result.chapterStartPages.length
  });

  return result;
}