// src/features/reader/hooks/usePagination.ts (Version 2 - Improved)
'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Page, Segment, ContentUnit } from '@/lib/types';
import { PageCalculator } from '@/lib/pagination/PageCalculator';
import { SegmentCalibrator } from '@/lib/pagination/SegmentCalibrator';

interface UsePaginationProps {
  segments: Segment[];
  containerRef: React.RefObject<HTMLDivElement>;
  isEnabled: boolean;
  presentationStyle: 'book' | 'doc' | 'card';
  aspectRatio?: '1:1' | '3:4' | '4:3';
  displayLang1?: string;
  displayLang2?: string;
  unit?: ContentUnit;
}

/**
 * Improved pagination hook with better error handling and debugging
 */
export const usePagination = ({
  segments,
  containerRef,
  isEnabled,
  presentationStyle,
  aspectRatio,
  displayLang1 = 'en',
  displayLang2 = 'none',
  unit = 'sentence',
}: UsePaginationProps) => {
  const [pages, setPages] = useState<Page[]>([]);
  const [chapterStartPages, setChapterStartPages] = useState<number[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isCalculating, setIsCalculating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Track if calculation has been attempted
  const calculationAttempted = useRef(false);
  const lastSegmentCount = useRef(0);

  // Create calculator instance - memoize based on dependencies
  const pageCalculator = useMemo(() => {
    if (!containerRef.current) {
      console.log('[usePagination] Container not ready yet');
      return null;
    }
    
    console.log('[usePagination] Creating new PageCalculator', {
      displayLang1,
      displayLang2,
      unit,
      containerWidth: containerRef.current.clientWidth,
      containerHeight: containerRef.current.clientHeight,
    });
    
    try {
      const calibrator = new SegmentCalibrator(
        containerRef.current, 
        displayLang1, 
        displayLang2, 
        unit
      );
      return new PageCalculator(calibrator, presentationStyle, aspectRatio);
    } catch (error) {
      console.error('[usePagination] Failed to create calculator:', error);
      return null;
    }
  }, [containerRef.current, presentationStyle, aspectRatio, displayLang1, displayLang2, unit]);

  /**
   * Main pagination calculation function
   */
  const calculatePages = useCallback(async () => {
    // Early returns
    if (!isEnabled) {
      console.log('[usePagination] Pagination disabled');
      setIsCalculating(false);
      return;
    }
    
    if (!pageCalculator) {
      console.log('[usePagination] Calculator not ready');
      setIsCalculating(true);
      return;
    }
    
    if (!segments || segments.length === 0) {
      console.warn('[usePagination] No segments provided');
      setIsCalculating(false);
      setPages([]);
      setChapterStartPages([]);
      setError('No content available');
      return;
    }
    
    // Check if this is a duplicate calculation
    if (calculationAttempted.current && lastSegmentCount.current === segments.length) {
      console.log('[usePagination] Skipping duplicate calculation');
      return;
    }
    
    calculationAttempted.current = true;
    lastSegmentCount.current = segments.length;
    setIsCalculating(true);
    setError(null);
    
    console.log(`[usePagination] 🔄 Starting pagination for ${segments.length} segments...`);
    
    try {
      const result = await pageCalculator.calculatePages(segments);
      
      if (!result.pages || result.pages.length === 0) {
        throw new Error('Pagination returned no pages');
      }
      
      console.log(`[usePagination] ✅ Pagination success: ${result.pages.length} pages`);
      
      setPages(result.pages);
      setChapterStartPages(result.chapterStartPages);
      setError(null);
      
    } catch (error) {
      console.error('[usePagination] ❌ Pagination failed:', error);
      setError((error as Error).message);
      
      // Fallback: create single page with all content
      console.log('[usePagination] Using fallback single-page mode');
      setPages([{
        pageIndex: 0,
        items: segments,
        estimatedHeight: 0
      }]);
      setChapterStartPages([0]);
      
    } finally {
      setIsCalculating(false);
    }
  }, [segments, pageCalculator, isEnabled]);

  /**
   * Effect to trigger calculation
   */
  useEffect(() => {
    // Reset calculation flag when key dependencies change
    calculationAttempted.current = false;
    
    calculatePages();
  }, [calculatePages]);

  /**
   * Effect to handle container resize
   */
  useEffect(() => {
    if (!containerRef.current) return;
    
    const observer = new ResizeObserver(() => {
      console.log('[usePagination] Container resized, recalculating...');
      calculationAttempted.current = false;
      calculatePages();
    });
    
    observer.observe(containerRef.current);
    
    return () => observer.disconnect();
  }, [containerRef, calculatePages]);

  /**
   * Navigate to specific page
   */
  const goToPage = useCallback((pageIndex: number) => {
    if (isCalculating) {
      console.warn('[usePagination] Cannot navigate while calculating');
      return;
    }
    const newIndex = Math.max(0, Math.min(pageIndex, pages.length - 1));
    console.log(`[usePagination] Navigate to page ${newIndex + 1}/${pages.length}`);
    setCurrentPageIndex(newIndex);
  }, [isCalculating, pages.length]);

  /**
   * Find page containing specific segment
   */
  const getPageForSegment = useCallback(
    (segmentId: string): number => {
      for (let i = 0; i < pages.length; i++) {
        if (pages[i].items.some((item) => item.id === segmentId)) {
          return i;
        }
      }
      return -1;
    },
    [pages]
  );

  return {
    pages,
    chapterStartPages,
    currentPageIndex,
    setCurrentPageIndex,
    isCalculating,
    error,
    goToPage,
    getPageForSegment,
    pageCount: pages.length,
  };
};