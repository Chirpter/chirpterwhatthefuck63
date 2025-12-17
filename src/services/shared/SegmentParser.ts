// src/services/shared/SegmentParser.ts

import type { Segment, LanguageBlock, ContentUnit } from '@/lib/types';
import { generateLocalUniqueId } from '@/lib/utils';

/**
 * Removes footnote annotations like [1], [23] and trims whitespace.
 */
function cleanText(text: string): string {
    if (!text) return '';
    return text.replace(/\[\d+\]/g, '').trim();
}

/**
 * A specialized parser for monolingual content.
 * It attempts to split text into sentences.
 */
function monoSegmentize(markdown: string, lang: string): Segment[] {
    const segments: Segment[] = [];
    let order = 0;
    
    const lines = markdown.split(/\r?\n/).filter(line => line.trim() !== '');

    for (const line of lines) {
        const markdownPrefixRegex = /^(#+\s*|>\s*|[-*+]\s+)/;
        const prefixMatch = line.match(markdownPrefixRegex);
        const prefix = prefixMatch ? prefixMatch[0] : '';
        const textContent = line.substring(prefix.length);

        // Simple sentence splitting for monolingual content.
        // This can be improved with more sophisticated NLP rules.
        const sentences = textContent.match(/[^.!?]+[.!?]*/g) || [textContent];

        for (const sentence of sentences) {
            if (sentence.trim()) {
                segments.push({
                    id: generateLocalUniqueId(),
                    order: order++,
                    content: [prefix, { [lang]: cleanText(sentence) }, '']
                });
            }
        }
    }
    return segments;
}

/**
 * A specialized and efficient parser for bilingual content in the format "Primary {Secondary}".
 */
function bilingualSegmentize(markdown: string, primaryLang: string, secondaryLang: string): Segment[] {
    const segments: Segment[] = [];
    let order = 0;

    const lines = markdown.split(/\r?\n/).filter(line => line.trim() !== '');

    for (const line of lines) {
        const markdownPrefixRegex = /^(#+\s*|>\s*|[-*+]\s+)/;
        const prefixMatch = line.match(markdownPrefixRegex);
        const prefix = prefixMatch ? prefixMatch[0] : '';
        let remainingLine = line.substring(prefix.length);

        // Regex to find language blocks: Some text {other text}
        const langBlockRegex = /(.*?)\s*\{(.*?)\}/g;
        let lastIndex = 0;
        let match;

        while ((match = langBlockRegex.exec(remainingLine)) !== null) {
            const primaryText = match[1];
            const secondaryText = match[2];

            if (primaryText.trim() || secondaryText.trim()) {
                segments.push({
                    id: generateLocalUniqueId(),
                    order: order++,
                    content: [prefix, { [primaryLang]: cleanText(primaryText), [secondaryLang]: cleanText(secondaryText) }, '']
                });
            }
            lastIndex = match.index + match[0].length;
        }

        // Handle any remaining text on the line that didn't match the pattern
        if (lastIndex < remainingLine.length) {
            const trailingText = remainingLine.substring(lastIndex);
            if (trailingText.trim()) {
                 segments.push({
                    id: generateLocalUniqueId(),
                    order: order++,
                    content: [prefix, { [primaryLang]: cleanText(trailingText) }, '']
                });
            }
        }
    }

    return segments;
}

/**
 * A placeholder for a future, on-demand phrase segmentation function.
 */
function phraseSegmentize(segments: Segment[]): Segment[] {
    // TODO: Implement logic to further break down sentence segments into phrases.
    // This is a complex NLP task and is deferred for now.
    console.warn("Phrase segmentation is not yet implemented.");
    return segments;
}


/**
 * Main parser - The "router" that directs to the correct segmentation strategy.
 * Processes a raw markdown string into a flat array of structured Segments.
 * @param markdown The raw markdown string from AI.
 * @param origin The language format string, e.g., "en", "en-vi", "en-vi-ph".
 * @returns An array of Segment objects.
 */
export function segmentize(markdown: string, origin: string): Segment[] {
    const parts = origin.split('-');
    const [primaryLang, secondaryLang, formatFlag] = parts;

    let segments: Segment[];

    if (secondaryLang) {
        // Bilingual mode
        segments = bilingualSegmentize(markdown, primaryLang, secondaryLang);
    } else {
        // Monolingual mode
        segments = monoSegmentize(markdown, primaryLang);
    }

    // On-demand phrase segmentation if requested
    if (formatFlag === 'ph') {
        segments = phraseSegmentize(segments);
    }
    
    return segments;
}
