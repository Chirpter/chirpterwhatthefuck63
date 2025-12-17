// src/lib/pagination/SegmentCalibrator.ts
'use client';

import type { Segment, ContentUnit, LanguageBlock } from '@/lib/types';
import { SegmentRenderer } from '@/features/reader/components/shared/SegmentRenderer';

export class SegmentCalibrator {
  private container: HTMLElement;
  private measurer: HTMLDivElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.measurer = this.createMeasurer();
  }

  private createMeasurer(): HTMLDivElement {
    const measurer = document.createElement('div');
    measurer.className = 'prose dark:prose-invert max-w-none font-serif prose-dynamic';
    measurer.style.cssText = `
      position: absolute;
      visibility: hidden;
      width: ${this.container.clientWidth}px;
      padding: ${getComputedStyle(this.container).padding};
      font-family: var(--font-noto-serif), serif;
      pointer-events: none;
    `;
    document.body.appendChild(measurer);
    return measurer;
  }
  
  public async getSegmentHeight(
    segment: Segment,
    displayLang1: string,
    displayLang2: string,
    unit: ContentUnit
  ): Promise<number> {
    
    this.measurer.innerHTML = '';
    const isBilingual = displayLang2 !== 'none';
    const segmentContent = segment.content;

    let text = '';
    for (const part of segmentContent) {
        if (typeof part === 'string') {
            text += part;
        } else {
            // This is the language block
            if (!isBilingual) {
                text += part[displayLang1] || '';
            } else if (unit === 'sentence') {
                const primary = part[displayLang1] || '';
                const secondary = part[displayLang2] || '';
                // Render on separate lines for sentence mode
                text += `${primary}\n_${secondary}_`;
            } else { // phrase mode
                const primary = part[displayLang1] || '';
                const secondary = part[displayLang2] || '';
                // Render inline for phrase mode
                text += `${primary} (${secondary})`;
            }
        }
    }
    
    // Simple conversion of markdown to HTML for height calculation
    text = text.replace(/^#\s+(.*)/, '<h1>$1</h1>');
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    this.measurer.innerHTML = text;

    await new Promise(resolve => requestAnimationFrame(resolve));
    
    return this.measurer.offsetHeight;
  }

  public cleanup(): void {
    if (this.measurer && this.measurer.parentNode) {
      this.measurer.parentNode.removeChild(this.measurer);
    }
  }
}
