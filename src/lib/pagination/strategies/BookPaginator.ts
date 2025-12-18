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
  
  // Process in chunks of 50 for better performance
  const chunkSize = 50;
  for (let i = 0; i < segments.length; i += chunkSize) {
    const chunk = segments.slice(i, i + chunkSize);
    
    for (const segment of chunk) {
      const height = await calibrator.getSegmentHeight(segment, displayLang1, displayLang2, unit);
      heightMap.set(segment.id, height);
    }
    
    // Allow browser to breathe between chunks
    if (i + chunkSize < segments.length) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  
  return heightMap;
}

export async function paginateBook(
  segments: Segment[],
  container: HTMLElement,
  displayLang1: string,
  displayLang2: string,
  unit: ContentUnit,
  fontSize: 'sm' | 'base' | 'lg' = 'base'
): Promise<{ pages: Page[]; chapterStartPages: number[] }> {
  
  if (!segments || segments.length === 0 || !container) {
    return { pages: [], chapterStartPages: [] };
  }
  
  // Temporarily apply fontSize to container for accurate measurement
  const originalClassName = container.className;
  const fontSizeClass = `prose-${fontSize}`;
  
  if (!container.className.includes(fontSizeClass)) {
    container.className = container.className
      .replace(/prose-(sm|base|lg)/g, '')
      .trim() + ` ${fontSizeClass}`;
  }
  
  const calibrator = new SegmentCalibrator(container);
  const segmentHeights = await measureSegmentHeights(segments, calibrator, displayLang1, displayLang2, unit);
  calibrator.cleanup();
  
  // Restore original className
  container.className = originalClassName;
  
  // Apply padding adjustment to container height
  const containerHeight = container.clientHeight - 80;
  
  const pages: Page[] = [];
  const chapterStartPages: number[] = [];
  
  let currentPageItems: Segment[] = [];
  let currentPageHeight = 0;

  for (const segment of segments) {
    const isHeading = typeof segment.content[0] === 'string' && segment.content[0].trim().startsWith('#');
    const estimatedHeight = segmentHeights.get(segment.id) || 20;
    
    // CRITICAL: If it's a heading, it MUST start a new page
    if (isHeading) {
      // If there's content on the current page, finalize it first
      if (currentPageItems.length > 0) {
        pages.push({
          pageIndex: pages.length,
          items: currentPageItems,
          estimatedHeight: currentPageHeight
        });
      }
      
      // Reset for the new chapter page
      currentPageItems = [];
      currentPageHeight = 0;
      
      // Record the page index where this chapter starts
      chapterStartPages.push(pages.length);
    }
    
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

  // Ensure there's at least one chapter start if content exists
  if (segments.length > 0 && chapterStartPages.length === 0) {
    chapterStartPages.push(0);
  }
  
  return { pages, chapterStartPages };
}