// src/lib/pagination/strategies/DocPaginator.ts
'use client';

import type { Page, Segment, ContentUnit } from '@/lib/types';
import { SegmentCalibrator } from '../SegmentCalibrator';

/**
 * A4 Document Paginator
 * - Fixed A4 aspect ratio (210:297 ≈ 0.707)
 * - Height-based pagination (similar to Book)
 * - No chapter start rules
 * - No orphan prevention
 */

async function measureSegmentHeights(
  segments: Segment[],
  calibrator: SegmentCalibrator,
  displayLang1: string,
  displayLang2: string,
  unit: ContentUnit
): Promise<Map<string, number>> {
  const heightMap = new Map<string, number>();
  
  for (const segment of segments) {
    const height = await calibrator.getSegmentHeight(segment, displayLang1, displayLang2, unit);
    heightMap.set(segment.id, height);
  }
  
  return heightMap;
}

export async function paginateDoc(
  segments: Segment[],
  container: HTMLElement,
  displayLang1: string,
  displayLang2: string,
  unit: ContentUnit
): Promise<{ pages: Page[]; chapterStartPages: number[] }> {
  
  if (!segments || segments.length === 0 || !container) {
    return { pages: [], chapterStartPages: [] };
  }

  const calibrator = new SegmentCalibrator(container);
  const segmentHeights = await measureSegmentHeights(segments, calibrator, displayLang1, displayLang2, unit);
  calibrator.cleanup();

  // Apply padding adjustment to container height
  const containerHeight = container.clientHeight - 80;

  const pages: Page[] = [];
  let currentPageItems: Segment[] = [];
  let currentPageHeight = 0;

  for (const segment of segments) {
    const estimatedHeight = segmentHeights.get(segment.id) || 20;

    // If adding this segment would overflow the page, create a new page
    if (currentPageHeight + estimatedHeight > containerHeight && currentPageItems.length > 0) {
      pages.push({
        pageIndex: pages.length,
        items: currentPageItems,
        estimatedHeight: currentPageHeight
      });
      currentPageItems = [];
      currentPageHeight = 0;
    }

    currentPageItems.push(segment);
    currentPageHeight += estimatedHeight;
  }

  // Add the last page if there's any remaining content
  if (currentPageItems.length > 0) {
    pages.push({
      pageIndex: pages.length,
      items: currentPageItems,
      estimatedHeight: currentPageHeight
    });
  }

  // For Doc, all content is on one continuous document
  // Chapter starts are just for reference, not enforced in layout
  const chapterStartPages: number[] = [];
  segments.forEach((segment, index) => {
    const firstContent = segment.content[0];
    if (typeof firstContent === 'string' && firstContent.trim().startsWith('#')) {
      // Find which page this segment is on
      for (let i = 0; i < pages.length; i++) {
        if (pages[i].items.some(item => item.id === segment.id)) {
          if (!chapterStartPages.includes(i)) {
            chapterStartPages.push(i);
          }
          break;
        }
      }
    }
  });

  // If no headings found, mark first page as chapter start
  if (chapterStartPages.length === 0 && pages.length > 0) {
    chapterStartPages.push(0);
  }

  return { pages, chapterStartPages };
}