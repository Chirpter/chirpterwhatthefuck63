// src/features/reader/hooks/usePagination.ts
'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Page, Segment } from '@/lib/types';
import { PageCalculator } from '@/lib/pagination/PageCalculator';
import { SegmentCalibrator } from '@/lib/pagination/SegmentCalibrator';

interface UsePaginationProps {
  segments: Segment[];
  containerRef: React.RefObject<HTMLDivElement>;
  isEnabled: boolean; // Control whether pagination logic runs
}

/**
 * A reusable hook to handle the complex logic of pagination.
 * It takes a list of segments and a container element, and returns
 * the calculated pages and functions to navigate them.
 */
export const usePagination = ({ segments, containerRef, isEnabled }: UsePaginationProps) => {
  const [pages, setPages] = useState<Page[]>([]);
  const [chapterStartPages, setChapterStartPages] = useState<number[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isCalculating, setIsCalculating] = useState(true);

  const segmentCalibrator = useMemo(() => {
    if (!containerRef.current) return null;
    return new SegmentCalibrator(containerRef.current);
  }, [containerRef]);

  const pageCalculator = useMemo(() => {
    if (!segmentCalibrator) return null;
    return new PageCalculator(segmentCalibrator);
  }, [segmentCalibrator]);

  const calculatePages = useCallback(async () => {
    if (!isEnabled || !pageCalculator || segments.length === 0) {
      setIsCalculating(false);
      setPages([]);
      setChapterStartPages([]);
      return;
    }
    
    setIsCalculating(true);
    try {
      const { pages: calculatedPages, chapterStartPages: calculatedChapterStarts } = await pageCalculator.calculatePagesForBook(segments);
      setPages(calculatedPages);
      setChapterStartPages(calculatedChapterStarts);
    } catch (error) {
      console.error("Failed to calculate pages:", error);
      setPages([]);
      setChapterStartPages([]);
    } finally {
      setIsCalculating(false);
    }
  }, [segments, pageCalculator, isEnabled]);

  useEffect(() => {
    // Recalculate pages when segments or container ref changes
    calculatePages();
  }, [calculatePages]);
  
  const goToPage = (pageIndex: number) => {
    if (isCalculating) return;
    const newIndex = Math.max(0, Math.min(pageIndex, pages.length - 1));
    setCurrentPageIndex(newIndex);
  };
  
  const getPageForSegment = useCallback((segmentId: string): number => {
    for (let i = 0; i < pages.length; i++) {
      if (pages[i].items.some(item => item.id === segmentId)) {
        return i;
      }
    }
    return -1;
  }, [pages]);

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
