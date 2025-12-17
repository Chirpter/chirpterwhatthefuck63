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
    
    let processedText = text;
    const placeholder = '___PERIOD___';
    
    abbreviations.forEach(abbr => {
        const regex = new RegExp(`\\b(${abbr})\\\.`, 'gi');
        processedText = processedText.replace(regex, `$1${placeholder}`);
    });
    
    const sentenceRegex = /[^.!?]+(?:[.!?]+["']?|$)/g;
    let sentences = processedText.match(sentenceRegex) || [processedText];
    
    return sentences.map(s => s.replace(new RegExp(placeholder, 'g'), '.').trim()).filter(Boolean);
}


/**
 * Extracts text pairs using a simple and robust Regex scan.
 * Handles both monolingual and bilingual text based on whether `secondaryLang` is provided.
 * @returns An object with the primary text and optional secondary text.
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
    // Fallback for monolingual or malformed bilingual
    return { [primaryLang]: cleanText(text) };
}

/**
 * Processes a block of text into an array of Segments.
 */
function processTextBlockIntoSegments(
    textBlock: string, 
    origin: string, 
    unit: ContentUnit
): Segment[] {
    const [primaryLang, secondaryLang] = origin.split('-');
    const segments: Segment[] = [];
    let segmentOrder = 0;

    const sentences = splitIntoSentences(textBlock);

    for (const sentence of sentences) {
        const contentPair = extractBilingualPair(sentence, primaryLang, secondaryLang);
        const primarySentence = contentPair[primaryLang];
        if (!primarySentence || typeof primarySentence !== 'string') continue;
        
        let finalContent: MultilingualContent = {};

        if (unit === 'phrase' && secondaryLang) {
            finalContent[primaryLang] = splitSentenceIntoPhrases(primarySentence);
            const secondarySentence = contentPair[secondaryLang];
            if (secondarySentence && typeof secondarySentence === 'string') {
                finalContent[secondaryLang] = splitSentenceIntoPhrases(secondarySentence);
            } else {
                finalContent[secondaryLang] = [];
            }
        } else {
            finalContent = contentPair;
        }
        
        segments.push({
            id: generateLocalUniqueId(),
            order: segmentOrder++,
            content: finalContent,
            // type is implicitly 'text'
        });
    }

    return segments;
}


/**
 * Main parser - processes a raw markdown string into a flat array of Segments.
 * It identifies H1 headings, sets the `type`, and cleans the '#' from the content.
 * It preserves all other markdown characters (`\n`, `**`, etc.) within the content blocks.
 */
export function parseMarkdownToSegments(markdown: string, origin: string, unit: ContentUnit): Segment[] {
    const segments: Segment[] = [];
    let order = 0;
    const [primaryLang, secondaryLang] = origin.split('-');

    // Split by newlines to process line-by-line for headings or group into paragraphs
    const lines = markdown.split(/\r?\n/);
    
    let paragraphBuffer: string[] = [];

    const flushParagraphBuffer = () => {
        if (paragraphBuffer.length > 0) {
            const paragraphText = paragraphBuffer.join('\n');
            const paragraphSegments = processTextBlockIntoSegments(paragraphText, origin, unit);
            
            // Mark the first segment of a new paragraph
            if (paragraphSegments.length > 0) {
              paragraphSegments[0].type = 'start_para';
            }

            paragraphSegments.forEach(seg => {
                seg.order = order++;
                segments.push(seg);
            });
            paragraphBuffer = [];
        }
    };

    for (const line of lines) {
        const trimmedLine = line.trim();
        
        if (trimmedLine.startsWith('# ')) {
            flushParagraphBuffer(); // Process any preceding paragraph
            
            const titleContent = trimmedLine.substring(2).trim();
            const contentPair = extractBilingualPair(titleContent, primaryLang, secondaryLang);
            
            segments.push({
                id: generateLocalUniqueId(),
                order: order++,
                type: 'heading1',
                content: contentPair,
            });
        } else if (trimmedLine === '') {
            flushParagraphBuffer(); // Blank line signifies a new paragraph
        } else {
            paragraphBuffer.push(line);
        }
    }
    
    flushParagraphBuffer(); // Process any remaining text

    return segments;
}
