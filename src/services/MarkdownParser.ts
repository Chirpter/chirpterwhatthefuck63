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
 * Parses a line of text, which may contain bilingual pairs, into a MultilingualContent object.
 * @param line - The raw line of text.
 * @param unit - The content unit ('sentence' or 'phrase').
 * @param primaryLang - The primary language code.
 * @param secondaryLang - The secondary language code (if bilingual).
 * @returns A MultilingualContent object.
 */
function parseLineToMultilingualContent(line: string, unit: ContentUnit, primaryLang: string, secondaryLang?: string): MultilingualContent {
    const cleanedLine = line.trim();
    if (!cleanedLine) return {};

    if (!secondaryLang) {
        // Monolingual: one phrase map for the whole line
        return { [primaryLang]: cleanText(cleanedLine) };
    }

    if (unit === 'phrase') {
        // Bilingual phrase mode: "primary {secondary}|primary {secondary}"
        // We join them with a separator for storage. UI will split them.
        const pairs = cleanedLine.split('|').map(pair => {
            const match = pair.match(/([^{}]+)\{([^{}]*)\}/);
            if (match) {
                return {
                    primary: cleanText(match[1]),
                    secondary: cleanText(match[2]),
                };
            }
            return null;
        }).filter(Boolean);
        
        return {
            [primaryLang]: pairs.map(p => p!.primary).join(' | '),
            [secondaryLang]: pairs.map(p => p!.secondary).join(' | '),
        };
    }

    // Bilingual sentence mode: "primary sentence. {secondary sentence.}"
    const match = cleanedLine.match(/^(.*?)\s*\{(.*)\}\s*$/);
    if (match) {
        return {
            [primaryLang]: cleanText(match[1]),
            [secondaryLang]: cleanText(match[2]),
        };
    }
    
    // Fallback for lines that might not have a translation
    return { [primaryLang]: cleanedLine };
}


/**
 * Main parser - processes text line-by-line and creates segments.
 */
export function parseMarkdownToSegments(markdown: string, origin: string): Segment[] {
  const [primaryLang, secondaryLang, formatFlag] = origin.split('-');
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
    
    // For phrase mode, we process the whole paragraph as one segment's content
    if (unit === 'phrase') {
        const content = parseLineToMultilingualContent(trimmedLine, unit, primaryLang, secondaryLang);
        if (Object.keys(content).length > 0) {
             segments.push({
                id: generateLocalUniqueId(),
                order: segments.length,
                type: 'text',
                content: content,
                formatting: {},
                metadata: {
                    isNewPara: isNewParaNext,
                }
            });
            isNewParaNext = false;
        }
        continue;
    }

    // For sentence mode, split by sentence-ending punctuation
    const sentences = trimmedLine.match(/[^.!?]+[.!?]\s*/g) || [trimmedLine];

    for (const sentence of sentences) {
        const content = parseLineToMultilingualContent(sentence, unit, primaryLang, secondaryLang);
        if (Object.keys(content).length > 0) {
            segments.push({
                id: generateLocalUniqueId(),
                order: segments.length,
                type: 'text',
                content: content,
                formatting: {},
                metadata: {
                    isNewPara: isNewParaNext,
                }
            });
            isNewParaNext = false; // Only the very first segment of the paragraph is new
        }
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
        const text = seg.content[primaryLang] || '';
        return sum + (text.split(/\s+/).filter(Boolean).length || 0);
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