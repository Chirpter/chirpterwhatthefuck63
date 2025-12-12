
// src/services/MarkdownParser.ts

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
function splitSentenceIntoPhrases(sentence: string): string[] {
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
    
    // Common abbreviations that should NOT trigger sentence breaks
    const abbreviations = [
        'Dr', 'Mr', 'Mrs', 'Ms', 'Prof', 'Sr', 'Jr',
        'St', 'Ave', 'Blvd', 'Rd', 'etc', 'vs', 'Inc', 'Ltd', 'Corp',
        'U\\.S', 'U\\.K', 'U\\.S\\.A', 'Ph\\.D', 'M\\.D', 'B\\.A', 'M\\.A'
    ];
    
    // Create unique placeholders
    const ABBR_PREFIX = '___ABBR_';
    const DECIMAL_PREFIX = '___DEC_';
    const ELLIPSIS_PREFIX = '___ELLIP_';
    
    let processed = text;
    const replacements: Array<{ placeholder: string; original: string }> = [];
    let counter = 0;
    
    // Step 1: Protect ellipsis followed by lowercase (continuation)
    processed = processed.replace(/\.{3}(?=\s+[a-z])/g, () => {
        const placeholder = `${ELLIPSIS_PREFIX}${counter++}___`;
        replacements.push({ placeholder, original: '...' });
        return placeholder;
    });
    
    // Step 2: Protect decimal numbers
    processed = processed.replace(/\d+\.\d+/g, (match) => {
        const placeholder = `${DECIMAL_PREFIX}${counter++}___`;
        replacements.push({ placeholder, original: match });
        return placeholder;
    });
    
    // Step 3: Protect abbreviations
    abbreviations.forEach(abbr => {
        const regex = new RegExp(`\\b${abbr}\\.`, 'gi');
        processed = processed.replace(regex, (match) => {
            const placeholder = `${ABBR_PREFIX}${counter++}___`;
            replacements.push({ placeholder, original: match });
            return placeholder;
        });
    });
    
    // Step 4: Split on sentence boundaries
    // Matches: [.!?] followed by (space + capital) OR end of string
    const sentenceRegex = /[^.!?]+[.!?]+(?=\s+[A-Z]|\s*$)/g;
    const sentences = processed.match(sentenceRegex) || [];
    
    // If no matches, treat as single sentence
    if (sentences.length === 0 && processed.trim()) {
        let restored = processed;
        replacements.forEach(({ placeholder, original }) => {
            restored = restored.replace(placeholder, original);
        });
        return [restored.trim()];
    }
    
    // Step 5: Restore placeholders in each sentence
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
 * Extracts bilingual text pairs from a line.
 * This is a robust scanner that doesn't rely on sentence structure.
 */
function extractBilingualTextPairs(text: string, primaryLang: string, secondaryLang?: string): Array<MultilingualContent> {
    const pairs: Array<MultilingualContent> = [];
    
    if (!secondaryLang) {
        // MONOLINGUAL MODE: Use smart sentence splitting
        const sentences = splitIntoSentences(text);
        sentences.forEach(sentence => {
            const cleaned = cleanText(sentence);
            if (cleaned) {
                pairs.push({ [primaryLang]: cleaned });
            }
        });
        return pairs;
    }

    // BILINGUAL MODE: {...} is the absolute source of truth
    let currentIndex = 0;
    while (currentIndex < text.length) {
        const openBraceIndex = text.indexOf('{', currentIndex);
        
        // If no more opening braces are found
        if (openBraceIndex === -1) {
            const remainingText = cleanText(text.substring(currentIndex));
            if (remainingText) {
                pairs.push({ [primaryLang]: remainingText });
            }
            break;
        }

        // Text before the brace is part of the primary content
        const primaryTextBeforeBrace = cleanText(text.substring(currentIndex, openBraceIndex));

        const closeBraceIndex = text.indexOf('}', openBraceIndex);

        // If no closing brace is found (malformed)
        if (closeBraceIndex === -1) {
            const malformedText = cleanText(text.substring(currentIndex));
            if (malformedText) {
                pairs.push({ [primaryLang]: malformedText });
            }
            break;
        }

        const secondaryText = cleanText(text.substring(openBraceIndex + 1, closeBraceIndex));
        
        // If there's primary text before the brace, it forms a pair with the content in the brace
        if (primaryTextBeforeBrace) {
             pairs.push({ 
                [primaryLang]: primaryTextBeforeBrace, 
                [secondaryLang]: secondaryText || '' 
            });
        }
        
        currentIndex = closeBraceIndex + 1;
    }

    return pairs;
}


/**
 * Processes a paragraph into segments based on unit type.
 */
function processParagraphIntoSegments(
    paragraphText: string, 
    origin: string, 
    isFirstInParagraph: boolean
): Segment[] {
    const parts = origin.split('-');
    const primaryLang = parts[0];
    const secondaryLang = parts.length > 1 ? parts[1] : undefined;
    const format = parts.length > 2 ? parts[2] : undefined;
    const unit: ContentUnit = format === 'ph' ? 'phrase' : 'sentence';
    
    const segments: Segment[] = [];
    let segmentOrder = 0;
    let isFirstSegmentOfPara = isFirstInParagraph;

    // Step 1: Extract sentence pairs
    const sentencePairs = extractBilingualTextPairs(paragraphText, primaryLang, secondaryLang);

    // Step 2: Process each sentence pair
    sentencePairs.forEach((sentencePair) => {
        const primarySentence = sentencePair[primaryLang];
        const secondarySentence = secondaryLang ? sentencePair[secondaryLang] : undefined;

        if (!primarySentence) return;

        if (unit === 'phrase' && secondaryLang) {
            // Phrase mode: ALWAYS split by commas/semicolons
            const primaryPhrases = splitSentenceIntoPhrases(primarySentence);
            const secondaryPhrases = secondarySentence 
                ? splitSentenceIntoPhrases(secondarySentence) 
                : [];

            primaryPhrases.forEach((phrase, index) => {
                const content: MultilingualContent = { [primaryLang]: phrase };
                if (secondaryLang && secondaryPhrases[index]) {
                    content[secondaryLang] = secondaryPhrases[index];
                }

                segments.push({
                    id: generateLocalUniqueId(),
                    order: segmentOrder++,
                    type: isFirstSegmentOfPara ? 'start_para' : 'text',
                    content
                });

                isFirstSegmentOfPara = false;
            });
        } else {
            // Sentence mode: one segment per sentence
            const content: MultilingualContent = { [primaryLang]: primarySentence };
            if (secondaryLang && secondarySentence !== undefined) {
                content[secondaryLang] = secondarySentence;
            }

            segments.push({
                id: generateLocalUniqueId(),
                order: segmentOrder++,
                type: isFirstSegmentOfPara ? 'start_para' : 'text',
                content
            });

            isFirstSegmentOfPara = false;
        }
    });

    return segments;
}

/**
 * Main parser - processes markdown text into segments.
 */
export function parseMarkdownToSegments(markdown: string, origin: string): Segment[] {
    const lines = markdown.split('\n');
    const segments: Segment[] = [];
    let currentParagraph = '';
    let isNewParagraph = true; // The very first content is always the start of a paragraph

    const flushParagraph = () => {
        const trimmedParagraph = currentParagraph.trim();
        if (trimmedParagraph) {
            const paraSegments = processParagraphIntoSegments(
                trimmedParagraph, 
                origin, 
                isNewParagraph
            );
            
            paraSegments.forEach(seg => {
                seg.order = segments.length;
                segments.push(seg);
            });
        }
        currentParagraph = '';
    };

    for (const line of lines) {
        const trimmedLine = line.trim();

        if (trimmedLine.startsWith('## ')) {
            flushParagraph();
            isNewParagraph = true;
            continue;
        }

        if (!trimmedLine) {
            flushParagraph();
            isNewParagraph = true; // Signal that the next text block starts a new paragraph
            continue;
        }

        // Accumulate lines into current paragraph
        currentParagraph += (currentParagraph ? ' ' : '') + trimmedLine;
    }

    // Flush any remaining paragraph
    flushParagraph();

    return segments;
}

/**
 * Parses book-level markdown with title and chapters.
 */
export function parseBookMarkdown(
    markdown: string,
    origin: string
): { title: MultilingualContent; chapters: Chapter[]; unit: ContentUnit } {
    const parts = origin.split('-');
    const primaryLang = parts[0];
    const secondaryLang = parts.length > 1 ? parts[1] : undefined;
    const format = parts.length > 2 ? parts[2] : undefined;
    const unit: ContentUnit = format === 'ph' ? 'phrase' : 'sentence';
    
    let title: MultilingualContent = { [primaryLang]: 'Untitled' };
    let contentAfterTitle = markdown.trim();

    const lines = markdown.split('\n');
    const firstH1Index = lines.findIndex(line => line.trim().startsWith('# '));

    if (firstH1Index !== -1) {
        const titleLine = lines[firstH1Index].trim().substring(2).trim();
        title = extractBilingualTextPairs(titleLine, primaryLang, secondaryLang)[0] || { [primaryLang]: titleLine };
        contentAfterTitle = lines.slice(firstH1Index + 1).join('\n');
    }

    const chapters: Chapter[] = [];
    const chapterSplitRegex = /^(?=##\s)/m;
    const chapterContents = contentAfterTitle.split(chapterSplitRegex).filter(c => c.trim() !== '');

    const processChapter = (chapterText: string) => {
        const chapterLines = chapterText.trim().split('\n');
        const chapterTitleLine = chapterLines[0] || `Chapter ${chapters.length + 1}`;
        const chapterContent = chapterLines.slice(1).join('\n');
        
        const chapterTitle = extractBilingualTextPairs(chapterTitleLine.replace(/^##\s*/, ''), primaryLang, secondaryLang)[0] || { [primaryLang]: chapterTitleLine };
        const segments = parseMarkdownToSegments(chapterContent, origin);

        if (segments.length > 0) {
            const totalWords = calculateTotalWords(segments, primaryLang);
            chapters.push({
                id: generateLocalUniqueId(),
                order: chapters.length,
                title: chapterTitle,
                segments,
                stats: {
                    totalSegments: segments.length,
                    totalWords,
                },
                metadata: {
                    primaryLanguage: primaryLang
                }
            });
        }
    };
    
    if (chapterContents.length === 0 && contentAfterTitle.trim()) {
        const segments = parseMarkdownToSegments(contentAfterTitle, origin);
        if (segments.length > 0) {
            chapters.push({
                id: generateLocalUniqueId(),
                order: 0,
                title: { [primaryLang]: `Chapter 1` },
                segments,
                stats: { totalSegments: segments.length, totalWords: calculateTotalWords(segments, primaryLang) },
                metadata: { primaryLanguage: primaryLang }
            });
        }
    } else {
        chapterContents.forEach(text => processChapter(text));
    }
    
    return { title, chapters, unit };
}


/**
 * Calculates total word count from segments.
 */
function calculateTotalWords(segments: Segment[], primaryLang: string): number {
    return segments.reduce((sum, seg) => {
        if (seg.type === 'start_para' || seg.type === 'text') {
            const text = seg.content[primaryLang] || '';
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
