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
 */
function splitSentences(text: string): string[] {
    if (!text?.trim()) return [];
    // This regex looks for sentence-ending punctuation (. ! ?) possibly followed by quotes and then whitespace.
    // It uses a positive lookbehind to not consume the delimiter.
    const sentences = text.split(/(?<=[.?!])\s*(?=[A-Z"']|“)/g);
    return sentences.map(s => s.trim()).filter(Boolean);
}

/**
 * Parses markdown into segments. This is the core logic.
 * It handles both monolingual and bilingual text based on the 'origin' string.
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

    if (trimmedLine.startsWith('## ') || trimmedLine.startsWith('### ')) {
        // Treat lower-level headings as regular text for simplicity in pieces
        segments.push({
            id: generateLocalUniqueId(),
            order: order++,
            type: 'text',
            content: { [primaryLang]: cleanText(trimmedLine) },
            formatting: {},
            metadata: { isNewPara }
        });
        isNewPara = false;
        continue;
    }

    if (secondaryLang) {
      const parts = trimmedLine.split(' / ');
      const englishParts = splitSentences(parts[0]);
      const otherParts = parts[1] ? splitSentences(parts[1]) : [];
      
      const maxLength = Math.max(englishParts.length, otherParts.length);
      
      for (let i = 0; i < maxLength; i++) {
        const content: MultilingualContent = {
          [primaryLang]: cleanText(englishParts[i] || ''),
          [secondaryLang]: cleanText(otherParts[i] || '')
        };
        
        segments.push({
          id: generateLocalUniqueId(),
          order: order++,
          type: 'text',
          content,
          formatting: {},
          metadata: { isNewPara: isNewPara && i === 0 }
        });
      }
    } else {
      const sentences = splitSentences(trimmedLine);
      sentences.forEach((sentence, index) => {
        segments.push({
          id: generateLocalUniqueId(),
          order: order++,
          type: 'text',
          content: { [primaryLang]: cleanText(sentence) },
          formatting: {},
          metadata: { isNewPara: isNewPara && index === 0 }
        });
      });
    }

    if (segments.length > 0) {
      isNewPara = false;
    }
  }
  
  return segments;
}

/**
 * Parses a simple bilingual text for titles/headings.
 */
function parseBilingualText(
  text: string,
  primaryLang: string,
  secondaryLang?: string
): MultilingualContent {
  const cleaned = cleanText(text);
  if (!secondaryLang) {
    return { [primaryLang]: cleaned };
  }
  
  const parts = cleaned.split(' / ');
  return {
    [primaryLang]: parts[0]?.trim() || '',
    [secondaryLang]: parts[1]?.trim() || ''
  };
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
