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
 * e.g., "# {Hello} {Xin chào}\n\n" -> ["# ", {en: "Hello", vi: "Xin chào"}, "\n\n"]
 */
function parseLineToSegmentContent(line: string, primaryLang: string, secondaryLang?: string): (string | LanguageBlock)[] {
    const content: (string | LanguageBlock)[] = [];
    const langBlock: LanguageBlock = {};
    
    // Regex to find language blocks like {text}
    const langBlockRegex = /\{(.*?)\}/g;
    let lastIndex = 0;
    let langIndex = 0;

    // Find the first language block to determine the prefix
    const firstMatch = langBlockRegex.exec(line);
    
    if (!firstMatch) {
        // No language blocks, treat the whole line as the content itself (monolingual case without braces)
        // This makes the parser more robust.
        langBlock[primaryLang] = cleanText(line);
        content.push(langBlock);
        return content;
    }
    
    // There is at least one language block
    const prefix = line.substring(0, firstMatch.index);
    if (prefix) {
        content.push(prefix);
    }

    // Reset regex for global search from the beginning
    langBlockRegex.lastIndex = 0;
    let match;
    
    while ((match = langBlockRegex.exec(line)) !== null) {
        const lang = langIndex === 0 ? primaryLang : secondaryLang;
        if (lang) {
            langBlock[lang] = cleanText(match[1]);
        }
        langIndex++;
        lastIndex = match.index + match[0].length;
    }

    content.push(langBlock);

    const suffix = line.substring(lastIndex);
    if (suffix) {
        content.push(suffix);
    }
    
    return content;
}

/**
 * Main parser - processes a raw markdown string into a flat array of Segments.
 * Each segment's content is an array: [prefix, {langBlock}, suffix].
 */
export function parseMarkdownToSegments(markdown: string, origin: string): Segment[] {
    const segments: Segment[] = [];
    let order = 0;
    const [primaryLang, secondaryLang] = origin.split('-');

    // Split by newlines to process line by line. Filter out empty lines.
    const lines = markdown.split(/\r?\n/).filter(line => line.trim() !== '');

    for (const line of lines) {
        let segmentType: 'heading1' | undefined = undefined;
        if (line.trim().startsWith('#')) {
            segmentType = 'heading1';
        }
        
        segments.push({
            id: generateLocalUniqueId(),
            order: order++,
            content: parseLineToSegmentContent(line, primaryLang, secondaryLang),
            type: segmentType,
        });
    }
    
    return segments;
}
