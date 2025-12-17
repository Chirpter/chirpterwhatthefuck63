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
  
  const containerHeight = container.clientHeight - 80; // Heuristic padding
  
  const pages: Page[] = [];
  const chapterStartPages: number[] = [];
  
  let currentPageItems: Segment[] = [];
  let currentPageHeight = 0;
  
  for (const segment of segments) {
    const estimatedHeight = segmentHeights.get(segment.id) || 20;

    if (segment.type === 'heading1') {
      if (currentPageItems.length > 0) {
        pages.push({ pageIndex: pages.length, items: currentPageItems, estimatedHeight: currentPageHeight });
        currentPageItems = [];
        currentPageHeight = 0;
      }
      chapterStartPages.push(pages.length);
    }
    
    if (currentPageHeight + estimatedHeight > containerHeight && currentPageItems.length > 0) {
      pages.push({ pageIndex: pages.length, items: currentPageItems, estimatedHeight: currentPageHeight });
      currentPageItems = [];
      currentPageHeight = 0;
    }
    
    currentPageItems.push(segment);
    currentPageHeight += estimatedHeight;
  }
  
  if (currentPageItems.length > 0) {
    pages.push({ pageIndex: pages.length, items: currentPageItems, estimatedHeight: currentPageHeight });
  }
  
  return { pages, chapterStartPages };
}
