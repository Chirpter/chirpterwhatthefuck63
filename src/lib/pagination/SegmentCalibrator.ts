// src/lib/pagination/PageCalculator.ts
// ✅ REFACTORED VERSION - Tách biệt book và piece/card logic
'use client';

import type { Page, Segment, ContentUnit } from '@/lib/types';

// ==================== SHARED UTILITIES ====================

interface CachedBaseline {
  avgLineHeight: number;
  containerHeight: number;
  timestamp: number;
  checksum: string;
}

const CACHE_KEY = 'chirpter_pagination_v3';
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

function createChecksum(
  presentationStyle: string,
  containerWidth: number,
  containerHeight: number,
  displayLang1: string,
  displayLang2: string,
  unit: ContentUnit
): string {
  const isBilingual = displayLang2 !== 'none';
  return `${presentationStyle}-${containerWidth}x${containerHeight}-${displayLang1}-${displayLang2}-${unit}-${isBilingual}`;
}

function getCachedBaseline(checksum: string): CachedBaseline | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const data: CachedBaseline = JSON.parse(cached);
    if (Date.now() - data.timestamp > CACHE_TTL) return null;
    if (data.checksum !== checksum) return null;
    return data;
  } catch {
    return null;
  }
}

function setCachedBaseline(baseline: CachedBaseline): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(baseline));
  } catch (e) {
    console.warn('[Pagination] Failed to save cache:', e);
  }
}

// ==================== BOOK PAGINATION ====================

async function calibrateForBook(
  container: HTMLElement,
  sampleSegments: Segment[],
  displayLang1: string,
  displayLang2: string,
  unit: ContentUnit
): Promise<{ avgLineHeight: number; containerHeight: number }> {
  const checksum = createChecksum(
    'book',
    container.clientWidth,
    container.clientHeight,
    displayLang1,
    displayLang2,
    unit
  );
  
  const cached = getCachedBaseline(checksum);
  if (cached) {
    console.log('[Book Pagination] ✅ Using cached baseline');
    return {
      avgLineHeight: cached.avgLineHeight,
      containerHeight: cached.containerHeight
    };
  }
  
  console.log('[Book Pagination] 📏 Calibrating...');
  
  const measurer = document.createElement('div');
  measurer.className = 'prose max-w-none font-serif';
  measurer.style.cssText = `
    position: absolute;
    visibility: hidden;
    width: ${container.clientWidth}px;
    padding: ${getComputedStyle(container).padding};
    font-family: var(--font-noto-serif), serif;
  `;
  
  const samplesToMeasure = sampleSegments.slice(0, 5);
  const isBilingual = displayLang2 !== 'none';
  const isSentenceMode = unit === 'sentence';
  
  for (const seg of samplesToMeasure) {
    const primaryText = seg.content[displayLang1];
    if (!primaryText) continue;
    
    const textContent = Array.isArray(primaryText) 
      ? primaryText.join(' ') 
      : primaryText;
    
    if (isBilingual && isSentenceMode) {
      const wrapper = document.createElement('div');
      wrapper.className = 'bilingual-sentence-block mb-4';
      
      const primary = document.createElement('div');
      primary.className = 'mb-1';
      primary.textContent = textContent;
      wrapper.appendChild(primary);
      
      const secondaryText = seg.content[displayLang2];
      if (secondaryText) {
        const secondary = document.createElement('div');
        secondary.className = 'text-muted-foreground italic text-[0.9em]';
        secondary.textContent = Array.isArray(secondaryText) 
          ? secondaryText.join(' ') 
          : secondaryText;
        wrapper.appendChild(secondary);
      }
      
      measurer.appendChild(wrapper);
    } else {
      const span = document.createElement('span');
      span.className = 'inline';
      span.textContent = textContent + ' ';
      measurer.appendChild(span);
    }
  }
  
  document.body.appendChild(measurer);
  await new Promise(resolve => requestAnimationFrame(resolve));
  
  const totalHeight = measurer.offsetHeight;
  document.body.removeChild(measurer);
  
  const avgLineHeight = totalHeight / samplesToMeasure.length;
  const containerHeight = container.clientHeight - 100;
  
  const baseline: CachedBaseline = {
    avgLineHeight,
    containerHeight: containerHeight > 0 ? containerHeight : 500,
    timestamp: Date.now(),
    checksum
  };
  setCachedBaseline(baseline);
  
  console.log('[Book Pagination] ✅ Calibrated:', baseline);
  return { avgLineHeight: baseline.avgLineHeight, containerHeight: baseline.containerHeight };
}

function estimateSegmentHeightForBook(
  segment: Segment,
  avgLineHeight: number,
  displayLang1: string,
  displayLang2: string,
  unit: ContentUnit
): number {
  const primaryText = segment.content[displayLang1];
  if (!primaryText) return 0;
  
  const text = Array.isArray(primaryText) ? primaryText.join(' ') : primaryText;
  
  if (text.startsWith('##') || text.startsWith('#')) {
    return avgLineHeight * 2.5;
  }
  
  const isBilingual = displayLang2 !== 'none';
  const isSentenceMode = unit === 'sentence';
  
  if (isBilingual && isSentenceMode) {
    return avgLineHeight * 2 + 16; // mb-4
  }
  
  const charCount = text.length;
  const estimatedLines = Math.ceil(charCount / 80);
  return avgLineHeight * estimatedLines;
}

async function paginateBook(
  segments: Segment[],
  container: HTMLElement,
  displayLang1: string,
  displayLang2: string,
  unit: ContentUnit
): Promise<{ pages: Page[]; chapterStartPages: number[] }> {
  
  if (!segments || segments.length === 0) {
    return { pages: [], chapterStartPages: [] };
  }
  
  console.log(`[Book Pagination] 🚀 Starting for ${segments.length} segments`);
  
  const { avgLineHeight, containerHeight } = await calibrateForBook(
    container,
    segments,
    displayLang1,
    displayLang2,
    unit
  );
  
  const pages: Page[] = [];
  const chapterStartPages: number[] = [];
  
  let currentPageItems: Segment[] = [];
  let currentPageHeight = 0;
  let isNewChapter = false;
  
  for (const segment of segments) {
    const primaryText = segment.content[displayLang1];
    const text = Array.isArray(primaryText) ? primaryText.join(' ') : primaryText || '';
    
    const isHeading = text.startsWith('##') || text.startsWith('#');
    if (isHeading) {
      isNewChapter = true;
    }
    
    const estimatedHeight = estimateSegmentHeightForBook(
      segment,
      avgLineHeight,
      displayLang1,
      displayLang2,
      unit
    );
    
    const wouldOverflow = currentPageHeight + estimatedHeight > containerHeight;
    
    if (wouldOverflow && currentPageItems.length > 0) {
      pages.push({
        pageIndex: pages.length,
        items: currentPageItems,
        estimatedHeight: currentPageHeight
      });
      currentPageItems = [];
      currentPageHeight = 0;
    }
    
    if (isNewChapter && currentPageItems.length === 0) {
      chapterStartPages.push(pages.length);
      isNewChapter = false;
    }
    
    currentPageItems.push(segment);
    currentPageHeight += estimatedHeight;
  }
  
  if (currentPageItems.length > 0) {
    pages.push({
      pageIndex: pages.length,
      items: currentPageItems,
      estimatedHeight: currentPageHeight
    });
  }
  
  console.log(`[Book Pagination] ✅ Complete: ${pages.length} pages, ${chapterStartPages.length} chapters`);
  
  return { pages, chapterStartPages };
}

// ==================== PIECE/CARD PAGINATION (LEGACY) ====================
// ⚠️ TODO: Refactor này sau khi book pagination hoàn thiện

async function paginatePieceOrCard(
  segments: Segment[],
  container: HTMLElement,
  presentationStyle: 'doc' | 'card',
  aspectRatio: '1:1' | '3:4' | '4:3' | undefined,
  displayLang1: string,
  displayLang2: string,
  unit: ContentUnit
): Promise<{ pages: Page[]; chapterStartPages: number[] }> {
  console.log('[Piece/Card Pagination] ⚠️ Using legacy logic - needs refactor');
  
  // Fallback: single page với tất cả content
  // CQI sẽ tự động scale dựa trên container size
  return {
    pages: [{
      pageIndex: 0,
      items: segments,
      estimatedHeight: 0
    }],
    chapterStartPages: [0]
  };
}

// ==================== PUBLIC API ====================

/**
 * ✅ MAIN ENTRY POINT - Intelligent routing
 */
export async function calculatePages(
  segments: Segment[],
  container: HTMLElement,
  presentationStyle: 'book' | 'doc' | 'card',
  aspectRatio: '1:1' | '3:4' | '4:3' | undefined,
  displayLang1: string,
  displayLang2: string,
  unit: ContentUnit
): Promise<{ pages: Page[]; chapterStartPages: number[] }> {
  
  if (presentationStyle === 'book') {
    return paginateBook(segments, container, displayLang1, displayLang2, unit);
  } else {
    return paginatePieceOrCard(
      segments,
      container,
      presentationStyle as 'doc' | 'card',
      aspectRatio,
      displayLang1,
      displayLang2,
      unit
    );
  }
}

/**
 * ✅ CLEAR CACHE
 */
export function clearPaginationCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
    console.log('[Pagination] Cache cleared');
  } catch (e) {
    console.warn('[Pagination] Failed to clear cache:', e);
  }
}