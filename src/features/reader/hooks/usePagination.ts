// src/features/reader/hooks/usePagination.ts
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
 * A reusable hook to handle the complex logic of pagination.
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

  const pageCalculator = useMemo(() => {
    if (!containerRef.current) return null;
    const calibrator = new SegmentCalibrator(
      containerRef.current, 
      displayLang1, 
      displayLang2, 
      unit
    );
    return new PageCalculator(calibrator, presentationStyle, aspectRatio);
  }, [containerRef, presentationStyle, aspectRatio, displayLang1, displayLang2, unit]);

  const calculatePages = useCallback(async () => {
    if (!isEnabled || !pageCalculator || !segments || segments.length === 0) {
      setIsCalculating(false);
      setPages([]);
      setChapterStartPages([]);
      return;
    }

    setIsCalculating(true);
    try {
      console.log(`🔄 Starting pagination for ${segments.length} segments...`);
      const result = await pageCalculator.calculatePages(segments);
      console.log(`✅ Pagination complete: ${'${result.pages.length}'} pages`);
      setPages(result.pages);
      setChapterStartPages(result.chapterStartPages);
    } catch (error) {
      console.error('❌ Failed to calculate pages:', error);
      // Fallback: create single page with all content
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

  useEffect(() => {
    calculatePages();
  }, [calculatePages]);

  const goToPage = useCallback((pageIndex: number) => {
    if (isCalculating) return;
    const newIndex = Math.max(0, Math.min(pageIndex, pages.length - 1));
    setCurrentPageIndex(newIndex);
  }, [isCalculating, pages.length]);

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
    goToPage,
    getPageForSegment,
    pageCount: pages.length,
  };
};
