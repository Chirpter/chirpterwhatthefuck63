// src/lib/pagination/strategies/BookPaginator.ts
'use client';

import type { Page, Segment, ContentUnit } from '@/lib/types';
import { SegmentCalibrator } from '../SegmentCalibrator';

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

export async function paginateBook(
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
  
  // Apply a heuristic padding adjustment to the container height
  const containerHeight = container.clientHeight - 80;
  
  const pages: Page[] = [];
  const chapterStartPages: number[] = [];
  
  let currentPageItems: Segment[] = [];
  let currentPageHeight = 0;
  let isFirstSegmentOfChapter = false;

  for (const segment of segments) {
    const isHeading = typeof segment.content[0] === 'string' && segment.content[0].startsWith('#');
    const estimatedHeight = segmentHeights.get(segment.id) || 20;
    
    // If it's a heading, it MUST start a new page
    if (isHeading) {
      // If there's content on the current page, finalize it first
      if (currentPageItems.length > 0) {
        pages.push({ pageIndex: pages.length, items: currentPageItems, estimatedHeight: currentPageHeight });
      }
      // Reset for the new chapter page
      currentPageItems = [];
      currentPageHeight = 0;
      // Record the index of the page where this chapter starts
      chapterStartPages.push(pages.length);
      isFirstSegmentOfChapter = true; // Mark the next segment as the first after a heading
    }
    
    // If adding the next segment would overflow the page, create a new page
    if (currentPageHeight + estimatedHeight > containerHeight && currentPageItems.length > 0) {
      pages.push({ pageIndex: pages.length, items: currentPageItems, estimatedHeight: currentPageHeight });
      currentPageItems = [];
      currentPageHeight = 0;
      // If a chapter was just started on the previous page, this new page is part of the same chapter
      if (isFirstSegmentOfChapter) {
          isFirstSegmentOfChapter = false;
      }
    }
    
    currentPageItems.push(segment);
    currentPageHeight += estimatedHeight;
  }
  
  // Add the last page if there's any remaining content
  if (currentPageItems.length > 0) {
    pages.push({ pageIndex: pages.length, items: currentPageItems, estimatedHeight: currentPageHeight });
  }

  // Ensure there's at least one chapter start if content exists
  if (segments.length > 0 && chapterStartPages.length === 0) {
      chapterStartPages.push(0);
  }
  
  return { pages, chapterStartPages };
}
