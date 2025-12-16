// src/lib/pagination/SegmentCalibrator.ts
'use client';

import type { Segment, ContentUnit } from '@/lib/types';

interface Measurement {
  segmentIndex: number;
  height: number;
  charCount: number;
}

export interface CalibrationBaseline {
  avgSegmentHeight: number;
  avgCharHeight: number;
  containerHeight: number;
  confidence: number;
}

const LOCALSTORAGE_CALIBRATION_KEY = 'chirpter_calibration_cache_v2';

/**
 * Measures sample segments to establish a baseline for pagination calculations.
 */
export class SegmentCalibrator {
  private container: HTMLElement;
  private displayLang1: string;
  private displayLang2: string;
  private unit: ContentUnit;

  constructor(
    container: HTMLElement,
    displayLang1: string = 'en',
    displayLang2: string = 'none',
    unit: ContentUnit = 'sentence'
  ) {
    if (!container) {
      throw new Error("SegmentCalibrator requires a valid container element.");
    }
    this.container = container;
    this.displayLang1 = displayLang1;
    this.displayLang2 = displayLang2;
    this.unit = unit;
  }

  /**
   * Generates a unique key for caching based on container dimensions and settings.
   */
  private getCacheKey(): string {
    const style = getComputedStyle(this.container);
    const isBilingual = this.displayLang2 !== 'none';
    return `w${this.container.clientWidth}-h${this.container.clientHeight}-f${style.fontSize}-${style.fontFamily.replace(/\s/g, '')}-lh${style.lineHeight}-${this.displayLang1}-${this.displayLang2}-${this.unit}-${isBilingual}`;
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
   * Gets text content from a segment based on current language settings.
   */
  private getSegmentText(segment: Segment): string {
    const content = segment.content[this.displayLang1];
    if (!content) return '';
    
    // Handle both string and array content
    if (Array.isArray(content)) {
      return content.join(' ');
    }
    return content;
  }

  /**
   * Gets character count for a segment (including bilingual if applicable).
   */
  private getSegmentCharCount(segment: Segment): number {
    const primaryText = this.getSegmentText(segment);
    let totalChars = primaryText.length;
    
    if (this.displayLang2 !== 'none') {
      const secondaryContent = segment.content[this.displayLang2];
      if (secondaryContent) {
        const secondaryText = Array.isArray(secondaryContent) 
          ? secondaryContent.join(' ') 
          : secondaryContent;
        totalChars += secondaryText.length;
      }
    }
    
    return totalChars;
  }

  /**
   * The main logic: Measures a sample of items to get a baseline.
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
    
    // Select a representative sample
    const sampleItems = items.slice(0, sampleSize);
    const measurements: Measurement[] = [];

    for (let i = 0; i < sampleItems.length; i++) {
      const height = await this.measureItem(sampleItems[i]);
      measurements.push({
        segmentIndex: i,
        height: height,
        charCount: this.getSegmentCharCount(sampleItems[i]),
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
      const primaryText = this.getSegmentText(segment);
      if (!primaryText) {
        resolve(0);
        return;
      }
      
      const isBilingual = this.displayLang2 !== 'none';
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
      
      // Handle different content types
      if (primaryText.startsWith('##')) {
        // Heading
        const h2 = document.createElement('h2');
        h2.innerText = primaryText;
        measurer.appendChild(h2);
      } else if (isBilingual && this.unit === 'sentence') {
        // Bilingual sentence mode - each language on separate line
        const container = document.createElement('div');
        container.className = 'bilingual-sentence-block mb-4';
        
        const primaryDiv = document.createElement('div');
        primaryDiv.className = 'mb-1';
        primaryDiv.innerText = primaryText;
        container.appendChild(primaryDiv);
        
        const secondaryContent = segment.content[this.displayLang2];
        if (secondaryContent) {
          const secondaryText = Array.isArray(secondaryContent) 
            ? secondaryContent.join(' ') 
            : secondaryContent;
          const secondaryDiv = document.createElement('div');
          secondaryDiv.className = 'text-muted-foreground italic text-[0.9em]';
          secondaryDiv.innerText = secondaryText;
          container.appendChild(secondaryDiv);
        }
        
        measurer.appendChild(container);
      } else if (isBilingual && this.unit === 'phrase') {
        // Bilingual phrase mode - inline with parentheses
        const span = document.createElement('span');
        span.className = 'inline';
        
        const primaryContent = segment.content[this.displayLang1];
        const secondaryContent = segment.content[this.displayLang2];
        
        if (Array.isArray(primaryContent)) {
          // Phrase-by-phrase
          primaryContent.forEach((phrase, index) => {
            const phraseSpan = document.createElement('span');
            phraseSpan.className = 'inline whitespace-nowrap mr-1';
            phraseSpan.innerText = phrase;
            
            if (Array.isArray(secondaryContent) && secondaryContent[index]) {
              const secondarySpan = document.createElement('span');
              secondarySpan.className = 'text-muted-foreground italic text-[0.9em] ml-1';
              secondarySpan.innerText = `(${secondaryContent[index]})`;
              phraseSpan.appendChild(secondarySpan);
            }
            
            span.appendChild(phraseSpan);
          });
        } else {
          // Single phrase
          span.innerText = primaryText;
          if (secondaryContent) {
            const secondaryText = Array.isArray(secondaryContent) 
              ? secondaryContent.join(' ') 
              : secondaryContent;
            const secondarySpan = document.createElement('span');
            secondarySpan.className = 'text-muted-foreground italic text-[0.9em] ml-1';
            secondarySpan.innerText = `(${secondaryText})`;
            span.appendChild(secondarySpan);
          }
        }
        
        measurer.appendChild(span);
      } else {
        // Monolingual mode
        const span = document.createElement('span');
        span.className = 'inline';
        span.innerText = primaryText;
        measurer.appendChild(span);
      }

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
      return { 
        avgSegmentHeight: 20, 
        avgCharHeight: 0.5, 
        containerHeight: this.container.clientHeight, 
        confidence: 0 
      };
    }
    
    const totalHeight = measurements.reduce((sum, m) => sum + m.height, 0);
    const totalChars = measurements.reduce((sum, m) => sum + m.charCount, 0);

    const avgSegmentHeight = totalHeight / measurements.length;
    const avgCharHeight = totalChars > 0 ? totalHeight / totalChars : 0;
    
    // Subtract padding/margin for safe headroom
    const containerHeight = this.container.clientHeight - 80; 

    return {
      avgSegmentHeight,
      avgCharHeight,
      containerHeight: containerHeight > 0 ? containerHeight : 500,
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
    const stdDev = Math.sqrt(
      heights.map(h => Math.pow(h - avg, 2)).reduce((sum, sq) => sum + sq, 0) / heights.length
    );
    const confidence = 1 - Math.min(1, (stdDev / avg));
    return parseFloat(confidence.toFixed(2));
  }
}
