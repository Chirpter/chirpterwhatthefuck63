// src/services/MarkdownParser.ts - FINALIZED VERSION

import type { Segment, Chapter, Book, Piece, MultilingualContent, PhraseMap, ContentUnit } from '@/lib/types';
import { generateLocalUniqueId } from '@/lib/utils';

/**
 * Removes footnote annotations like [1], [23] and trims whitespace.
 */
function cleanText(text: string): string {
  if (!text) return '';
  return text.replace(/\[\d+\]/g, '').trim();
}

/**
 * Parses a line of text, which may contain bilingual pairs, into a PhraseMap array.
 * @param line - The raw line of text.
 * @param primaryLang - The primary language code.
 * @param secondaryLang - The secondary language code (if bilingual).
 * @returns An array of PhraseMap objects. For sentence mode, this will be a single-element array.
 */
function parseLineToPhraseMaps(line: string, primaryLang: string, secondaryLang?: string): PhraseMap[] {
    const cleanedLine = line.trim();
    if (!cleanedLine) return [];

    if (!secondaryLang) {
        // Monolingual: one phrase map for the whole line
        return [{ [primaryLang]: cleanText(cleanedLine) }];
    }

    // Bilingual: parse using the {translation} syntax
    const bilingualRegex = /([^{}]+)\{([^{}]*)\}/g;
    let match;
    const phrases: PhraseMap[] = [];
    let lastIndex = 0;

    while ((match = bilingualRegex.exec(cleanedLine)) !== null) {
        // Capture any text between the last match and this one
        const precedingText = cleanedLine.substring(lastIndex, match.index).trim();
        if (precedingText) {
            phrases.push({ [primaryLang]: cleanText(precedingText) });
        }

        const primary = cleanText(match[1]);
        const secondary = cleanText(match[2]);
        if (primary || secondary) {
            phrases.push({
                [primaryLang]: primary,
                [secondaryLang]: secondary,
            });
        }
        lastIndex = match.index + match[0].length;
    }

    // Capture any remaining text at the end of the line
    const remainingText = cleanedLine.substring(lastIndex).trim();
    if (remainingText) {
        phrases.push({ [primaryLang]: cleanText(remainingText) });
    }

    return phrases;
}


/**
 * Main parser - processes text line-by-line and creates segments.
 */
export function parseMarkdownToSegments(markdown: string, origin: string): Segment[] {
  const [primaryLang, secondaryLang, formatFlag] = origin.split('-');
  const isBilingual = !!secondaryLang;
  const unit: ContentUnit = formatFlag === 'ph' ? 'phrase' : 'sentence';

  const lines = markdown.split('\n');
  const segments: Segment[] = [];
  let isNewParaNext = true;

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (trimmedLine.startsWith('#')) {
        continue; // Skip all headings in segment parsing
    }

    if (!trimmedLine) {
      isNewParaNext = true;
      continue;
    }
    
    const contentPhraseMaps = parseLineToPhraseMaps(trimmedLine, primaryLang, secondaryLang);

    if (contentPhraseMaps.length > 0) {
        if (unit === 'sentence') {
            // For sentence mode, each phrase map becomes its own segment
            contentPhraseMaps.forEach((phraseMap, index) => {
                segments.push({
                    id: generateLocalUniqueId(),
                    order: segments.length,
                    type: 'text',
                    content: [phraseMap], // Always an array, with one element for sentence mode
                    formatting: {},
                    metadata: {
                        isNewPara: isNewParaNext && index === 0,
                        unit: 'sentence',
                    }
                });
            });
        } else { // Phrase mode
            segments.push({
                id: generateLocalUniqueId(),
                order: segments.length,
                type: 'text',
                content: contentPhraseMaps, // Array can have multiple elements
                formatting: {},
                metadata: {
                    isNewPara: isNewParaNext,
                    unit: 'phrase',
                }
            });
        }
        isNewParaNext = false;
    }
  }

  return segments;
}


/**
 * Parses book-level markdown with title and chapters.
 */
export function parseBookMarkdown(
  markdown: string,
  origin: string
): { title: MultilingualContent; chapters: Chapter[] } {
  const [primaryLang, secondaryLang] = origin.split('-');
  const lines = markdown.split('\n');
  
  let title: MultilingualContent = { [primaryLang]: 'Untitled' };
  let contentStartIndex = 0;
  
  // Find the first H1 to use as the book title
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('# ')) {
      const titleText = line.substring(2).trim();
      title = parseBilingualTitle(titleText, primaryLang, secondaryLang);
      contentStartIndex = i + 1;
      break;
    }
  }
  
  const contentAfterTitle = lines.slice(contentStartIndex).join('\n');
  const chapterParts = contentAfterTitle.split(/\n## /);

  const chapters: Chapter[] = [];
  
  if (chapterParts.length <= 1) {
    // No '##' found, treat all content as a single chapter
    const segments = parseMarkdownToSegments(contentAfterTitle, origin);
    if (segments.length > 0) {
      const totalWords = calculateTotalWords(segments, primaryLang);
      chapters.push({
        id: generateLocalUniqueId(),
        order: 0,
        title: { [primaryLang]: 'Chapter 1' },
        segments,
        stats: { totalSegments: segments.length, totalWords, estimatedReadingTime: Math.ceil(totalWords / 200) },
        metadata: {}
      });
    }
  } else {
    // If there's content before the first '##', make it an introduction
    if (chapterParts[0].trim()) {
        const segments = parseMarkdownToSegments(chapterParts[0], origin);
        const totalWords = calculateTotalWords(segments, primaryLang);
         chapters.push({
            id: generateLocalUniqueId(),
            order: 0,
            title: { [primaryLang]: 'Introduction' },
            segments,
            stats: { totalSegments: segments.length, totalWords, estimatedReadingTime: Math.ceil(totalWords / 200) },
            metadata: {}
        });
    }

    // Process each part that started with '##'
    chapterParts.slice(1).forEach((part) => {
      const partLines = part.split('\n');
      const chapterTitleLine = partLines[0].trim();
      const chapterContent = partLines.slice(1).join('\n');
      
      const chapterTitle = parseBilingualTitle(chapterTitleLine, primaryLang, secondaryLang);
      const segments = parseMarkdownToSegments(chapterContent, origin);
      const totalWords = calculateTotalWords(segments, primaryLang);

      chapters.push({
        id: generateLocalUniqueId(),
        order: chapters.length,
        title: chapterTitle,
        segments,
        stats: { totalSegments: segments.length, totalWords, estimatedReadingTime: Math.ceil(totalWords / 200) },
        metadata: {}
      });
    });
  }

  return { title, chapters };
}


function calculateTotalWords(segments: Segment[], primaryLang: string): number {
    return segments.reduce((sum, seg) => {
        const phraseSum = seg.content.reduce((phraseTotal, phrase) => {
            return phraseTotal + (phrase[primaryLang]?.split(/\s+/).filter(Boolean).length || 0);
        }, 0);
        return sum + phraseSum;
    }, 0);
}

function parseBilingualTitle(text: string, primaryLang: string, secondaryLang?: string): MultilingualContent {
    if (secondaryLang) {
        const match = text.match(/^(.*?)\s*\{(.*)\}\s*$/);
        if (match) {
            return {
                [primaryLang]: cleanText(match[1]),
                [secondaryLang]: cleanText(match[2]),
            };
        }
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
    return item.generatedContent || [];
  }
  
  if (item.type === 'book') {
    const chapter = (item.chapters || [])[chapterIndex];
    return chapter?.segments || [];
  }
  
  return [];
}
