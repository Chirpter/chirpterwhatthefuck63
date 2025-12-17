// src/lib/pagination/PageCalculator.ts
'use client';

import type { Page, Segment, ContentUnit } from '@/lib/types';

// This file now acts as a router for different pagination strategies.

import { paginateBook } from './strategies/BookPaginator';
import { paginateCard } from './strategies/CardPaginator';

/**
 * ✅ MAIN ENTRY POINT - Intelligent routing
 * Routes the pagination task to the correct strategy based on presentation style.
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
    // Both 'doc' and 'card' styles currently use the same simple logic.
    return paginateCard(segments);
  }
}
