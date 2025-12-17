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
 * This version correctly handles the format: `Some text in primary language. {Dịch sang ngôn ngữ phụ.}`
 */
function parseLineToSegmentContent(line: string, primaryLang: string, secondaryLang?: string): (string | LanguageBlock)[] {
    const content: (string | LanguageBlock)[] = [];
    const langBlock: LanguageBlock = {};

    // Regex to find the LAST language block like {text}
    const langBlockRegex = /\{(.*?)\}\s*$/;
    const match = line.match(langBlockRegex);

    if (match && secondaryLang) {
        // --- BILINGUAL CASE ---
        // The text before the match is the primary language content + any prefix
        const primaryPart = line.substring(0, match.index).trim();
        const secondaryText = cleanText(match[1]);
        
        langBlock[secondaryLang] = secondaryText;

        // Check for markdown prefix in the primary part
        const markdownPrefixRegex = /^(#+\s*|>\s*|[-*+]\s+)/;
        const prefixMatch = primaryPart.match(markdownPrefixRegex);
        
        let prefix = "";
        let primaryText = primaryPart;

        if (prefixMatch) {
            prefix = prefixMatch[0];
            primaryText = primaryPart.substring(prefix.length);
        }

        langBlock[primaryLang] = cleanText(primaryText);
        
        if (prefix) content.push(prefix);
        content.push(langBlock);
        // Suffix is ignored in this logic as the {block} is assumed to be at the end.

    } else {
        // --- MONOLINGUAL CASE ---
        // The whole line is treated as primary content
        const trimmedLine = cleanText(line);

        const markdownPrefixRegex = /^(#+\s*|>\s*|[-*+]\s+)/;
        const prefixMatch = trimmedLine.match(markdownPrefixRegex);
        
        let prefix = "";
        let primaryText = trimmedLine;

        if (prefixMatch) {
            prefix = prefixMatch[0];
            primaryText = trimmedLine.substring(prefix.length);
        }
        
        langBlock[primaryLang] = primaryText;
        
        if (prefix) content.push(prefix);
        content.push(langBlock);
    }
    
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
        segments.push({
            id: generateLocalUniqueId(),
            order: order++,
            content: parseLineToSegmentContent(line, primaryLang, secondaryLang),
        });
    }
    
    return segments;
}
