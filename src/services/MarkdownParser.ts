// src/services/MarkdownParser.ts - OPTIMIZED LOGIC

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
 * Parses a line of text into a MultilingualContent object.
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
        return { [primaryLang]: cleanText(cleanedLine) };
    }

    if (unit === 'phrase') {
        const parts = cleanedLine.split('|').map(part => {
            const match = part.match(/([^{}]+)\{([^{}]*)\}/);
            return match ? { primary: cleanText(match[1]), secondary: cleanText(match[2]) } : null;
        }).filter(Boolean);
        
        return {
            [primaryLang]: parts.map(p => p!.primary).join(' | '),
            [secondaryLang]: parts.map(p => p!.secondary).join(' | '),
        };
    }

    const match = cleanedLine.match(/^(.*?)\s*\{(.*)\}\s*$/);
    if (match) {
        return {
            [primaryLang]: cleanText(match[1]),
            [secondaryLang]: cleanText(match[2]),
        };
    }
    
    return { [primaryLang]: cleanedLine };
}


/**
 * Main parser - processes text line-by-line and creates segments.
 * This version uses the stateless, optimized logic.
 */
export function parseMarkdownToSegments(markdown: string, origin: string): Segment[] {
  const [primaryLang, secondaryLang, format] = origin.split('-');
  const unit: ContentUnit = format === 'ph' ? 'phrase' : 'sentence';

  const lines = markdown.split('\n');
  const segments: Segment[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith('#')) {
      continue;
    }
    
    if (!trimmedLine) {
        continue;
    }
    
    const sentences = trimmedLine.match(/[^.!?]+[.!?]\s*/g) || [trimmedLine];
    
    // Check if the PREVIOUS line was empty to determine if this is a new paragraph.
    const isFirstSegmentInLineNewPara = (i === 0) || (lines[i - 1].trim() === '');
    
    for (let j = 0; j < sentences.length; j++) {
        const sentence = sentences[j];
        const content = parseLineToMultilingualContent(sentence, unit, primaryLang, secondaryLang);
        
        if (Object.keys(content).length > 0) {
            // The very first sentence of a line that follows a blank line is a new paragraph.
            // Subsequent sentences on the same line are not.
            const isNewPara = (j === 0) && isFirstSegmentInLineNewPara;

            segments.push({
                id: generateLocalUniqueId(),
                order: segments.length,
                type: 'text',
                content: content,
                metadata: {
                    isNewPara,
                }
            });
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
): { title: MultilingualContent; chapters: Chapter[]; unit: ContentUnit } {
  const [primaryLang, secondaryLang] = origin.split('-');
  const unit: ContentUnit = origin.endsWith('-ph') ? 'phrase' : 'sentence';
  const lines = markdown.split('\n');
  
  let title: MultilingualContent = { [primaryLang]: 'Untitled' };
  let contentStartIndex = 0;
  
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
  
  const processChapterContent = (content: string, order: number, defaultTitle: string) => {
      const segments = parseMarkdownToSegments(content, origin);
      if (segments.length === 0) return;
      
      const totalWords = calculateTotalWords(segments, primaryLang);
      chapters.push({
          id: generateLocalUniqueId(),
          order: order,
          title: { [primaryLang]: defaultTitle },
          segments,
          stats: { totalSegments: segments.length, totalWords, estimatedReadingTime: Math.ceil(totalWords / 200) },
          metadata: {}
      });
  };

  if (chapterParts.length <= 1) {
    if (contentAfterTitle.trim()) {
      processChapterContent(contentAfterTitle, 0, 'Chapter 1');
    }
  } else {
    if (chapterParts[0].trim()) {
        processChapterContent(chapterParts[0], 0, 'Introduction');
    }

    chapterParts.slice(1).forEach((part, index) => {
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

  return { title, chapters, unit };
}


function calculateTotalWords(segments: Segment[], primaryLang: string): number {
    return segments.reduce((sum, seg) => {
        const text = seg.content[primaryLang]?.split(' | ').join(' ') || '';
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
    return (item as Piece).generatedContent || [];
  }
  
  if (item.type === 'book') {
    const book = item as Book;
    if (book.chapters && book.chapters.length > chapterIndex) {
      return book.chapters[chapterIndex].segments || [];
    }
  }
  
  return [];
}
