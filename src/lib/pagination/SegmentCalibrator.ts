// src/lib/pagination/SegmentCalibrator.ts
'use client';

import type { Segment, ContentUnit, LanguageBlock } from '@/lib/types';
import { SegmentRenderer } from '@/features/reader/components/shared/SegmentRenderer';

/**
 * Reconstructs the final markdown string from a segment object based on display settings.
 * This needs to be available here for the calibrator to use.
 */
function reconstructMarkdown(
    segment: Segment,
    displayLang1: string,
    displayLang2: string,
    unit: ContentUnit
): string {
    const prefix = segment.content[0] as string;
    const langBlock = segment.content[1] as LanguageBlock;
    const suffix = segment.content[2] as string;

    const primaryText = langBlock[displayLang1] || '';
    const secondaryText = langBlock[displayLang2] || '';

    if (displayLang2 !== 'none' && secondaryText) {
        if (unit === 'phrase') {
            return `${prefix}${primaryText} (${secondaryText})${suffix}`;
        }
        // Default to sentence mode
        return `${prefix}${primaryText}${suffix}\n\n<em class="text-muted-foreground">${secondaryText}</em>`;
    }

    // Monolingual mode
    return `${prefix}${primaryText}${suffix}`;
}

export class SegmentCalibrator {
  private container: HTMLElement;
  private measurer: HTMLDivElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.measurer = this.createMeasurer();
  }

  private createMeasurer(): HTMLDivElement {
    const measurer = document.createElement('div');
    // Ensure the measurer has the same typographic styles as the real container
    measurer.className = this.container.className.replace(/overflow-hidden/g, '') + ' max-w-none';
    measurer.style.cssText = `
      position: absolute;
      visibility: hidden;
      height: auto;
      width: ${this.container.clientWidth}px;
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
    
    const markdownToRender = reconstructMarkdown(
        segment, 
        displayLang1, 
        displayLang2, 
        unit
    );
    
    // Simple conversion of markdown to HTML for height calculation
    // This is a rough approximation. A more accurate method might involve rendering
    // the ReactMarkdown component to a string, but that's complex.
    const html = markdownToRender
        .replace(/^#\s+(.*)/, '<h1>$1</h1>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br/>');

    this.measurer.innerHTML = html;

    // Wait for the browser to render the content to get an accurate height
    await new Promise(resolve => requestAnimationFrame(resolve));
    
    return this.measurer.offsetHeight;
  }

  public cleanup(): void {
    if (this.measurer && this.measurer.parentNode) {
      this.measurer.parentNode.removeChild(this.measurer);
    }
  }
}
