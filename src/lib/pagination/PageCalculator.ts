// src/lib/pagination/PageCalculator.ts (Version 2 - Improved)
'use client';

import type { Page, Segment } from '@/lib/types';
import { SegmentCalibrator, type CalibrationBaseline } from './SegmentCalibrator';

/**
 * Improved PageCalculator with better error handling and bilingual support
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
   * Get text content from segment based on calibrator's language settings
   */
  private getSegmentText(segment: Segment, lang: string): string {
    const content = segment.content[lang];
    if (!content) {
      // Fallback to any available language
      const firstLang = Object.keys(segment.content)[0];
      const fallbackContent = segment.content[firstLang];
      if (!fallbackContent) return '';
      return Array.isArray(fallbackContent) ? fallbackContent.join(' ') : fallbackContent;
    }
    
    return Array.isArray(content) ? content.join(' ') : content;
  }

  /**
   * Initialize baseline - ensure it's ready before use
   */
  private async ensureBaseline(segments: Segment[]): Promise<void> {
    if (!this.baseline) {
      console.log('[PageCalculator] Initializing baseline...');
      this.baseline = await this.calibrator.calibrate(segments);
      
      if (!this.baseline || this.baseline.containerHeight <= 0) {
        console.error('[PageCalculator] Invalid baseline:', this.baseline);
        throw new Error('Failed to establish valid calibration baseline');
      }
      
      console.log('[PageCalculator] Baseline ready:', {
        avgHeight: this.baseline.avgSegmentHeight,
        avgCharHeight: this.baseline.avgCharHeight,
        containerHeight: this.baseline.containerHeight,
        confidence: this.baseline.confidence,
      });
    }
  }

  /**
   * Estimate height of a single segment with improved accuracy
   */
  private async estimateItemHeight(segment: Segment): Promise<number> {
    // Always measure headings for accuracy
    const primaryLang = Object.keys(segment.content)[0];
    const textContent = this.getSegmentText(segment, primaryLang);
    
    if (!textContent) return 0;
    
    if (textContent.startsWith('##') || textContent.startsWith('#')) {
      const measured = await this.calibrator.measureItem(segment);
      console.log('[PageCalculator] Heading measured:', measured, 'px');
      return measured;
    }
    
    // Use estimation for regular text
    if (this.baseline && this.baseline.avgCharHeight > 0) {
      // Count total characters across all languages
      let totalChars = 0;
      Object.values(segment.content).forEach(content => {
        if (content) {
          const text = Array.isArray(content) ? content.join(' ') : content;
          totalChars += text.length;
        }
      });
      
      const estimated = totalChars * this.baseline.avgCharHeight;
      
      // Add padding for bilingual sentence mode (each sentence is a block)
      const isBilingualSentence = Object.keys(segment.content).length > 1;
      const paddingAdjustment = isBilingualSentence ? 16 : 0; // mb-4 class
      
      return Math.max(estimated + paddingAdjustment, 10);
    }
    
    // Fallback to direct measurement
    return await this.calibrator.measureItem(segment);
  }

  /**
   * Check if segment is a chapter heading
   */
  private isChapterHeading(segment: Segment): boolean {
    const firstLang = Object.keys(segment.content)[0];
    const textContent = this.getSegmentText(segment, firstLang);
    return textContent.startsWith('##') || textContent.startsWith('#');
  }

  /**
   * Main pagination calculation
   */
  public async calculatePages(
    segments: Segment[]
  ): Promise<{ pages: Page[], chapterStartPages: number[] }> {
    console.log(`[PageCalculator] Starting pagination for ${segments.length} segments`);
    
    if (!segments || segments.length === 0) {
      console.warn("[PageCalculator] No segments to paginate");
      return { pages: [], chapterStartPages: [] };
    }

    try {
      await this.ensureBaseline(segments);
    } catch (error) {
      console.error('[PageCalculator] Baseline initialization failed:', error);
      // Return single-page fallback
      return { 
        pages: [{
          pageIndex: 0,
          items: segments,
          estimatedHeight: 0
        }], 
        chapterStartPages: [0] 
      };
    }

    if (!this.baseline || this.baseline.containerHeight <= 0) {
      console.error('[PageCalculator] Invalid baseline after initialization');
      return { 
        pages: [{
          pageIndex: 0,
          items: segments,
          estimatedHeight: 0
        }], 
        chapterStartPages: [0] 
      };
    }

    const pages: Page[] = [];
    const chapterStartPages: number[] = [];
    let currentPageItems: Segment[] = [];
    let currentPageHeight = 0;
    
    const pageHeight = this.baseline.containerHeight;
    console.log(`[PageCalculator] Target page height: ${pageHeight}px`);
    
    let isNewChapter = true;
    let segmentCount = 0;

    for (const segment of segments) {
      segmentCount++;
      
      const itemHeight = await this.estimateItemHeight(segment);
      const isHeading = this.isChapterHeading(segment);

      // Mark chapter start
      if (isHeading) {
        isNewChapter = true;
      }
      
      // Check if we need a page break
      const wouldOverflow = currentPageHeight + itemHeight > pageHeight;
      const hasContent = currentPageItems.length > 0;
      
      if (wouldOverflow && hasContent) {
        // Save current page
        pages.push({
          pageIndex: pages.length,
          items: currentPageItems,
          estimatedHeight: currentPageHeight,
        });
        
        console.log(`[PageCalculator] Page ${pages.length} created with ${currentPageItems.length} items (${Math.round(currentPageHeight)}px)`);
        
        // Reset for next page
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
      console.log(`[PageCalculator] Final page ${pages.length} created with ${currentPageItems.length} items`);
    }

    console.log(`[PageCalculator] ✅ Pagination complete: ${pages.length} pages, ${chapterStartPages.length} chapters, ${segmentCount} segments processed`);
    
    // Validation
    if (pages.length === 0) {
      console.error('[PageCalculator] ERROR: No pages generated!');
      return { 
        pages: [{
          pageIndex: 0,
          items: segments,
          estimatedHeight: 0
        }], 
        chapterStartPages: [0] 
      };
    }
    
    return { pages, chapterStartPages };
  }
}