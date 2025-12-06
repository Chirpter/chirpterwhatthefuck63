// src/features/diary/foundation/viewport-engine.ts
import type { DiaryGeometry } from '../types';
import { TouchOptimization, type TouchConfig } from './touch-optimization';

export interface ViewportConfig {
  touchConfig?: TouchConfig;
  cacheMaxSize?: number;
  cacheTTL?: number;
  enableDebugLogging?: boolean;
}

interface CacheEntry {
  rect: DOMRect;
  timestamp: number;
}

class SafeOperationWrapper {
  private static isFiniteNumber(n: unknown): n is number {
    return typeof n === 'number' && Number.isFinite(n);
  }

  private static validateFiniteKeys<T extends Record<string, unknown>>(
    obj: T,
    keys: (keyof T)[],
    context: string
  ): void {
    for (const key of keys) {
      if (!this.isFiniteNumber(obj[key])) {
        throw new Error(`Invalid non-finite number at ${String(key)} in ${context}`);
      }
    }
  }

  static wrapCoordinateConversion<T>(
    operation: () => T,
    fallback: T,
    context: string,
    numericKeys: (keyof T)[],
    enableDebugLogging = false
  ): T {
    try {
      const result = operation();
      if (typeof result === 'object' && result !== null) {
        this.validateFiniteKeys(result as Record<string, unknown>, numericKeys as (keyof Record<string, unknown>)[], context);
      }
      return result;
    } catch (error) {
      if (enableDebugLogging) {
        // console.warn(`[ViewportEngine] ${context} failed:`, error);
      }
      return fallback;
    }
  }
}

export class ViewportEngine {
  public readonly pageElement: HTMLElement;
  private readonly touchOptimization: TouchOptimization;
  private readonly spatialCache = new Map<string, CacheEntry>();
  private readonly cacheMaxSize: number;
  private readonly cacheTTL: number;
  private readonly enableDebugLogging: boolean;
  
  private isDestroyed = false;
  private lastCleanup = 0;

  constructor(pageElement: HTMLElement, config?: ViewportConfig) {
    if (!pageElement?.isConnected) {
      throw new Error('ViewportEngine requires a valid connected page element.');
    }

    this.pageElement = pageElement;
    this.touchOptimization = new TouchOptimization(config?.touchConfig);
    this.cacheMaxSize = Math.max(1, config?.cacheMaxSize ?? 50);
    this.cacheTTL = Math.max(100, config?.cacheTTL ?? 5000);
    this.enableDebugLogging = config?.enableDebugLogging ?? false;
  }

  destroy(): void {
    if (this.isDestroyed) return;
    
    this.isDestroyed = true;
    this.spatialCache.clear();
    
    if (this.enableDebugLogging) {
      // console.debug('[ViewportEngine] Destroyed');
    }
  }

  private cleanupExpiredEntries(): void {
    if (this.isDestroyed) return;

    const now = Date.now();
    
    // Skip cleanup if too recent
    if (now - this.lastCleanup < this.cacheTTL / 2) return;

    // Remove expired entries
    let removedCount = 0;
    for (const [key, entry] of this.spatialCache.entries()) {
      if (now - entry.timestamp > this.cacheTTL) {
        this.spatialCache.delete(key);
        removedCount++;
      }
    }

    // Enforce size limit by removing oldest entries
    if (this.spatialCache.size > this.cacheMaxSize) {
      const sortedEntries = Array.from(this.spatialCache.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp);
      
      const overflow = this.spatialCache.size - this.cacheMaxSize;
      for (let i = 0; i < overflow; i++) {
        this.spatialCache.delete(sortedEntries[i][0]);
        removedCount++;
      }
    }

    this.lastCleanup = now;
    
    if (this.enableDebugLogging && removedCount > 0) {
      // console.debug(`[ViewportEngine] Cleaned up ${removedCount} cache entries`);
    }
  }

  private createCacheKey(element: HTMLElement, rect: DOMRect): string {
    const pageId = element.dataset.pageId ?? 'default';
    const dpr = Math.round((window.devicePixelRatio || 1) * 100) / 100;
    
    // Round to avoid micro-fluctuations creating many cache entries
    const round = (v: number) => Math.round(v * 100) / 100;
    
    return `${pageId}:${round(rect.left)},${round(rect.top)},${round(rect.width)},${round(rect.height)}@${dpr}x`;
  }

  private clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
  }

  public screenToViewport(screenPoint: DiaryGeometry.Point, element?: HTMLElement): DiaryGeometry.Point | null {
    const targetElement = element || this.pageElement;
    if (!targetElement) {
      return null;
    }
    
    try {
      const rect = targetElement.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        return null;
      }
      
      const x = (screenPoint.x - rect.left) / rect.width;
      const y = (screenPoint.y - rect.top) / rect.height;
      
      return { x, y };
    } catch (e) {
      console.error('Error in screenToViewport:', e);
      return null;
    }
  }


  viewportToAbsolute(
    viewportPoint: DiaryGeometry.Transform,
    containerSize: { width: number; height: number }
  ): DiaryGeometry.AbsoluteTransform {
    if (this.isDestroyed) {
      return { x: 0, y: 0, width: 0, height: 0, rotation: 0 };
    }

    const minSize = this.getMinimumObjectSize();
    const safeContainerWidth = Math.max(1, containerSize.width);
    const safeContainerHeight = Math.max(1, containerSize.height);
    
    const minWidthPx = Math.max(1, minSize.width * safeContainerWidth);
    const minHeightPx = Math.max(1, minSize.height * safeContainerHeight);

    const fallback: DiaryGeometry.AbsoluteTransform = {
      x: 0, y: 0,
      width: minWidthPx,
      height: minHeightPx,
      rotation: 0
    };

    return SafeOperationWrapper.wrapCoordinateConversion(
      () => {
        if (safeContainerWidth <= 0 || safeContainerHeight <= 0) {
          throw new Error('Invalid container size');
        }

        const x = Number.isFinite(viewportPoint.x) ? viewportPoint.x : 0;
        const y = Number.isFinite(viewportPoint.y) ? viewportPoint.y : 0;
        const width = Number.isFinite(viewportPoint.width) ? viewportPoint.width : minSize.width;
        const height = Number.isFinite(viewportPoint.height) ? viewportPoint.height : minSize.height;

        return {
          x: Math.max(0, x * safeContainerWidth),
          y: Math.max(0, y * safeContainerHeight),
          width: Math.max(minWidthPx, width * safeContainerWidth),
          height: Math.max(minHeightPx, height * safeContainerHeight),
          rotation: viewportPoint.rotation || 0,
        };
      },
      fallback,
      'viewportToAbsolute',
      ['x', 'y', 'width', 'height', 'rotation'],
      this.enableDebugLogging
    );
  }

  expandTouchTarget(bounds: DiaryGeometry.Bounds): DiaryGeometry.Bounds {
    return this.isDestroyed ? bounds : this.touchOptimization.expandTouchTarget(bounds);
  }

  constrainToSafeZone(transform: DiaryGeometry.Transform): DiaryGeometry.Transform {
    if (this.isDestroyed) return transform;

    const SAFE_ZONE = { left: 0.05, top: 0.05, right: 0.95, bottom: 0.95 } as const;
    const maxWidth = SAFE_ZONE.right - SAFE_ZONE.left;
    const maxHeight = SAFE_ZONE.bottom - SAFE_ZONE.top;

    const constrainedWidth = Math.min(Math.max(0.01, transform.width), maxWidth);
    const constrainedHeight = Math.min(Math.max(0.01, transform.height), maxHeight);

    return {
      x: Math.max(SAFE_ZONE.left, Math.min(SAFE_ZONE.right - constrainedWidth, transform.x)),
      y: Math.max(SAFE_ZONE.top, Math.min(SAFE_ZONE.bottom - constrainedHeight, transform.y)),
      width: constrainedWidth,
      height: constrainedHeight,
      rotation: transform.rotation || 0,
    };
  }

  getMinimumObjectSize(): { width: number; height: number } {
    return { width: 0.02, height: 0.02 } as const;
  }

  getViewportBounds(element?: HTMLElement): DiaryGeometry.Bounds | null {
    if (this.isDestroyed) return null;

    const targetElement = element || this.pageElement;
    if (!targetElement.isConnected) return null;

    const pageRect = this.pageElement.getBoundingClientRect();
    const targetRect = targetElement.getBoundingClientRect();

    if (pageRect.width <= 0 || pageRect.height <= 0) return null;

    const left = (targetRect.left - pageRect.left) / pageRect.width;
    const top = (targetRect.top - pageRect.top) / pageRect.height;
    const right = (targetRect.right - pageRect.left) / pageRect.width;
    const bottom = (targetRect.bottom - pageRect.top) / pageRect.height;

    return {
      left: this.clamp01(left),
      top: this.clamp01(top),
      right: this.clamp01(right),
      bottom: this.clamp01(bottom),
    };
  }

  // Utility methods for debugging
  getCacheStats(): { size: number; maxSize: number; hitRate?: number } {
    return {
      size: this.spatialCache.size,
      maxSize: this.cacheMaxSize,
      // Could add hit rate tracking if needed
    };
  }

  clearCache(): void {
    this.spatialCache.clear();
    this.lastCleanup = Date.now();
  }
}
