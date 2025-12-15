'use client';

import type { Segment } from '@/lib/types';

interface Measurement {
  segmentIndex: number;
  height: number;
  charCount: number;
}

export interface CalibrationBaseline {
  avgSegmentHeight: number;
  avgCharHeight: number; // Average height per character
  containerHeight: number;
  confidence: number; // A score from 0 to 1 indicating reliability
}

const LOCALSTORAGE_CALIBRATION_KEY = 'chirpter_calibration_cache_v2';

/**
 * Measures sample segments to establish a baseline for pagination calculations.
 * This class is crucial for accurate estimations.
 * It now uses localStorage for persistent caching.
 */
export class SegmentCalibrator {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    if (!container) {
      throw new Error("SegmentCalibrator requires a valid container element.");
    }
    this.container = container;
  }

  /**
   * Generates a unique key for caching based on container dimensions and font styles.
   */
  private getCacheKey(): string {
    const style = getComputedStyle(this.container);
    return `w${this.container.clientWidth}-h${this.container.clientHeight}-f${style.fontSize}-${style.fontFamily.replace(/\s/g, '')}-lh${style.lineHeight}`;
  }

  /**
   * Retrieves the cached baseline from localStorage.
   */
  private getCachedBaseline(key: string): CalibrationBaseline | null {
      try {
        const cachedData = localStorage.getItem(LOCALSTORAGE_CALIBRATION_KEY);
        if (!cachedData) return null;
        
        const allCache = JSON.parse(cachedData);
        if (allCache[key]) {
            return allCache[key] as CalibrationBaseline;
        }
      } catch (error) {
          console.warn("Could not retrieve calibration cache from localStorage", error);
      }
      return null;
  }
  
  /**
   * Saves the calculated baseline to localStorage.
   */
  private setCachedBaseline(key: string, baseline: CalibrationBaseline): void {
      try {
          const cachedData = localStorage.getItem(LOCALSTORAGE_CALIBRATION_KEY);
          const allCache = cachedData ? JSON.parse(cachedData) : {};
          allCache[key] = baseline;
          localStorage.setItem(LOCALSTORAGE_CALIBRATION_KEY, JSON.stringify(allCache));
      } catch (error) {
          console.warn("Could not save calibration cache to localStorage", error);
      }
  }

  /**
   * The main logic: Measures a sample of items to get a baseline.
   * @param items - The array of all Segments for the content.
   * @returns A promise that resolves to the calculated baseline.
   */
  public async calibrate(items: Segment[]): Promise<CalibrationBaseline> {
    const cacheKey = this.getCacheKey();
    const cachedBaseline = this.getCachedBaseline(cacheKey);

    // If we have a high-confidence cache, use it immediately.
    if (cachedBaseline && cachedBaseline.confidence > 0.9) {
      return cachedBaseline;
    }

    const sampleSize = Math.min(15, items.length);
    if (sampleSize === 0) {
        return {
            avgSegmentHeight: 20,
            avgCharHeight: 0.5,
            containerHeight: this.container.clientHeight,
            confidence: 0,
        };
    }
    
    // Select a representative sample (e.g., first few items)
    const sampleItems = items.slice(0, sampleSize);
    const measurements: Measurement[] = [];

    for (let i = 0; i < sampleItems.length; i++) {
      const height = await this.measureItem(sampleItems[i]);
      measurements.push({
        segmentIndex: i,
        height: height,
        charCount: (sampleItems[i].content.primary?.length || 0) + (sampleItems[i].content.secondary?.length || 0),
      });
    }

    const baseline = this.calculateBaseline(measurements);
    this.setCachedBaseline(cacheKey, baseline);
    return baseline;
  }
  
  /**
   * Measures the height of a single item by rendering it into a hidden element.
   */
  public measureItem(segment: Segment): Promise<number> {
    return new Promise((resolve) => {
      const textContent = `${segment.content.primary || ''} ${segment.content.secondary || ''}`.trim();
      if (!textContent) {
        resolve(0);
        return;
      }
      
      const measurer = document.createElement('div');
      // Apply the same classes and styles as the actual renderer's container
      measurer.className = 'prose dark:prose-invert max-w-none font-serif';
      measurer.style.cssText = `
        position: absolute;
        visibility: hidden;
        height: auto;
        width: ${this.container.clientWidth}px;
        padding-left: ${getComputedStyle(this.container).paddingLeft};
        padding-right: ${getComputedStyle(this.container).paddingRight};
        font-family: var(--font-noto-serif), serif;
      `;
      
      let elementToMeasure;
      // Since type is removed, default to a <p> tag for measurement
      elementToMeasure = document.createElement('p');

      elementToMeasure.innerText = textContent;
      measurer.appendChild(elementToMeasure);

      document.body.appendChild(measurer);

      // Use requestAnimationFrame to ensure the browser has calculated the layout
      requestAnimationFrame(() => {
        const height = measurer.offsetHeight;
        document.body.removeChild(measurer);
        resolve(height);
      });
    });
  }

  /**
   * Calculates the baseline metrics from a set of measurements.
   */
  private calculateBaseline(measurements: Measurement[]): CalibrationBaseline {
    if (measurements.length === 0) {
        return { avgSegmentHeight: 20, avgCharHeight: 0.5, containerHeight: this.container.clientHeight, confidence: 0 };
    }
    
    const totalHeight = measurements.reduce((sum, m) => sum + m.height, 0);
    const totalChars = measurements.reduce((sum, m) => sum + m.charCount, 0);

    const avgSegmentHeight = totalHeight / measurements.length;
    const avgCharHeight = totalChars > 0 ? totalHeight / totalChars : 0;
    
    // Subtract a small amount for padding/margin headroom
    const containerHeight = this.container.clientHeight - 80; 

    return {
      avgSegmentHeight,
      avgCharHeight,
      containerHeight: containerHeight > 0 ? containerHeight : 500, // Ensure positive height
      confidence: this.calculateConfidence(measurements),
    };
  }
  
  /**
   * Calculates a confidence score for the baseline.
   */
  private calculateConfidence(measurements: Measurement[]): number {
    if (measurements.length < 5) return 0.5;
    const heights = measurements.map(m => m.height);
    const avg = heights.reduce((sum, h) => sum + h, 0) / heights.length;
    const stdDev = Math.sqrt(heights.map(h => Math.pow(h - avg, 2)).reduce((sum, sq) => sum + sq, 0) / heights.length);
    // Confidence is higher when the standard deviation is low relative to the average height
    const confidence = 1 - Math.min(1, (stdDev / avg));
    return parseFloat(confidence.toFixed(2));
  }
}
