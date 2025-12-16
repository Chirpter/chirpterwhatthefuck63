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
  private displayLang1: string;
  private displayLang2: string;

  constructor(
    calibrator: SegmentCalibrator,
    presentationStyle: 'book' | 'doc' | 'card' = 'book',
    aspectRatio?: '1:1' | '3:4' | '4:3'
  ) {
    this.calibrator = calibrator;
    this.presentationStyle = presentationStyle;
    this.aspectRatio = aspectRatio;
    this.displayLang1 = 'en'; // Will be updated during calculatePages
    this.displayLang2 = 'none';
  }

  /**
   * Gets text content from a segment based on current language settings.
   */
  private getSegmentText(segment: Segment): string {
    const content = segment.content[this.displayLang1];
    if (!content) {
      // Fallback to any available language
      const firstLang = Object.keys(segment.content)[0];
      const fallbackContent = segment.content[firstLang];
      if (!fallbackContent) return '';
      return Array.isArray(fallbackContent) ? fallbackContent.join(' ') : fallbackContent;
    }
    
    if (Array.isArray(content)) {
      return content.join(' ');
    }
    return content;
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
    const textContent = this.getSegmentText(segment);
    if (!textContent) return 0;
    
    // Always measure headings for accuracy
    if (textContent.startsWith('##') || textContent.startsWith('#')) {
      return await this.calibrator.measureItem(segment);
    }
    
    // For text, use estimation based on calibration
    if (this.baseline && this.baseline.avgCharHeight > 0) {
      let totalChars = textContent.length;
      
      // Add secondary language character count if bilingual
      if (this.displayLang2 !== 'none') {
        const secondaryContent = segment.content[this.displayLang2];
        if (secondaryContent) {
          const secondaryText = Array.isArray(secondaryContent) 
            ? secondaryContent.join(' ') 
            : secondaryContent;
          totalChars += secondaryText.length;
        }
      }
      
      return totalChars * this.baseline.avgCharHeight;
    }
    
    // Fallback to direct measurement if no baseline
    return await this.calibrator.measureItem(segment);
  }

  /**
   * Checks if a segment is a chapter heading.
   */
  private isChapterHeading(segment: Segment): boolean {
    const textContent = this.getSegmentText(segment);
    return textContent.startsWith('##') || textContent.startsWith('#');
  }

  /**
   * Main method to calculate pages for a given set of segments.
   */
  public async calculatePages(
    segments: Segment[]
  ): Promise<{ pages: Page[], chapterStartPages: number[] }> {
    if (!segments || segments.length === 0) {
      console.warn("No segments to paginate");
      return { pages: [], chapterStartPages: [] };
    }

    await this.ensureBaseline(segments);

    const pages: Page[] = [];
    const chapterStartPages: number[] = [];
    let currentPageItems: Segment[] = [];
    let currentPageHeight = 0;
    
    if (!this.baseline || this.baseline.containerHeight <= 0) {
      console.warn("Invalid container height, cannot calculate pages.");
      // Fallback: put all segments on one page
      return { 
        pages: [{
          pageIndex: 0,
          items: segments,
          estimatedHeight: 0
        }], 
        chapterStartPages: [0] 
      };
    }
    
    const pageHeight = this.baseline.containerHeight;
    let isNewChapter = true;

    for (const segment of segments) {
      const itemHeight = await this.estimateItemHeight(segment);
      const isHeading = this.isChapterHeading(segment);

      // Mark chapter start
      if (isHeading) {
        isNewChapter = true;
      }
      
      // If adding this item would overflow the page AND we already have items
      if (currentPageHeight + itemHeight > pageHeight && currentPageItems.length > 0) {
        // Save current page
        pages.push({
          pageIndex: pages.length,
          items: currentPageItems,
          estimatedHeight: currentPageHeight,
        });
        currentPageItems = [];
        currentPageHeight = 0;
      }

      // Mark chapter start page
      if (isNewChapter && currentPageItems.length === 0) {
        chapterStartPages.push(pages.length);
        isNewChapter = false;
      }

      // Add item to current page
      currentPageItems.push(segment);
      currentPageHeight += itemHeight;
    }

    // Add the last page if it has content
    if (currentPageItems.length > 0) {
      pages.push({
        pageIndex: pages.length,
        items: currentPageItems,
        estimatedHeight: currentPageHeight,
      });
    }

    console.log(`✅ Pagination complete: ${pages.length} pages, ${'${chapterStartPages.length}'} chapters`);
    return { pages, chapterStartPages };
  }
}
