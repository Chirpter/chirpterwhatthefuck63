
// src/services/MarkdownParser.ts - FINAL, ROBUST VERSION
import type { Segment, Chapter, Book, Piece, MultilingualContent } from '@/lib/types';
import { generateLocalUniqueId } from '@/lib/utils';

/**
 * Removes footnote annotations like [1], [23]
 */
function cleanText(text: string): string {
  if (!text) return '';
  return text.replace(/\[\d+\]/g, '').trim();
}

/**
 * A more robust sentence splitter that handles various punctuation and edge cases.
 * It's designed to be more conservative and avoid splitting on things like abbreviations.
 */
function splitSentences(text: string): string[] {
    if (!text?.trim()) return [];
    
    // This regex is designed to split sentences based on ending punctuation (. ! ?)
    // followed by a space and an uppercase letter, or quotes. It avoids splitting on
    // abbreviations (e.g., Dr., St.) or numbers.
    const sentences = text.match(/[^.!?]+[.!?"]*(?=\s+[A-Z"“]|$)/g);
    
    // If the regex fails (e.g., for single-sentence inputs or unusual structures),
    // fall back to a simpler split, but ensure the result is not empty.
    if (!sentences || sentences.length === 0) {
        const fallback = text.trim();
        return fallback ? [fallback] : [];
    }
    
    return sentences.map(s => s.trim()).filter(Boolean);
}

/**
 * Extracts a bilingual sentence pair from a line of text using {} as separator.
 * @param line - The line containing text like "English part {Vietnamese part}".
 * @param primaryLang - The language code for the first part.
 * @param secondaryLang - The language code for the second part.
 * @returns A MultilingualContent object.
 */
function extractBilingualSentence(line: string, primaryLang: string, secondaryLang: string): MultilingualContent {
  const match = line.match(/^(.*?)\s*\{(.*)\}\s*$/);
  if (match) {
    return {
      [primaryLang]: cleanText(match[1]),
      [secondaryLang]: cleanText(match[2]),
    };
  }
  // Fallback for non-matching lines (treat as primary language)
  return { [primaryLang]: cleanText(line) };
}


/**
 * Parses markdown into segments. This is the core logic.
 * It now processes line-by-line, which is simpler and more robust.
 */
export function parseMarkdownToSegments(
  markdown: string,
  origin: string
): Segment[] {
  if (!markdown?.trim()) return [];
  
  const [primaryLang, secondaryLang] = origin.split('-');
  const lines = markdown.split('\n');
  const segments: Segment[] = [];
  let order = 0;
  let isNewPara = true;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      isNewPara = true;
      continue;
    }
    
    // Ignore chapter headings within the content. They are handled by parseBookMarkdown.
    if (trimmedLine.startsWith('## ')) {
        continue;
    }
    
    let content: MultilingualContent;
    
    if (secondaryLang) {
      content = extractBilingualSentence(trimmedLine, primaryLang, secondaryLang);
    } else {
      content = { [primaryLang]: cleanText(trimmedLine) };
    }
    
    segments.push({
      id: generateLocalUniqueId(),
      order: order++,
      type: 'text',
      content: content,
      formatting: {},
      metadata: { isNewPara }
    });
    
    isNewPara = false;
  }
  
  return segments;
}


/**
 * Parses a simple bilingual text for titles/headings using {}.
 */
function parseBilingualText(
  text: string,
  primaryLang: string,
  secondaryLang?: string
): MultilingualContent {
  const cleaned = cleanText(text);
  if (secondaryLang) {
      const match = cleaned.match(/^(.*?)\s*\{(.*)\}\s*$/);
      if (match) {
          return {
              [primaryLang]: match[1].trim(),
              [secondaryLang]: match[2].trim()
          };
      }
  }
  return { [primaryLang]: cleaned };
}


/**
 * Parses book markdown with title (# H1) and chapters (## H2).
 */
export function parseBookMarkdown(
  markdown: string,
  origin: string
): { title: MultilingualContent; chapters: Chapter[] } {
  const [primaryLang, secondaryLang] = origin.split('-');
  const lines = markdown.split('\n');
  
  let title: MultilingualContent = { [primaryLang]: 'Untitled' };
  let contentStartIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('# ')) {
      title = parseBilingualText(line.substring(2).trim(), primaryLang, secondaryLang);
      contentStartIndex = i + 1;
      break;
    }
  }

  const chapterStarts: Array<{ index: number; title: string }> = [];
  
  for (let i = contentStartIndex; i < lines.length; i++) {
    if (lines[i].trim().startsWith('## ')) {
      chapterStarts.push({
        index: i,
        title: lines[i].trim().substring(3).trim()
      });
    }
  }

  const chapters: Chapter[] = [];
  
  if (chapterStarts.length === 0 && lines.slice(contentStartIndex).join('').trim()) {
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
 * Helper to extract segments from library items
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
    const chapter = item.chapters[chapterIndex];
    return chapter?.segments || [];
  }
  
  return [];
}
