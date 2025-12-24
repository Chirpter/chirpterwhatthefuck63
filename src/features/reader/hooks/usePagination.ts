// src/features/reader/hooks/usePagination.ts
'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Page, Segment, ContentUnit, LanguageBlock } from '@/lib/types';
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
  itemId?: string;
  fontSize?: 'sm' | 'base' | 'lg';
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
  itemId,
  fontSize = 'base'
}: UsePaginationProps) => {
  const [pages, setPages] = useState<Page[]>([]);
  const [chapterStartPages, setChapterStartPages] = useState<number[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isCalculating, setIsCalculating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const isCalculatingRef = useRef(false);
  const debounceTimerRef = useRef<NodeJS.Timeout>();

  // ✅ FIX: Memoize segments content to prevent reference changes
  const segmentsHash = useMemo(() => {
    return segments.map(s => {
      const langBlock = s.content.find(p => typeof p === 'object') as LanguageBlock | undefined;
      return langBlock ? `${s.id}-${langBlock[displayLang1]}` : s.id;
    }).join('|');
  }, [segments, displayLang1]);

  // ✅ FIX: Memoize container dimensions
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 });

  // ✅ FIX: Stable dependency key
  const depsKey = useMemo(() => {
    return JSON.stringify({
      segmentsHash,
      width: containerDimensions.width,
      height: containerDimensions.height,
      displayLang1,
      displayLang2,
      unit,
      presentationStyle,
      aspectRatio,
      fontSize,
      itemId
    });
  }, [
    segmentsHash,
    containerDimensions.width,
    containerDimensions.height,
    displayLang1,
    displayLang2,
    unit,
    presentationStyle,
    aspectRatio,
    fontSize,
    itemId
  ]);

  // ✅ FIX: Track last calculated depsKey
  const lastCalculatedDepsKey = useRef<string>('');

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
    
    // ✅ FIX: Check if we already calculated for this exact configuration
    if (depsKey === lastCalculatedDepsKey.current && pages.length > 0) {
      console.log('[usePagination] 🔄 Skipping - already calculated for this configuration');
      setIsCalculating(false);
      return;
    }
    
    // ✅ FIX: Prevent concurrent calculations
    if (isCalculatingRef.current) {
      console.log('[usePagination] ⏸️ Skipping - calculation in progress');
      return;
    }
    
    isCalculatingRef.current = true;
    setIsCalculating(true);
    setError(null);
    
    console.log('[usePagination] 🔄 Starting pagination...', {
      segments: segments.length,
      depsKey
    });
    
    try {
      const result = await calculatePages(
        segments,
        containerRef.current,
        presentationStyle,
        aspectRatio,
        displayLang1,
        displayLang2,
        unit,
        itemId,
        fontSize
      );
      
      if (!result.pages || result.pages.length === 0) {
        throw new Error('Pagination returned no pages');
      }
      
      setPages(result.pages);
      setChapterStartPages(result.chapterStartPages);
      lastCalculatedDepsKey.current = depsKey;
      
      console.log('[usePagination] ✅ Pagination complete:', {
        pages: result.pages.length,
        chapters: result.chapterStartPages.length
      });
      
    } catch (err) {
      console.error('[usePagination] ❌ Error:', err);
      setError((err as Error).message);
      
      // Fallback to a single page containing all content
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
    itemId,
    fontSize,
    depsKey,
    pages.length
  ]);

  // ✅ FIX: Debounced pagination trigger
  useEffect(() => {
    // Clear any existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Skip if already calculated for this configuration
    if (depsKey === lastCalculatedDepsKey.current && pages.length > 0) {
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      performPagination();
    }, 300);
    
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [depsKey, performPagination, pages.length]);

  // ✅ FIX: Resize observer with stable callback
  useEffect(() => {
    if (!containerRef.current) return;
    
    const updateDimensions = () => {
      if (!containerRef.current) return;
      
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      
      setContainerDimensions(prev => {
        // Only update if dimensions actually changed significantly
        if (Math.abs(prev.width - width) > 10 || Math.abs(prev.height - height) > 10) {
          console.log('[usePagination] 📐 Container dimensions changed:', { width, height });
          return { width, height };
        }
        return prev;
      });
    };

    // Initial dimensions
    updateDimensions();
    
    const observer = new ResizeObserver(updateDimensions);
    observer.observe(containerRef.current);
    
    return () => observer.disconnect();
  }, [containerRef]);

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