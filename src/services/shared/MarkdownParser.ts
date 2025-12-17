// src/services/shared/MarkdownParser.ts

import type { Segment, Chapter, Book, Piece, MultilingualContent, ContentUnit } from '@/lib/types';
import { generateLocalUniqueId } from '@/lib/utils';

/**
 * Removes footnote annotations like [1], [23] and trims whitespace.
 */
function cleanText(text: string): string {
    if (!text) return '';
    return text.replace(/\[\d+\]/g, '').trim();
}

/**
 * Splits a sentence into phrases based on commas and semicolons.
 * Preserves punctuation at the end of each phrase.
 */
export function splitSentenceIntoPhrases(sentence: string): string[] {
    if (!sentence) return [];
    
    // Match text segments separated by , or ; (including the delimiter)
    const parts = sentence.match(/[^,;]+[,;]?/g) || [];
    
    return parts
        .map(p => p.trim())
        .filter(p => p.length > 0);
}


/**
 * Smart sentence splitting for MONOLINGUAL text only.
 * Handles common abbreviations, decimals, and ellipsis.
 */
function splitIntoSentences(text: string): string[] {
    if (!text) return [];
    
    const abbreviations = [
        'Dr', 'Mr', 'Mrs', 'Ms', 'Prof', 'Sr', 'Jr',
        'St', 'Ave', 'Blvd', 'Rd', 'etc', 'vs', 'Inc', 'Ltd', 'Corp',
        'U\\.S', 'U\\.K', 'U\\.S\\.A', 'Ph\\.D', 'M\\.D', 'B\\.A', 'M\\.A'
    ];
    
    const ABBR_PREFIX = '___ABBR_';
    const DECIMAL_PREFIX = '___DEC_';
    const ELLIPSIS_PREFIX = '___ELLIP_';
    
    let processed = text;
    const replacements: Array<{ placeholder: string; original: string }> = [];
    let counter = 0;
    
    processed = processed.replace(/\.{3,}/g, () => {
        const placeholder = `__ELLIP_${counter++}__`;
        replacements.push({ placeholder, original: '...' });
        return placeholder;
    });
    
    processed = processed.replace(/\d+\.\d+/g, (match) => {
        const placeholder = `__DEC_${counter++}__`;
        replacements.push({ placeholder, original: match });
        return placeholder;
    });
    
    abbreviations.forEach(abbr => {
        const regex = new RegExp(`\\b${abbr}\\.`, 'gi');
        processed = processed.replace(regex, (match) => {
            const placeholder = `__ABBR_${counter++}__`;
            replacements.push({ placeholder, original: match });
            return placeholder;
        });
    });
    
    const sentenceRegex = /[^.!?]+(?:[.!?]+["']?|$)(?=\s+[A-Z]|\s*$)/g;
    const sentences = processed.match(sentenceRegex) || [];
    
    if (sentences.length === 0 && processed.trim()) {
        let restored = processed;
        replacements.forEach(({ placeholder, original }) => {
            restored = restored.replace(placeholder, original);
        });
        return [restored.trim()];
    }
    
    return sentences
        .map(sentence => {
            let restored = sentence;
            replacements.forEach(({ placeholder, original }) => {
                restored = restored.replace(placeholder, original);
            });
            return restored.trim();
        })
        .filter(s => s.length > 0);
}


/**
 * Extracts text pairs using a simple and robust Regex scan.
 * Handles both monolingual and bilingual text based on whether `secondaryLang` is provided.
 */
function extractBilingualTextPairs(text: string, primaryLang: string, secondaryLang?: string): Array<MultilingualContent> {
    if (secondaryLang) {
        // --- BILINGUAL LOGIC ---
        const pairs: Array<MultilingualContent> = [];
        // Match a block of text, followed by its translation in curly braces.
        // This is greedy and will match from the start of the string to the first {...} block.
        const regex = /^(.*?)\s*\{(.*)\}\s*$/s;
        const match = text.match(regex);
        
        if (match) {
            const primaryText = cleanText(match[1]);
            const secondaryText = cleanText(match[2]);
            if (primaryText) {
                pairs.push({
                    [primaryLang]: primaryText,
                    [secondaryLang]: secondaryText
                });
            }
        } else {
            // If no match, treat the whole thing as primary language
            const primaryText = cleanText(text);
            if (primaryText) pairs.push({ [primaryLang]: primaryText });
        }
        
        return pairs;
    } else {
        // --- MONOLINGUAL LOGIC ---
        return splitIntoSentences(text)
            .map(s => cleanText(s))
            .filter(Boolean)
            .map(s => ({ [primaryLang]: s }));
    }
}

/**
 * Main parser - processes a raw markdown string into a flat array of Segments.
 * This is now the unified parser for both Book and Piece types.
 * It identifies H1 headings and creates special segment types for them.
 */
export function segmentize(markdown: string, origin: string): Segment[] {
    const segments: Segment[] = [];
    let order = 0;
    const [primaryLang, secondaryLang] = origin.split('-');

    // Split content by H1 headings, keeping the heading as a delimiter
    const blocks = markdown.split(/(^#\s+.*$)/m).filter(p => p && p.trim() !== '');

    for (const block of blocks) {
        const trimmedBlock = block.trim();
        const contentArray: (string | LanguageBlock)[] = [];
        
        if (trimmedBlock.startsWith('# ')) {
            const headingContent = trimmedBlock.substring(2);
            const titlePair = extractBilingualTextPairs(headingContent, primaryLang, secondaryLang)[0] || {};
            contentArray.push("# ", titlePair);
        } else {
            const pair = extractBilingualTextPairs(trimmedBlock, primaryLang, secondaryLang)[0] || {};
            contentArray.push("", pair);
        }
        
        // Add trailing newlines if they exist
        const trailingNewlines = block.match(/(\r?\n)*$/);
        if (trailingNewlines && trailingNewlines[0]) {
            contentArray.push(trailingNewlines[0]);
        }

        segments.push({
            id: generateLocalUniqueId(),
            order: order++,
            content: contentArray,
        });
    }
    
    return segments;
}

/**
 * Calculates total word count from segments, handling both string and array content.
 */
function calculateTotalWords(segments: Segment[], primaryLang: string): number {
    return segments.reduce((sum, seg) => {
        const langBlock = seg.content.find(c => typeof c === 'object') as LanguageBlock | undefined;
        if (langBlock && langBlock[primaryLang]) {
            const text = langBlock[primaryLang];
            return sum + (text.split(/\s+/).filter(Boolean).length || 0);
        }
        return sum;
    }, 0);
}


/**
 * Helper to extract segments from library items.
 * ✅ UPDATED: Now parses from the `content` field.
 */
export function getItemSegments(
    item: Book | Piece | null
): Segment[] {
    if (!item) return [];

    // The content is already a Segment[] array, so just return it.
    if(item.type === 'book') {
        return item.chapters.flatMap(c => c.segments) || [];
    }
    if (item.type === 'piece') {
        return item.generatedContent || [];
    }
    return [];
}
