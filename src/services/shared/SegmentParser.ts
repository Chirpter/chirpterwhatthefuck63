// src/services/shared/SegmentParser.ts

import type { Segment, LanguageBlock } from '@/lib/types';
import { generateLocalUniqueId } from '@/lib/utils';

/**
 * Removes footnote annotations like [1], [23] and trims whitespace.
 */
function cleanText(text: string): string {
    if (!text) return '';
    return text.replace(/\[\d+\]/g, '').trim();
}

/**
 * The core parser that transforms a line of markdown text into a structured Segment content array.
 * It identifies a prefix, the language blocks, and a suffix.
 * This version correctly handles the format: `This is a sentence. {Đây là một câu.}`
 */
function parseLineToSegmentContent(line: string, primaryLang: string, secondaryLang?: string): (string | LanguageBlock)[] {
    const content: (string | LanguageBlock)[] = [];
    const langBlock: LanguageBlock = {};

    // Regex to find the LAST language block like {text}
    const langBlockRegex = /\{(.*?)\}\s*$/;
    const match = line.match(langBlockRegex);

    let prefix = "";
    let suffix = "";
    let primaryPart = line;

    if (match && secondaryLang) {
        // --- BILINGUAL CASE ---
        primaryPart = line.substring(0, match.index);
        langBlock[secondaryLang] = cleanText(match[1]);
    }

    // Process the primary part (either the whole line or the part before the translation)
    const markdownPrefixRegex = /^(#+\s*|>\s*|[-*+]\s+)/;
    const prefixMatch = primaryPart.match(markdownPrefixRegex);

    let primaryText = primaryPart;
    if (prefixMatch) {
        prefix = prefixMatch[0];
        primaryText = primaryPart.substring(prefix.length);
    }
    
    // Any remaining text after the prefix is the primary language content
    langBlock[primaryLang] = cleanText(primaryText);
    
    content.push(prefix);
    content.push(langBlock);
    content.push(suffix); // Suffix is currently always empty but kept for structure

    return content;
}

/**
 * Main parser - processes a raw markdown string into a flat array of Segments.
 * Each segment's content is an array: [prefix, {langBlock}, suffix].
 */
export function segmentize(markdown: string, origin: string): Segment[] {
    const segments: Segment[] = [];
    let order = 0;
    const [primaryLang, secondaryLang] = origin.split('-');

    // Split by newlines to process line by line. Filter out empty lines.
    const lines = markdown.split(/\r?\n/).filter(line => line.trim() !== '');

    for (const line of lines) {
        const contentArray = parseLineToSegmentContent(line, primaryLang, secondaryLang);
        
        // Push the segment with its structured content
        segments.push({
            id: generateLocalUniqueId(),
            order: order++,
            content: contentArray,
        });
    }
    
    return segments;
}
