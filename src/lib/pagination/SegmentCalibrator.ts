// src/lib/pagination/SegmentCalibrator.ts
'use client';

import type { Segment, ContentUnit } from '@/lib/types';
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

    // Instead of manually constructing elements, we use the actual React component logic
    // This is more complex to set up but provides perfect accuracy.
    // For now, we'll stick to a slightly simplified but still robust manual construction.

    const primaryText = segment.content[displayLang1] as string;
    if (!primaryText) return 0;
    
    const wrapper = document.createElement(segment.type === 'heading1' ? 'h1' : 'div');
    wrapper.className = segment.type === 'heading1' 
        ? 'font-headline text-3xl mt-4 mb-6 border-b pb-2' 
        : (isBilingual && unit === 'sentence') 
            ? 'block-segment mb-4' 
            : 'inline';
    
    if (isBilingual && unit === 'sentence') {
      const primaryEl = document.createElement('div');
      primaryEl.className = 'mb-1';
      primaryEl.textContent = primaryText;
      wrapper.appendChild(primaryEl);

      const secondaryText = segment.content[displayLang2];
      if (secondaryText) {
        const secondaryEl = document.createElement('div');
        secondaryEl.className = 'text-muted-foreground italic text-[0.9em]';
        secondaryEl.textContent = secondaryText as string;
        wrapper.appendChild(secondaryEl);
      }
    } else {
      wrapper.textContent = primaryText + (unit === 'sentence' ? ' ' : '');
    }
    
    this.measurer.appendChild(wrapper);

    await new Promise(resolve => requestAnimationFrame(resolve));
    
    const extraSpacing = segment.type === 'heading1' ? 30 : 0;
    
    return this.measurer.offsetHeight + extraSpacing;
  }

  public cleanup(): void {
    if (this.measurer && this.measurer.parentNode) {
      this.measurer.parentNode.removeChild(this.measurer);
    }
  }
}
