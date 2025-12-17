// src/services/shared/SegmentParser.ts

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
        const regex = /([^{}]+)\s*\{(.*?)\}/g;
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                const orphanText = cleanText(text.substring(lastIndex, match.index));
                if (orphanText) pairs.push({ [primaryLang]: orphanText });
            }

            const primaryText = cleanText(match[1]);
            const secondaryText = cleanText(match[2]);
            
            if (primaryText) {
                pairs.push({
                    [primaryLang]: primaryText,
                    [secondaryLang]: secondaryText
                });
            }
            lastIndex = match.index + match[0].length;
        }
        
        if (lastIndex < text.length) {
            const remainingText = cleanText(text.substring(lastIndex));
            if (remainingText) pairs.push({ [primaryLang]: remainingText });
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
 * Processes a paragraph of text into an array of Segments.
 * This is the core logic that transforms a block of text into structured data.
 */
function processParagraphIntoSegments(
    paragraphText: string, 
    origin: string, 
    unit: ContentUnit
): Segment[] {
    const parts = origin.split('-');
    const primaryLang = parts[0];
    const secondaryLang = parts.length > 1 ? parts[1] : undefined;
    
    const segments: Segment[] = [];
    let segmentOrder = 0;

    const sentencePairs = extractBilingualTextPairs(paragraphText, primaryLang, secondaryLang);

    sentencePairs.forEach((sentencePair) => {
        const primarySentence = sentencePair[primaryLang];
        if (!primarySentence || typeof primarySentence !== 'string') return;
        
        let finalContent: MultilingualContent = {};

        if (unit === 'phrase' && secondaryLang) {
            finalContent[primaryLang] = splitSentenceIntoPhrases(primarySentence);
            const secondarySentence = sentencePair[secondaryLang];
            if (secondarySentence && typeof secondarySentence === 'string') {
                finalContent[secondaryLang] = splitSentenceIntoPhrases(secondarySentence);
            } else {
                finalContent[secondaryLang] = []; // Ensure it's an array even if empty
            }
        } else {
            finalContent[primaryLang] = Array.isArray(sentencePair[primaryLang]) ? (sentencePair[primaryLang] as string[]).join(' ') : sentencePair[primaryLang];
            if (secondaryLang && sentencePair[secondaryLang]) {
                finalContent[secondaryLang] = Array.isArray(sentencePair[secondaryLang]) ? (sentencePair[secondaryLang] as string[]).join(' ') : sentencePair[secondaryLang];
            }
        }
        
        segments.push({
            id: generateLocalUniqueId(),
            order: segmentOrder++,
            content: finalContent,
            type: 'text', // Default type
        });
    });

    return segments;
}


/**
 * Main parser - processes markdown text into a flat array of Segments.
 * This is now the unified parser for both Book and Piece types.
 * It identifies H1 headings and creates special segment types for them.
 */
export function parseMarkdownToSegments(markdown: string, origin: string, unit: ContentUnit): Segment[] {
    const segments: Segment[] = [];
    let order = 0;
    const primaryLang = origin.split('-')[0];

    // Split content by H1 headings, keeping the heading as a delimiter
    const blocks = markdown.split(/(^#\s+.*$)/m).filter(p => p && p.trim() !== '');

    blocks.forEach(block => {
        const trimmedBlock = block.trim();
        
        if (trimmedBlock.startsWith('# ')) {
            // This is an H1 heading, treat it as a special segment
            const titleContent = trimmedBlock.substring(2).trim();
            const titlePair = extractBilingualTextPairs(titleContent, origin.split('-')[0], origin.split('-')[1])[0] || { [primaryLang]: titleContent };
            
            segments.push({
                id: generateLocalUniqueId(),
                order: order++,
                type: 'heading1',
                content: titlePair,
            });
        } else {
            // This is regular paragraph content, process it normally
            const paragraphSegments = processParagraphIntoSegments(trimmedBlock, origin, unit);
            paragraphSegments.forEach(seg => {
                seg.order = order++;
                segments.push(seg);
            });
        }
    });
    
    return segments;
}


/**
 * Calculates total word count from segments, handling both string and array content.
 */
function calculateTotalWords(segments: Segment[], primaryLang: string): number {
    return segments.reduce((sum, seg) => {
        const content = seg.content[primaryLang];
        if (content) {
            const text = Array.isArray(content) ? content.join(' ') : content;
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
    item: Book | Piece | null,
    chapterIndexToFilter?: number // This is now optional
): Segment[] {
    if (!item || !item.content) return [];

    const allSegments = parseMarkdownToSegments(item.content, item.origin, item.unit);
    
    if (item.type === 'piece' || chapterIndexToFilter === undefined) {
        return allSegments;
    }

    // For books, filter segments by chapter
    let currentChapter = -1;
    const chapterSegments: Segment[][] = [];
    
    allSegments.forEach(segment => {
        if (segment.type === 'heading1') {
            currentChapter++;
            chapterSegments[currentChapter] = [];
        }
        // Only add if a chapter has started
        if (currentChapter !== -1) {
            chapterSegments[currentChapter].push(segment);
        }
    });
    
    return chapterSegments[chapterIndexToFilter] || [];
}
