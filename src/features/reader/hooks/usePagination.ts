// src/features/reader/hooks/usePagination.ts
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Page, Segment, ContentUnit } from '@/lib/types';
import { calculatePages } from '@/lib/pagination/PageCalculator';

interface UsePaginationProps {
  segments: Segment[];
  containerRef: React.RefObject<HTMLDivElement>;
  isEnabled: boolean;
  presentationStyle: 'book' | 'doc' | 'card';
  aspectRatio?: '1:1' | '3:4' | '4:3';
  displayLang1: string;
  displayLang2: string;
  unit: ContentUnit;
}

export const usePagination = ({
  segments,
  containerRef,
  isEnabled,
  presentationStyle,
  aspectRatio,
  displayLang1,
  displayLang2,
  unit,
}: UsePaginationProps) => {
  const [pages, setPages] = useState<Page[]>([]);
  const [chapterStartPages, setChapterStartPages] = useState<number[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isCalculating, setIsCalculating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const isCalculatingRef = useRef(false);
  const lastDepsRef = useRef<string>('');

  const createDepsKey = useCallback(() => {
    return JSON.stringify({
      segmentCount: segments.length,
      containerWidth: containerRef.current?.clientWidth || 0,
      containerHeight: containerRef.current?.clientHeight || 0,
      displayLang1,
      displayLang2,
      unit,
      presentationStyle,
      aspectRatio,
    });
  }, [segments.length, containerRef, displayLang1, displayLang2, unit, presentationStyle, aspectRatio]);

  const performPagination = useCallback(async () => {
    if (!isEnabled) {
      setIsCalculating(false);
      return;
    }
    
    if (!containerRef.current) {
      return;
    }
    
    if (!segments || segments.length === 0) {
      setIsCalculating(false);
      setPages([]);
      setChapterStartPages([]);
      return;
    }
    
    const currentDepsKey = createDepsKey();
    if (currentDepsKey === lastDepsRef.current && pages.length > 0) {
      setIsCalculating(false);
      return;
    }
    
    if (isCalculatingRef.current) {
      return;
    }
    
    isCalculatingRef.current = true;
    setIsCalculating(true);
    setError(null);
    
    try {
      const result = await calculatePages(
        segments,
        containerRef.current,
        presentationStyle,
        aspectRatio,
        displayLang1,
        displayLang2,
        unit
      );
      
      if (!result.pages || result.pages.length === 0) {
        throw new Error('Pagination returned no pages');
      }
      
      setPages(result.pages);
      setChapterStartPages(result.chapterStartPages);
      lastDepsRef.current = currentDepsKey;
      
    } catch (err) {
      console.error('[usePagination] ❌ Error:', err);
      setError((err as Error).message);
      
      setPages([{
        pageIndex: 0,
        items: segments,
        estimatedHeight: 0
      }]);
      setChapterStartPages([0]);
      
    } finally {
      isCalculatingRef.current = false;
      setIsCalculating(false);
    }
  }, [
    segments,
    containerRef,
    isEnabled,
    presentationStyle,
    aspectRatio,
    displayLang1,
    displayLang2,
    unit,
    createDepsKey,
    pages.length
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      performPagination();
    }, 100);
    
    return () => clearTimeout(timer);
  }, [performPagination]);

  useEffect(() => {
    if (!containerRef.current) return;
    
    const observer = new ResizeObserver(() => {
      lastDepsRef.current = '';
      performPagination();
    });
    
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [containerRef, performPagination]);

  const goToPage = useCallback((pageIndex: number) => {
    if (isCalculating) return;
    const newIndex = Math.max(0, Math.min(pageIndex, pages.length - 1));
    setCurrentPageIndex(newIndex);
  }, [isCalculating, pages.length]);

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
    error,
    goToPage,
    getPageForSegment,
    pageCount: pages.length,
  };
};
