// src/lib/pagination/cache/PaginationCache.ts
'use client';

import type { Page } from '@/lib/types';

interface CacheKey {
  itemId: string;
  width: number;
  height: number;
  fontSize: 'sm' | 'base' | 'lg';
  displayLang1: string;
  displayLang2: string;
  presentationStyle: 'book' | 'doc' | 'card';
  aspectRatio?: '1:1' | '3:4' | '4:3';
}

interface CacheValue {
  pages: Page[];
  chapterStartPages: number[];
  timestamp: number;
}

export class PaginationCache {
  private static CACHE_PREFIX = 'chirpter_pagination_';
  private static MAX_AGE = 1000 * 60 * 30; // 30 minutes

  /**
   * Round viewport dimensions to nearest 100px to increase cache hits
   */
  private static roundDimension(value: number): number {
    return Math.round(value / 100) * 100;
  }

  /**
   * Generate cache key string from parameters
   */
  private static generateKey(params: CacheKey): string {
    const {
      itemId,
      width,
      height,
      fontSize,
      displayLang1,
      displayLang2,
      presentationStyle,
      aspectRatio
    } = params;

    const roundedWidth = this.roundDimension(width);
    const roundedHeight = this.roundDimension(height);

    const parts = [
      itemId,
      roundedWidth,
      roundedHeight,
      fontSize,
      displayLang1,
      displayLang2,
      presentationStyle
    ];

    if (aspectRatio) {
      parts.push(aspectRatio);
    }

    return this.CACHE_PREFIX + parts.join('_');
  }

  /**
   * Get cached pagination result
   */
  static get(params: CacheKey): CacheValue | null {
    if (typeof window === 'undefined') return null;

    try {
      const key = this.generateKey(params);
      const cached = sessionStorage.getItem(key);

      if (!cached) return null;

      const value: CacheValue = JSON.parse(cached);

      // Check if cache is still valid
      if (Date.now() - value.timestamp > this.MAX_AGE) {
        sessionStorage.removeItem(key);
        return null;
      }

      return value;
    } catch (error) {
      console.warn('[PaginationCache] Failed to get cache:', error);
      return null;
    }
  }

  /**
   * Set cache value
   */
  static set(params: CacheKey, pages: Page[], chapterStartPages: number[]): void {
    if (typeof window === 'undefined') return;

    try {
      const key = this.generateKey(params);
      const value: CacheValue = {
        pages,
        chapterStartPages,
        timestamp: Date.now()
      };

      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // SessionStorage might be full - clear old entries
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        this.clearOldEntries();
        try {
          const key = this.generateKey(params);
          const value: CacheValue = { pages, chapterStartPages, timestamp: Date.now() };
          sessionStorage.setItem(key, JSON.stringify(value));
        } catch (retryError) {
          console.warn('[PaginationCache] Failed to set cache after clearing:', retryError);
        }
      } else {
        console.warn('[PaginationCache] Failed to set cache:', error);
      }
    }
  }

  /**
   * Invalidate all cache entries for a specific item
   */
  static invalidate(itemId: string): void {
    if (typeof window === 'undefined') return;

    try {
      const keysToRemove: string[] = [];

      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key?.startsWith(this.CACHE_PREFIX) && key.includes(itemId)) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(key => sessionStorage.removeItem(key));
    } catch (error) {
      console.warn('[PaginationCache] Failed to invalidate cache:', error);
    }
  }

  /**
   * Clear all pagination cache entries
   */
  static clear(): void {
    if (typeof window === 'undefined') return;

    try {
      const keysToRemove: string[] = [];

      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key?.startsWith(this.CACHE_PREFIX)) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(key => sessionStorage.removeItem(key));
    } catch (error) {
      console.warn('[PaginationCache] Failed to clear cache:', error);
    }
  }

  /**
   * Clear old cache entries (older than MAX_AGE)
   */
  private static clearOldEntries(): void {
    if (typeof window === 'undefined') return;

    try {
      const keysToRemove: string[] = [];
      const now = Date.now();

      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (!key?.startsWith(this.CACHE_PREFIX)) continue;

        try {
          const cached = sessionStorage.getItem(key);
          if (!cached) continue;

          const value: CacheValue = JSON.parse(cached);
          if (now - value.timestamp > this.MAX_AGE) {
            keysToRemove.push(key);
          }
        } catch {
          // Invalid cache entry, remove it
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(key => sessionStorage.removeItem(key));
    } catch (error) {
      console.warn('[PaginationCache] Failed to clear old entries:', error);
    }
  }
}