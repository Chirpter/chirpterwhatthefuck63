// src/lib/pagination/strategies/CardPaginator.ts
'use client';

import type { Page, Segment } from '@/lib/types';

/**
 * Card Pagination Strategy
 * - Single scrollable page (no flip pagination)
 * - CQI (Container Query Units) handle responsive text sizing
 * - Aspect ratio enforced at component level
 * - All content fits on one page with scroll if needed
 */
export async function paginateCard(
  segments: Segment[],
  aspectRatio?: '1:1' | '3:4' | '4:3'
): Promise<{ pages: Page[]; chapterStartPages: number[] }> {
  
  if (!segments || segments.length === 0) {
    return { pages: [], chapterStartPages: [] };
  }

  // For card view, all content goes on a single scrollable page
  const singlePage: Page = {
    pageIndex: 0,
    items: segments,
    estimatedHeight: 0 // Height is determined by container aspect ratio
  };

  return {
    pages: [singlePage],
    chapterStartPages: [0] // Single page means single chapter start
  };
}