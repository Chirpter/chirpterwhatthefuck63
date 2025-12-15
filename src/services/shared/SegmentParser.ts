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
        // This regex finds all occurrences of `text {translation}`.
        const regex = /([^{}]+)\s*\{(.*?)\}/g;
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(text)) !== null) {
            // Capture any text between the last match and this one as monolingual primary
            if (match.index > lastIndex) {
                const orphanText = cleanText(text.substring(lastIndex, match.index));
                if (orphanText) {
                    pairs.push({ [primaryLang]: orphanText });
                }
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
        
        // Capture any remaining text at the end of the string
        if (lastIndex < text.length) {
            const remainingText = cleanText(text.substring(lastIndex));
            if (remainingText) {
                pairs.push({ [primaryLang]: remainingText });
            }
        }
        return pairs;
    } else {
        // --- MONOLINGUAL LOGIC ---
        const mappedItems = splitIntoSentences(text).map(sentence => {
            const cleaned = cleanText(sentence);
            return cleaned ? { [primaryLang]: cleaned } : null;
        });
        
        // Use a type guard to filter out nulls and satisfy TypeScript
        function isNotNullOrUndefined<T>(value: T | null | undefined): value is T {
          return value !== null && value !== undefined;
        }
        return mappedItems.filter(isNotNullOrUndefined);
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
            // For 'sentence' unit, the content is already a string.
            // We just need to make sure both languages are strings if they exist.
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

    // Use a regex to split by \n\n OR by a markdown heading
    const blocks = markdown.split(/(\n\s*\n|(?=^##\s+)|(?=^###\s+))/g).filter(p => p && p.trim() !== '');

    for (const block of blocks) {
        const trimmedBlock = block.trim();
        if (!trimmedBlock) continue;

        // If it's a Piece, we preserve headings as their own segment.
        // If it's a Book, headings are already handled, so we just process content.
        if (isPiece && trimmedBlock.startsWith('#')) {
             segments.push({
                id: generateLocalUniqueId(),
                order: order++,
                content: { [origin.split('-')[0]]: trimmedBlock },
            });
        } else {
            // Process the block into sentence/phrase segments
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
    const firstH1Index = lines.findIndex(line => line.trim().startsWith('# '));

    if (firstH1Index !== -1) {
        const titleLine = lines[firstH1Index].trim().substring(2).trim();
        const extractedTitle = extractBilingualTextPairs(titleLine, primaryLang, secondaryLang)[0];
        if (extractedTitle) {
          title = extractedTitle;
        }
        // Remove the title from the content to be processed
        contentAfterTitle = lines.slice(firstH1Index + 1).join('\n');
    }

    const chapters: Chapter[] = [];
    // Split by '## ' but keep the delimiter in the next chunk, so we know it's a chapter
    const chapterSplitRegex = /(?=##\s)/g;
    const chapterContents = contentAfterTitle.split(chapterSplitRegex).filter(c => c.trim() !== '');

    const processChapter = (chapterText: string) => {
        const chapterLines = chapterText.trim().split('\n');
        const chapterTitleLine = chapterLines[0] || `Chapter ${'${chapters.length + 1}'}`;
        // The rest of the lines are the content, now that the title line is removed
        const chapterContent = chapterLines.slice(1).join('\n');
        
        const chapterTitle = extractBilingualTextPairs(chapterTitleLine.replace(/^##\s*/, ''), primaryLang, secondaryLang)[0] || { [primaryLang]: chapterTitleLine };
        const segments = parseMarkdownToSegments(chapterContent, origin, unit, false); // isPiece is false

        if (segments.length > 0) {
            chapters.push({
                id: generateLocalUniqueId(),
                order: chapters.length,
                title: chapterTitle,
                segments,
                stats: { totalSegments: segments.length, totalWords: calculateTotalWords(segments, primaryLang), estimatedReadingTime: 1 },
                metadata: { primaryLanguage: primaryLang }
            });
        }
    };
    
    // If there are no '##' headings, treat the entire content as a single chapter
    if (chapterContents.length === 0 && contentAfterTitle.trim()) {
        const segments = parseMarkdownToSegments(contentAfterTitle, origin, unit, false); // isPiece is false
        if (segments.length > 0) {
            chapters.push({
                id: generateLocalUniqueId(),
                order: 0,
                title: { [primaryLang]: `Chapter 1` },
                segments,
                stats: { totalSegments: segments.length, totalWords: calculateTotalWords(segments, primaryLang), estimatedReadingTime: 1 },
                metadata: { primaryLanguage: primaryLang }
            });
        }
    } else {
        chapterContents.forEach(text => processChapter(text));
    }
    
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
