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
 * Splits a single sentence into phrases based on commas and semicolons.
 */
function splitSentenceIntoPhrases(sentence: string): string[] {
    if (!sentence) return [];
    const parts = sentence.match(/[^,;]+[,;]?/g) || [];
    return parts.map(p => p.trim()).filter(p => p.length > 0);
}

/**
 * Extracts bilingual text pairs from a line using a simpler, more robust state-machine-like approach.
 * Format: "English part. {Vietnamese part.} More English."
 * This function correctly handles cases without spaces after the closing brace.
 * @param line The string line to parse.
 * @param primaryLang The code for the primary language.
 * @param secondaryLang The code for the secondary language.
 * @returns An array of MultilingualContent objects, each representing a segment.
 */
function extractBilingualTextPairs(line: string, primaryLang: string, secondaryLang?: string): Array<MultilingualContent> {
    const pairs: Array<MultilingualContent> = [];
    if (!secondaryLang) {
        if (line.trim()) {
            pairs.push({ [primaryLang]: line.trim() });
        }
        return pairs;
    }

    let currentIndex = 0;
    while (currentIndex < line.length) {
        const openBraceIndex = line.indexOf('{', currentIndex);

        // Case 1: No more opening braces, the rest of the line is primary text.
        if (openBraceIndex === -1) {
            const primaryText = line.substring(currentIndex).trim();
            if (primaryText) {
                pairs.push({ [primaryLang]: primaryText });
            }
            break;
        }

        const closeBraceIndex = line.indexOf('}', openBraceIndex);

        // Case 2: Malformed (open brace but no close), treat the rest as primary.
        if (closeBraceIndex === -1) {
            const primaryText = line.substring(currentIndex).trim();
            if (primaryText) {
                pairs.push({ [primaryLang]: primaryText });
            }
            break;
        }

        // Case 3: Found a valid { ... } pair.
        const primaryText = line.substring(currentIndex, openBraceIndex).trim();
        const secondaryText = line.substring(openBraceIndex + 1, closeBraceIndex).trim();

        if (primaryText) {
            pairs.push({ [primaryLang]: primaryText, [secondaryLang]: secondaryText });
        }

        currentIndex = closeBraceIndex + 1;
    }

    return pairs;
}


/**
 * Main parser - processes text line-by-line and creates segments.
 * Now uses a `paragraph_break` segment type instead of metadata flags.
 */
export function parseMarkdownToSegments(markdown: string, origin: string): Segment[] {
    const [primaryLang, secondaryLang, format] = origin.split('-');
    const unit: ContentUnit = format === 'ph' ? 'phrase' : 'sentence';

    const lines = markdown.split('\n');
    const segments: Segment[] = [];
    let segmentOrder = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();

        const isNewPara = (segments.length === 0 && trimmedLine !== '') || 
                          (lines[i - 1]?.trim() === '' && trimmedLine !== '');

        if (!trimmedLine || trimmedLine.startsWith('## ')) {
            continue;
        }

        if (isNewPara && segments.length > 0) {
            segments.push({
                id: generateLocalUniqueId(),
                order: segmentOrder++,
                type: 'paragraph_break',
                content: { [primaryLang]: '' }
            });
        }

        const textPairs = extractBilingualTextPairs(trimmedLine, primaryLang, secondaryLang);

        textPairs.forEach((pair) => {
            const primarySentence = cleanText(pair[primaryLang]);
            const secondarySentence = secondaryLang ? cleanText(pair[secondaryLang] || '') : undefined;

            if (!primarySentence) return;
            
            if (unit === 'phrase' && secondaryLang) {
                const primaryPhrases = splitSentenceIntoPhrases(primarySentence);
                const secondaryPhrases = secondarySentence ? splitSentenceIntoPhrases(secondarySentence) : [];
                
                primaryPhrases.forEach((phrase, j) => {
                    segments.push({
                        id: generateLocalUniqueId(),
                        order: segmentOrder++,
                        type: 'text',
                        content: {
                            [primaryLang]: phrase,
                            [secondaryLang]: secondaryPhrases[j] || '',
                        }
                    });
                });
            } else {
                const content: MultilingualContent = { [primaryLang]: primarySentence };
                if (secondaryLang) {
                    content[secondaryLang] = secondarySentence || '';
                }

                segments.push({
                    id: generateLocalUniqueId(),
                    order: segmentOrder++,
                    type: 'text',
                    content
                });
            }
        });
    }

    return segments;
}

/**
 * Parses book-level markdown with title and chapters.
 */
export function parseBookMarkdown(
  markdown: string,
  origin: string
): { title: MultilingualContent; chapters: Chapter[]; unit: ContentUnit } {
    const [primaryLang, secondaryLang, format] = origin.split('-');
    const unit: ContentUnit = format === 'ph' ? 'phrase' : 'sentence';
    const lines = markdown.split('\n');
    
    let title: MultilingualContent = { [primaryLang]: 'Untitled' };
    let contentAfterTitle = markdown;
    
    const firstH1Index = lines.findIndex(line => line.trim().startsWith('# '));
    if (firstH1Index !== -1) {
        const titleLine = lines[firstH1Index].trim().substring(2).trim();
        title = parseBilingualTitle(titleLine, primaryLang, secondaryLang);
        contentAfterTitle = lines.slice(firstH1Index + 1).join('\n');
    }
    
    const chapterSplitRegex = /^## /m;
    const chapterContents = contentAfterTitle.split(chapterSplitRegex).filter(c => c.trim() !== '');
    const chapters: Chapter[] = [];

    const processChapter = (chapterText: string) => {
        const chapterLines = chapterText.trim().split('\n');
        const chapterTitleLine = chapterLines[0] || `Chapter ${chapters.length + 1}`;
        const chapterContent = chapterLines.slice(1).join('\n');
        
        const chapterTitle = parseBilingualTitle(chapterTitleLine, primaryLang, secondaryLang);
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
                metadata: {}
            });
        }
    };
    
    if (chapterContents.length === 0 && contentAfterTitle.trim()) {
        processChapter(contentAfterTitle);
        if(chapters[0]) chapters[0].title = { [primaryLang]: 'Chapter 1' };
    } else {
        chapterContents.forEach(processChapter);
    }

    return { title, chapters, unit };
}

function calculateTotalWords(segments: Segment[], primaryLang: string): number {
    return segments.reduce((sum, seg) => {
        const text = seg.content[primaryLang] || '';
        return sum + (text.split(/\s+/).filter(Boolean).length || 0);
    }, 0);
}

function parseBilingualTitle(text: string, primaryLang: string, secondaryLang?: string): MultilingualContent {
    const pairs = extractBilingualTextPairs(text, primaryLang, secondaryLang);
    if (pairs.length > 0) {
        return pairs[0];
    }
    return { [primaryLang]: cleanText(text) };
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
