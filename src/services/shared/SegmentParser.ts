// src/services/shared/SegmentParser.ts

import type { Segment, MultilingualContent, ContentUnit } from '@/lib/types';
import { generateLocalUniqueId } from '@/lib/utils';

/**
 * Removes footnote annotations like [1], [23] and trims whitespace.
 */
function cleanText(text: string): string {
    if (!text) return '';
    return text.replace(/\[\d+\]/g, '').trim();
}

/**
 * Extracts a text pair (e.g., "Hello {Xin chào}") into a structured object.
 * It's robust against missing translations.
 */
function extractBilingualPair(text: string, primaryLang: string, secondaryLang?: string): MultilingualContent {
    if (secondaryLang) {
        const match = text.match(/^(.*?)\s*\{(.*)\}\s*$/);
        if (match) {
            return {
                [primaryLang]: cleanText(match[1]),
                [secondaryLang]: cleanText(match[2]),
            };
        }
    }
    return { [primaryLang]: cleanText(text) };
}

/**
 * Main parser - processes a raw markdown string into a flat array of Segments.
 * This function embodies the final, optimized architecture.
 * It does NOT interpret markdown beyond identifying H1 headings for classification.
 *
 * @param markdown The raw markdown string from the AI.
 * @param origin The language origin string (e.g., 'en', 'en-vi').
 * @returns A flat array of `Segment` objects.
 */
export function parseMarkdownToSegments(markdown: string, origin: string): Segment[] {
    const segments: Segment[] = [];
    let order = 0;
    const [primaryLang, secondaryLang] = origin.split('-');

    // Split content by newlines to process line by line.
    // This simple approach is robust for detecting headings.
    const lines = markdown.split(/\r?\n/);
    
    let paragraphBuffer: string[] = [];

    const flushParagraphBuffer = () => {
        if (paragraphBuffer.length > 0) {
            const paragraphText = paragraphBuffer.join('\n');
            
            // Create a single segment for the entire paragraph block.
            // The content is kept raw, including newlines.
            segments.push({
                id: generateLocalUniqueId(),
                order: order++,
                type: 'start_para', // Mark this as the start of a paragraph
                content: {
                    [primaryLang]: paragraphText,
                },
            });
            paragraphBuffer = [];
        }
    };

    for (const line of lines) {
        const trimmedLine = line.trim();
        
        if (trimmedLine.startsWith('# ')) {
            // A heading marks the end of any preceding paragraph.
            flushParagraphBuffer(); 
            
            const headingContent = trimmedLine.substring(2).trim();
            const contentPair = extractBilingualPair(headingContent, primaryLang, secondaryLang);
            
            segments.push({
                id: generateLocalUniqueId(),
                order: order++,
                type: 'heading1',
                content: contentPair,
            });
        } else if (trimmedLine === '') {
            // A blank line also marks the end of a paragraph.
            flushParagraphBuffer();
        } else {
            // Collect lines into a buffer for the current paragraph.
            paragraphBuffer.push(line);
        }
    }
    
    // Ensure any remaining text in the buffer is processed.
    flushParagraphBuffer(); 

    return segments;
}
