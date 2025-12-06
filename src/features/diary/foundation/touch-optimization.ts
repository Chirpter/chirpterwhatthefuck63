// src/features/diary/foundation/touch-optimization.ts

import type { DiaryGeometry } from '../types';

/**
 * Configuration for touch optimization features.
 */
export interface TouchConfig {
  /** Minimum recommended touch target size in px (Apple HIG: 44px). */
  minTouchTargetSize?: number;

  /** Extra expansion ratio applied when targets are smaller than min size. */
  touchExpansionRatio?: number;

  /** Threshold in px before a gesture is recognized as drag instead of tap. */
  gestureThreshold?: number;

  /** Max delay in ms to recognize a tap (beyond this could be long press). */
  tapTimeout?: number;

  /** Optional callback to handle device-specific quirks externally. */
  onDeviceQuirk?: (event: PointerEvent, action: 'lock' | 'unlock') => void;
}

/**
 * Utility class to improve touch interactions and handle device quirks.
 */
export class TouchOptimization {
  private config: Required<Omit<TouchConfig, 'onDeviceQuirk'>> &
    Pick<TouchConfig, 'onDeviceQuirk'>;

  constructor(config?: TouchConfig) {
    this.config = {
      minTouchTargetSize: 44,
      touchExpansionRatio: 1.5,
      gestureThreshold: 10, // px
      tapTimeout: 300, // ms
      ...config,
    };
  }

  /**
   * Expands the provided bounding box to meet accessibility guidelines.
   * Uses both minTouchTargetSize and touchExpansionRatio.
   */
  public expandTouchTarget(bounds: DiaryGeometry.Bounds): DiaryGeometry.Bounds {
    const { left, top, right, bottom } = bounds;
    const width = right - left;
    const height = bottom - top;

    if (width < 0 || height < 0) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[TouchOptimization] Invalid bounds:', bounds);
      }
      return bounds;
    }

    // Base expansion to meet minimum size
    let expandX = Math.max(0, (this.config.minTouchTargetSize - width) / 2);
    let expandY = Math.max(0, (this.config.minTouchTargetSize - height) / 2);

    // Ratio-based expansion for smaller targets
    if (width < this.config.minTouchTargetSize) {
      expandX = Math.max(
        expandX,
        (width * (this.config.touchExpansionRatio - 1)) / 2,
      );
    }
    if (height < this.config.minTouchTargetSize) {
      expandY = Math.max(
        expandY,
        (height * (this.config.touchExpansionRatio - 1)) / 2,
      );
    }

    return {
      left: left - expandX,
      top: top - expandY,
      right: right + expandX,
      bottom: bottom + expandY,
    };
  }

  /**
   * Utility: determine if a gesture should be treated as a tap.
   */
  public isTapGesture(distanceMoved: number, durationMs: number): boolean {
    return (
      distanceMoved <= this.config.gestureThreshold &&
      durationMs <= this.config.tapTimeout
    );
  }

  /**
   * Utility: determine if a gesture should be treated as a long press.
   */
  public isLongPressGesture(distanceMoved: number, durationMs: number): boolean {
    return (
      distanceMoved <= this.config.gestureThreshold &&
      durationMs > this.config.tapTimeout
    );
  }

  /**
   * Handles known device quirks (e.g., iOS Safari scroll locking) via callback.
   */
  public handleDeviceQuirks(event: PointerEvent): void {
    if (!this.isIOSSafari() || !this.config.onDeviceQuirk) return;

    if (event.type === 'pointerdown') {
      this.config.onDeviceQuirk(event, 'lock');
    } else if (event.type === 'pointerup' || event.type === 'pointercancel') {
      this.config.onDeviceQuirk(event, 'unlock');
    }
  }

  /**
   * Detects iOS Safari using UA + basic feature detection.
   */
  private isIOSSafari(): boolean {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent;
    const isIOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS/.test(ua);
    return isIOS && isSafari;
  }
}
