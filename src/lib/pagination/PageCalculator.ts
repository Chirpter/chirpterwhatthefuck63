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
        const isNewChapter = (currentItem.content.primary as string)?.startsWith('## ') || (currentItem.content.en as string)?.startsWith('## ');

        if (isNewChapter) {
            if (currentPageItems.length > 0) {
                pages.push({ pageIndex: pages.length, items: currentPageItems, estimatedHeight: currentHeight });
                currentPageItems = [];
                currentHeight = 0;
            }
            chapterStartPages.push(pages.length);
        }

        const itemHeight = await this.calibrator.measureItem(currentItem);
        
        if (itemHeight >= baseline.containerHeight) {
            if (currentPageItems.length > 0) {
                pages.push({ pageIndex: pages.length, items: currentPageItems, estimatedHeight: currentHeight });
            }
            pages.push({ pageIndex: pages.length, items: [currentItem], estimatedHeight: itemHeight });
            currentPageItems = [];
            currentHeight = 0;
            continue;
        }
        
        if (currentHeight + itemHeight > baseline.containerHeight) {
            pages.push({ pageIndex: pages.length, items: currentPageItems, estimatedHeight: currentHeight });
            currentPageItems = [currentItem];
            currentHeight = itemHeight;
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
}
