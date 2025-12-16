// src/lib/pagination/PageCalculator.ts
'use client';

import type { Page, Segment } from '@/lib/types';
import { SegmentCalibrator, type CalibrationBaseline } from './SegmentCalibrator';

/**
 * Calculates how to split an array of Segments into multiple Pages
 * based on the container size and estimated content height.
 */
export class PageCalculator {
  private calibrator: SegmentCalibrator;
  private baseline: CalibrationBaseline | null = null;
  private presentationStyle: 'book' | 'doc' | 'card';
  private aspectRatio?: '1:1' | '3:4' | '4:3';

  constructor(
    calibrator: SegmentCalibrator,
    presentationStyle: 'book' | 'doc' | 'card' = 'book',
    aspectRatio?: '1:1' | '3:4' | '4:3'
  ) {
    this.calibrator = calibrator;
    this.presentationStyle = presentationStyle;
    this.aspectRatio = aspectRatio;
  }

  /**
   * Initializes the baseline by calibrating the segments.
   */
  private async ensureBaseline(segments: Segment[]): Promise<void> {
    if (!this.baseline) {
      this.baseline = await this.calibrator.calibrate(segments);
    }
  }

  /**
   * Estimates the height of a single segment.
   * Uses real measurement for headings and estimation for text.
   */
  private async estimateItemHeight(segment: Segment): Promise<number> {
    const textContent = (segment.content.primary as string) || (segment.content.en as string) || '';
    if (!textContent) return 0;
    
    // Always measure headings for accuracy
    if (textContent.startsWith('##')) {
      return await this.calibrator.measureItem(segment);
    }
    
    // For text, use estimation based on calibration
    if (this.baseline && this.baseline.avgCharHeight > 0) {
      return textContent.length * this.baseline.avgCharHeight;
    }
    
    // Fallback to direct measurement if no baseline
    return await this.calibrator.measureItem(segment);
  }

  /**
   * Main method to calculate pages for a given set of segments (e.g., a book).
   */
  public async calculatePages(segments: Segment[]): Promise<{ pages: Page[], chapterStartPages: number[] }> {
    await this.ensureBaseline(segments);

    const pages: Page[] = [];
    const chapterStartPages: number[] = [];
    let currentPageItems: Segment[] = [];
    let currentPageHeight = 0;
    
    if (!this.baseline || this.baseline.containerHeight <= 0) {
        console.warn("Invalid container height, cannot calculate pages.");
        return { pages: [], chapterStartPages: [] };
    }
    
    const pageHeight = this.baseline.containerHeight;
    let isNewChapter = true;

    for (const segment of segments) {
      const itemHeight = await this.estimateItemHeight(segment);
      const textContent = (segment.content.primary as string) || (segment.content.en as string) || '';

      if (textContent.startsWith('##')) {
          isNewChapter = true;
      }
      
      if (currentPageHeight + itemHeight > pageHeight && currentPageItems.length > 0) {
        pages.push({
          pageIndex: pages.length,
          items: currentPageItems,
          estimatedHeight: currentPageHeight,
        });
        currentPageItems = [];
        currentPageHeight = 0;
      }

      if (isNewChapter) {
        chapterStartPages.push(pages.length);
        isNewChapter = false;
      }

      currentPageItems.push(segment);
      currentPageHeight += itemHeight;
    }

    if (currentPageItems.length > 0) {
      pages.push({
        pageIndex: pages.length,
        items: currentPageItems,
        estimatedHeight: currentPageHeight,
      });
    }

    return { pages, chapterStartPages };
  }
}
