// src/services/MarkdownParser.ts - FINAL, ROBUST VERSION

import type { Segment, Chapter, Book, Piece, MultilingualContent } from '@/lib/types';
import { generateLocalUniqueId } from '@/lib/utils';

/**
 * Removes footnote annotations like [1], [23] and trims whitespace.
 * @param text The text to clean.
 * @returns The cleaned text.
 */
function cleanText(text: string): string {
  if (!text) return '';
  return text.replace(/\[\d+\]/g, '').trim();
}

/**
 * Parses bilingual text that follows the `English part {Vietnamese part}` format.
 * This is a robust function designed to handle various edge cases.
 * @param line The single line of text to parse.
 * @param primaryLang The language code for the main text.
 * @param secondaryLang The language code for the text within braces.
 * @returns A MultilingualContent object.
 */
function parseBilingualText(text: string, primaryLang: string, secondaryLang?: string): MultilingualContent {
    const cleanedText = cleanText(text);
    
    if (secondaryLang && cleanedText.includes('{') && cleanedText.includes('}')) {
        const match = cleanedText.match(/(.*)\s*\{(.*)\}/);
        if (match) {
            return {
                [primaryLang]: match[1].trim(),
                [secondaryLang]: match[2].trim()
            };
        }
    }
    
    // Fallback for monolingual or malformed bilingual text
    return { [primaryLang]: cleanedText };
}


/**
 * Main parser function that processes markdown text line by line.
 * It determines if a line is monolingual or bilingual and creates segments accordingly.
 * It also handles paragraph detection based on empty lines.
 */
export function parseMarkdownToSegments(
  markdown: string,
  origin: string
): Segment[] {
  const [primaryLang, secondaryLang] = origin.split('-');
  const lines = markdown.split('\n');
  const segments: Segment[] = [];
  let order = 0;
  let isNewParaNext = true; // The very first segment is always a new paragraph.

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip empty lines and chapter headings, but use empty lines to mark paragraphs.
    if (!trimmedLine) {
      isNewParaNext = true;
      continue;
    }
    if (trimmedLine.startsWith('##')) {
        continue;
    }

    const content = parseBilingualText(trimmedLine, primaryLang, secondaryLang);
    
    // Only create a segment if there's actual content.
    if (Object.values(content).some(text => text.length > 0)) {
        segments.push({
            id: generateLocalUniqueId(),
            order: order++,
            type: 'text',
            content: content,
            formatting: {},
            metadata: { isNewPara: isNewParaNext }
        });
        isNewParaNext = false; // Reset after creating a segment.
    }
  }

  return segments;
}


/**
 * Parses book markdown with title (# H1) and chapters (## H2).
 * This is the main entry point for parsing full book content.
 */
export function parseBookMarkdown(
  markdown: string,
  origin: string
): { title: MultilingualContent; chapters: Chapter[] } {
  const [primaryLang, secondaryLang] = origin.split('-');
  const lines = markdown.split('\n');
  
  let title: MultilingualContent = { [primaryLang]: 'Untitled' };
  let contentStartIndex = 0;

  // Find and extract the book title (# H1)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('# ')) {
      title = parseBilingualText(line.substring(2), primaryLang, secondaryLang);
      contentStartIndex = i + 1;
      break;
    }
  }

  const chapterStarts: Array<{ index: number; title: string }> = [];
  
  // Find all chapter headings (## H2)
  for (let i = contentStartIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('## ')) {
      chapterStarts.push({
        index: i,
        title: line.substring(3)
      });
    }
  }

  const chapters: Chapter[] = [];
  
  // Case 1: No chapter headings found, treat all content as a single chapter
  if (chapterStarts.length === 0) {
    const content = lines.slice(contentStartIndex).join('\n');
    const segments = parseMarkdownToSegments(content, origin);
    if (segments.length > 0) {
        const totalWords = segments.reduce((sum, seg) => sum + (seg.content[primaryLang]?.split(/\s+/).length || 0), 0);
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
    // Case 2: Chapter headings found, parse content for each chapter
    chapterStarts.forEach((start, idx) => {
      const nextStart = chapterStarts[idx + 1]?.index || lines.length;
      const chapterContent = lines.slice(start.index + 1, nextStart).join('\n');
      
      const chapterTitle = parseBilingualText(start.title, primaryLang, secondaryLang);
      const segments = parseMarkdownToSegments(chapterContent, origin);
      const totalWords = segments.reduce((sum, seg) => sum + (seg.content[primaryLang]?.split(/\s+/).length || 0), 0);

      chapters.push({
        id: generateLocalUniqueId(),
        order: idx,
        title: chapterTitle,
        segments,
        stats: { totalSegments: segments.length, totalWords, estimatedReadingTime: Math.ceil(totalWords / 200) },
        metadata: {}
      });
    });
  }

  return { title, chapters };
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
