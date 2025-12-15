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
        const placeholder = `${'${ELLIPSIS_PREFIX}'}${'${counter++}'}___`;
        replacements.push({ placeholder, original: '...' });
        return placeholder;
    });
    
    processed = processed.replace(/\d+\.\d+/g, (match) => {
        const placeholder = `${'${DECIMAL_PREFIX}'}${'${counter++}'}___`;
        replacements.push({ placeholder, original: match });
        return placeholder;
    });
    
    abbreviations.forEach(abbr => {
        const regex = new RegExp(`\\b${'${abbr}'}\\.`, 'gi');
        processed = processed.replace(regex, (match) => {
            const placeholder = `${'${ABBR_PREFIX}'}${'${counter++}'}___`;
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
        });
    });

    return segments;
}


/**
 * Main parser - processes markdown text into a flat array of Segments.
 * For Pieces, it preserves ## headings as part of the content.
 * For Books, it assumes ## headings have already been extracted.
 */
export function parseMarkdownToSegments(markdown: string, origin: string, unit: ContentUnit, isPiece: boolean = false): Segment[] {
    const segments: Segment[] = [];
    let order = 0;

    const blocks = markdown.split(/(\n\s*\n|(?=^##\s+)|(?=^###\s+))/g).filter(p => p && p.trim() !== '');

    for (const block of blocks) {
        const trimmedBlock = block.trim();
        if (!trimmedBlock) continue;

        if (isPiece && trimmedBlock.startsWith('#')) {
             segments.push({
                id: generateLocalUniqueId(),
                order: order++,
                content: { [origin.split('-')[0]]: trimmedBlock },
            });
        } else {
            const blockSegments = processParagraphIntoSegments(trimmedBlock, origin, unit);
            blockSegments.forEach((seg) => {
                seg.order = order++;
                segments.push(seg);
            });
        }
    }

    return segments;
}


/**
 * Parses book-level markdown with title and chapters.
 * This function EXTRACTS and REMOVES the title (#) and chapter titles (##).
 */
export function parseBookMarkdown(
    markdown: string,
    origin: string
): { title: MultilingualContent; chapters: Chapter[]; unit: ContentUnit } {
    const parts = origin.split('-');
    const primaryLang = parts[0];
    const secondaryLang = parts.length > 1 ? parts[1] : undefined;
    const unit: ContentUnit = origin.endsWith('-ph') ? 'phrase' : 'sentence';

    let title: MultilingualContent = { [primaryLang]: 'Untitled' };
    let contentAfterTitle = markdown;
    const lines = markdown.split('\n');

    // 1. Extract book title (#)
    const firstH1Index = lines.findIndex(line => line.trim().startsWith('# '));
    if (firstH1Index !== -1) {
        const titleLine = lines[firstH1Index].trim().substring(2).trim();
        const extractedTitle = extractBilingualTextPairs(titleLine, primaryLang, secondaryLang)[0];
        if (extractedTitle) {
            title = extractedTitle;
        }
        contentAfterTitle = lines.slice(firstH1Index + 1).join('\n');
    }

    // 2. Find all chapter heading (##) locations
    const chapterIndices: number[] = [];
    const contentLines = contentAfterTitle.split('\n');
    contentLines.forEach((line, index) => {
        if (line.trim().startsWith('## ')) {
            chapterIndices.push(index);
        }
    });

    // 3. Create blocks of text for each chapter
    const chapterBlocks: string[] = [];
    if (chapterIndices.length === 0) {
        // If no chapters found, treat the whole content as the first chapter
        if (contentAfterTitle.trim()) {
            chapterBlocks.push(`## Chapter 1\n${contentAfterTitle}`);
        }
    } else {
        for (let i = 0; i < chapterIndices.length; i++) {
            const start = chapterIndices[i];
            const end = i + 1 < chapterIndices.length ? chapterIndices[i + 1] : undefined;
            const chapterBlock = contentLines.slice(start, end).join('\n');
            chapterBlocks.push(chapterBlock);
        }
    }

    // 4. Process each chapter block
    const chapters: Chapter[] = [];
    chapterBlocks.forEach((chapterText) => {
        const chapterLines = chapterText.trim().split('\n');
        if (chapterLines.length === 0) return;

        const chapterTitleLine = chapterLines[0] || '';
        const chapterContent = chapterLines.slice(1).join('\n');
        
        const chapterTitle = extractBilingualTextPairs(chapterTitleLine.replace(/^##\s*/, ''), primaryLang, secondaryLang)[0] || { [primaryLang]: `Chapter ${chapters.length + 1}` };
        const segments = parseMarkdownToSegments(chapterContent, origin, unit, false); // isPiece is false

        // Only add chapter if it has content
        if (segments.length > 0) {
            chapters.push({
                id: generateLocalUniqueId(),
                order: chapters.length,
                title: chapterTitle,
                segments,
                stats: { totalSegments: segments.length, totalWords: calculateTotalWords(segments, primaryLang), estimatedReadingTime: 1 },
            });
        }
    });
    
    return { title, chapters, unit };
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
 */
export function getItemSegments(
    item: Book | Piece | null,
    chapterIndex: number = 0
): Segment[] {
    if (!item) return [];

    if (item.type === 'piece') {
        return (item as Piece).generatedContent || [];
    }

    if (item.type === 'book') {
        const book = item as Book;
        const chapter = book.chapters?.[chapterIndex];
        return chapter?.segments || [];
    }

    return [];
}
