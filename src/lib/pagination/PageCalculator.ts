'use client';

import type { Page, Segment } from '@/lib/types';
import type { SegmentCalibrator, CalibrationBaseline } from './SegmentCalibrator';

// A heuristic for the extra vertical space added by new paragraphs (e.g., margin-top).
const PARAGRAPH_SPACING_HEURISTIC = 16; 

/**
 * The definitive pagination engine. It uses a calibrated baseline to divide a flat list of items (Segment)
 * into virtual pages, ensuring no content overflows the container height.
 */
export class PageCalculator {
  private calibrator: SegmentCalibrator;

  constructor(calibrator: SegmentCalibrator) {
    this.calibrator = calibrator;
  }
  
  /**
   * Calculates pages for an entire book's worth of segments.
   * @param allBookSegments - A single flat array of all segments from all chapters.
   * @returns A promise resolving to an object with the pages array and an array of chapter start page indices.
   */
  public async calculatePagesForBook(allBookSegments: Segment[]): Promise<{ pages: Page[], chapterStartPages: number[] }> {
    const baseline = await this.calibrator.calibrate(allBookSegments);
    const pages: Page[] = [];
    let chapterStartPages: number[] = [];
    let currentPageItems: Segment[] = [];
    let currentHeight = 0;

    for (let i = 0; i < allBookSegments.length; i++) {
        const currentItem = allBookSegments[i];
        
        // --- Chapter Handling Logic ---
        // This is a placeholder for future chapter detection.
        // For now, we assume chapters start with a new page if they contain a heading.
        const content = (currentItem.content.primary || currentItem.content.en || '') as string;
        if (typeof content === 'string' && content.startsWith('##')) {
            if (currentPageItems.length > 0) {
                pages.push({ pageIndex: pages.length, items: currentPageItems, estimatedHeight: currentHeight });
                currentPageItems = [];
                currentHeight = 0;
            }
            chapterStartPages.push(pages.length);
        }

        // --- Height Calculation Logic ---
        const itemHeight = this.estimateItemHeight(currentItem, baseline);

        // --- Page Breaking Logic ---
        if (itemHeight > baseline.containerHeight && currentPageItems.length > 0) {
            pages.push({ pageIndex: pages.length, items: currentPageItems, estimatedHeight: currentHeight });
            currentPageItems = [];
            currentHeight = 0;
        }

        if (currentHeight + itemHeight > baseline.containerHeight && currentPageItems.length > 0) {
            pages.push({ pageIndex: pages.length, items: currentPageItems, estimatedHeight: currentHeight });
            currentPageItems = [currentItem];
            currentHeight = this.estimateItemHeight(currentItem, baseline);
        } else {
            currentPageItems.push(currentItem);
            currentHeight += itemHeight;
        }
    }

    if (currentPageItems.length > 0) {
        pages.push({ pageIndex: pages.length, items: currentPageItems, estimatedHeight: currentHeight });
    }
    
    if (chapterStartPages.length === 0 && allBookSegments.length > 0) {
      chapterStartPages.push(0);
    }
    
    return { pages, chapterStartPages };
  }

  /**
   * Estimates the height of a single item based on its character count and type.
   * This method is a placeholder and should be replaced with logic from SegmentCalibrator.
   * @returns The estimated height in pixels.
   */
  private estimateItemHeight(item: Segment, baseline: CalibrationBaseline): number {
    const primaryTextLength = (Array.isArray(item.content.primary) ? item.content.primary.join(' ') : item.content.primary)?.length || 0;
    const secondaryTextLength = (Array.isArray(item.content.secondary) ? item.content.secondary.join(' ') : item.content.secondary)?.length || 0;
    const totalTextLength = primaryTextLength + secondaryTextLength;
    
    let typeMultiplier = 1.0;
    
    const content = (item.content.primary || item.content.en || '') as string;
    if (typeof content === 'string' && content.startsWith('##')) {
        typeMultiplier = 1.8;
    }

    if (baseline.avgCharHeight > 0) {
      return totalTextLength * baseline.avgCharHeight * typeMultiplier;
    }

    const avgCharsPerSegment = 100;
    const ratio = totalTextLength / (avgCharsPerSegment || 1);
    return baseline.avgSegmentHeight * ratio * typeMultiplier;
  }
}
