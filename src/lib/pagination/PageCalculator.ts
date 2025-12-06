
'use client';

import type { Page, Segment } from '@/lib/types';
import type { SegmentCalibrator, CalibrationBaseline } from './SegmentCalibrator';

// A heuristic for the extra vertical space added by new paragraphs (e.g., margin-top).
// This value might need tweaking based on the final CSS.
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
    
    let isFirstSegmentOfBook = true;

    for (let i = 0; i < allBookSegments.length; i++) {
        const currentItem = allBookSegments[i];
        
        // --- Chapter Handling Logic ---
        if (currentItem.type === 'heading') {
            // If the current page has content, finalize it before starting a new chapter page.
            if (currentPageItems.length > 0) {
                pages.push({ pageIndex: pages.length, items: currentPageItems, estimatedHeight: currentHeight });
                currentPageItems = [];
                currentHeight = 0;
            }
            // Record the start of the new chapter. It will begin on the next page created.
            chapterStartPages.push(pages.length);
        }

        // --- Height Calculation Logic ---
        const isNewParagraph = currentItem.metadata.isParagraphStart || currentItem.type === 'heading';
        const itemHeight = this.estimateItemHeight(currentItem, baseline, isNewParagraph && !isFirstSegmentOfBook);

        // --- Page Breaking Logic ---

        // If a single item is taller than the whole page, it gets its own page.
        if (itemHeight > baseline.containerHeight && currentPageItems.length > 0) {
            pages.push({ pageIndex: pages.length, items: currentPageItems, estimatedHeight: currentHeight });
            currentPageItems = [];
            currentHeight = 0;
        }

        // If the current item doesn't fit, finalize the current page and start a new one.
        if (currentHeight + itemHeight > baseline.containerHeight && currentPageItems.length > 0) {
            pages.push({ pageIndex: pages.length, items: currentPageItems, estimatedHeight: currentHeight });
            currentPageItems = [currentItem];
            // Recalculate height for the new page start, which doesn't have preceding margin.
            currentHeight = this.estimateItemHeight(currentItem, baseline, false);
        } else {
            // Otherwise, add the item to the current page.
            currentPageItems.push(currentItem);
            currentHeight += itemHeight;
        }
        
        isFirstSegmentOfBook = false;
    }

    // Add the last remaining page if it has content.
    if (currentPageItems.length > 0) {
        pages.push({ pageIndex: pages.length, items: currentPageItems, estimatedHeight: currentHeight });
    }
    
    // Ensure there's at least one chapter start page if there's content.
    if (chapterStartPages.length === 0 && allBookSegments.length > 0) {
      chapterStartPages.push(0);
    }
    
    return { pages, chapterStartPages };
  }

  /**
   * Estimates the height of a single item based on its character count and type.
   * This now includes a heuristic for vertical margins.
   * @returns The estimated height in pixels.
   */
  private estimateItemHeight(item: Segment, baseline: CalibrationBaseline, isNewParagraph: boolean): number {
    const primaryTextLength = item.content.primary?.length || 0;
    const secondaryTextLength = item.content.secondary?.length || 0;
    const totalTextLength = primaryTextLength + secondaryTextLength;
    
    // Use a multiplier for different segment types to account for larger font sizes.
    let typeMultiplier = 1.0;
    if (item.type === 'heading') typeMultiplier = 1.8; // Headings are larger
    if (item.type === 'blockquote') typeMultiplier = 1.2; // Blockquotes might have different spacing

    // Add spacing heuristic if it's the start of a new paragraph (but not the very first item on a page).
    const spacing = isNewParagraph ? PARAGRAPH_SPACING_HEURISTIC : 0;

    // The core estimation logic.
    if (baseline.avgCharHeight > 0) {
      return (totalTextLength * baseline.avgCharHeight * typeMultiplier) + spacing;
    }

    // Fallback logic if avgCharHeight is somehow zero. Less accurate.
    const avgCharsPerSegment = 100;
    const ratio = totalTextLength / (avgCharsPerSegment || 1);
    return (baseline.avgSegmentHeight * ratio * typeMultiplier) + spacing;
  }
}
