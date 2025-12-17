// src/lib/pagination/strategies/CardPaginator.ts
'use client';

import type { Page, Segment } from '@/lib/types';

/**
 * A simple pagination strategy for 'card' and 'doc' styles.
 * It currently puts all content onto a single page.
 * CQI (Container Query Units) in CSS will handle the responsive text sizing.
 */
export async function paginateCard(
  segments: Segment[]
): Promise<{ pages: Page[]; chapterStartPages: number[] }> {
  if (!segments || segments.length === 0) {
    return { pages: [], chapterStartPages: [] };
  }

  // For card/doc view, we currently render all content on one scrollable page.
  const singlePage: Page = {
    pageIndex: 0,
    items: segments,
    estimatedHeight: 1000 // A placeholder height
  };

  return {
    pages: [singlePage],
    chapterStartPages: [0] // The first (and only) chapter starts at page 0
  };
}
