// src/lib/pagination/SegmentCalibrator.ts
'use client';

import type { Segment, ContentUnit } from '@/lib/types';
import { splitSentenceIntoPhrases } from '@/services/shared/SegmentParser';

export class SegmentCalibrator {
  private container: HTMLElement;
  private measurer: HTMLDivElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.measurer = this.createMeasurer();
  }

  private createMeasurer(): HTMLDivElement {
    const measurer = document.createElement('div');
    measurer.className = 'prose max-w-none font-serif prose-dynamic'; // Use dynamic font size class
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
    const primaryText = segment.content[displayLang1];
    if (!primaryText) return 0;
    
    const isHeading = Array.isArray(primaryText) ? primaryText[0].startsWith('#') : primaryText.startsWith('#');

    // Create the wrapper based on display mode
    let wrapper: HTMLElement;
    if (isBilingual && unit === 'sentence') {
      wrapper = document.createElement('div');
      wrapper.className = 'bilingual-sentence-block mb-4';

      const primaryEl = document.createElement('div');
      primaryEl.className = 'mb-1';
      primaryEl.textContent = Array.isArray(primaryText) ? primaryText.join(' ') : primaryText;
      wrapper.appendChild(primaryEl);

      const secondaryText = segment.content[displayLang2];
      if (secondaryText) {
        const secondaryEl = document.createElement('div');
        secondaryEl.className = 'text-muted-foreground italic text-[0.9em]';
        secondaryEl.textContent = Array.isArray(secondaryText) ? secondaryText.join(' ') : secondaryText;
        wrapper.appendChild(secondaryEl);
      }
    } else {
      wrapper = document.createElement('span');
      wrapper.className = 'inline';
      
      const text = Array.isArray(primaryText) ? primaryText.join(' ') : primaryText;
      wrapper.textContent = text + ' '; // Add space for inline flow
      
      if (isBilingual && unit === 'phrase') {
        const secondaryText = segment.content[displayLang2];
        const secondaryPhrases = Array.isArray(secondaryText) ? secondaryText : splitSentenceIntoPhrases(secondaryText || '');
        const primaryPhrases = Array.isArray(primaryText) ? primaryText : splitSentenceIntoPhrases(primaryText);
        
        wrapper.textContent = ''; // Clear and rebuild
        primaryPhrases.forEach((phrase, index) => {
            const phraseSpan = document.createElement('span');
            phraseSpan.textContent = phrase + ' ';
            if(secondaryPhrases[index]) {
                const secondarySpan = document.createElement('span');
                secondarySpan.className = 'text-muted-foreground italic text-[0.9em] ml-1';
                secondarySpan.textContent = `(${secondaryPhrases[index]}) `;
                phraseSpan.appendChild(secondarySpan);
            }
            wrapper.appendChild(phraseSpan);
        });
      }
    }
    
    this.measurer.appendChild(wrapper);

    // Wait for the browser to render
    await new Promise(resolve => requestAnimationFrame(resolve));
    
    // For headings, add extra spacing to prevent them from being at the bottom of a page
    const extraSpacing = isHeading ? 30 : 0;
    
    return this.measurer.offsetHeight + extraSpacing;
  }

  public cleanup(): void {
    if (this.measurer && this.measurer.parentNode) {
      this.measurer.parentNode.removeChild(this.measurer);
    }
  }
}
