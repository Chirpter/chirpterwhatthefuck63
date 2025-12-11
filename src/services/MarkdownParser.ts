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
 * A robust sentence splitter for monolingual text.
 * Handles abbreviations, quotes, and different sentence endings.
 * @param text The block of text to parse.
 * @returns An array of sentences.
 */
function splitIntoSentences(text: string): string[] {
    if (!text) return [];
    // This regex is more advanced. It splits on sentence-ending punctuation
    // ONLY IF it's followed by a space and an uppercase letter, or a newline.
    // It specifically avoids splitting on abbreviations like Mr., Mrs., Dr., St. etc.
    const sentenceRegex = /(?<!\b(?:[A-Z][a-z]{1,2})\.)(?<=[.?!])\s+(?=[A-Z"']|[\r\n]|$)/g;
    return text.split(sentenceRegex).filter(s => s && s.trim().length > 0);
}


/**
 * Parses monolingual text into sentence-based segments.
 * @param text The block of text to parse.
 * @param primaryLang The language code for the content.
 * @returns An array of Segments.
 */
function parseMonolingualContent(text: string, primaryLang: string): Segment[] {
  if (!text.trim()) return [];
  
  const sentences = splitIntoSentences(text);
  let order = 0;

  return sentences.map(sentence => {
    const cleanedSentence = cleanText(sentence);
    if (!cleanedSentence) return null;

    return {
      id: generateLocalUniqueId(),
      order: order++,
      type: 'text',
      content: { [primaryLang]: cleanedSentence },
      formatting: {},
      metadata: { isNewPara: false } // isNewPara will be determined later
    };
  }).filter((s): s is Segment => s !== null);
}

/**
 * Parses bilingual text that follows the `English part {Vietnamese part}` format.
 * This version can also handle monolingual sentences mixed in.
 * @param text The block of text to parse.
 * @param primaryLang The language code for the main text.
 * @param secondaryLang The language code for the text within braces.
 * @returns An array of Segments.
 */
function parseBilingualContent(text: string, primaryLang: string, secondaryLang: string): Segment[] {
    if (!text.trim()) return [];
    
    // Regex to find all pairs of 'English {Vietnamese}' OR standalone sentences.
    const bilingualPairRegex = /(.*?)\s*\{(.*?)\}/g;
    const segments: Segment[] = [];
    let lastIndex = 0;
    let order = 0;

    // Use matchAll to get all matches with their indices
    const matches = Array.from(text.matchAll(bilingualPairRegex));

    matches.forEach(match => {
        const [fullMatch, primaryPart, secondaryPart] = match;
        const matchIndex = match.index!;

        // Handle any text between the last match and this one as monolingual
        if (matchIndex > lastIndex) {
            const precedingText = text.substring(lastIndex, matchIndex);
            // Parse the monolingual part into sentences
            const monoSegments = parseMonolingualContent(precedingText, primaryLang);
            monoSegments.forEach(seg => {
                segments.push({ ...seg, order: order++ });
            });
        }

        // Create the bilingual segment
        segments.push({
            id: generateLocalUniqueId(),
            order: order++,
            type: 'text',
            content: {
                [primaryLang]: cleanText(primaryPart),
                [secondaryLang]: cleanText(secondaryPart)
            },
            formatting: {},
            metadata: { isNewPara: false }
        });

        lastIndex = matchIndex + fullMatch.length;
    });

    // Handle any remaining text after the last match
    if (lastIndex < text.length) {
        const remainingText = text.substring(lastIndex);
        const monoSegments = parseMonolingualContent(remainingText, primaryLang);
        monoSegments.forEach(seg => {
            segments.push({ ...seg, order: order++ });
        });
    }
    
    return segments;
}


/**
 * Main parser function that delegates to the appropriate content parser.
 * It also handles paragraph detection after segments have been created.
 */
export function parseMarkdownToSegments(
  markdown: string,
  origin: string
): Segment[] {
  const [primaryLang, secondaryLang] = origin.split('-');
  
  // Clean the input markdown first
  const contentToParse = markdown
    .split('\n')
    .filter(line => !line.trim().startsWith('##')) // Skip chapter headings
    .join('\n');

  let segments: Segment[];

  if (secondaryLang && secondaryLang !== 'ph') {
    segments = parseBilingualContent(contentToParse, primaryLang, secondaryLang);
  } else {
    segments = parseMonolingualContent(contentToParse, primaryLang);
  }

  // Final pass to set paragraph metadata based on original line breaks
  const lines = contentToParse.split('\n');
  let currentSegmentIndex = 0;
  let isAfterBlankLine = true; // The very first segment is always a new paragraph

  for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine === '') {
          isAfterBlankLine = true;
          continue;
      }
      
      if (currentSegmentIndex < segments.length && isAfterBlankLine) {
          // Find the first segment that starts with content from this line
          let found = false;
          for (let i = currentSegmentIndex; i < segments.length; i++) {
              const segText = segments[i].content[primaryLang] || segments[i].content[secondaryLang || ''] || '';
              if (trimmedLine.includes(segText.substring(0, 20))) { // Check if the line contains the start of the segment
                  segments[i].metadata.isNewPara = true;
                  currentSegmentIndex = i + 1;
                  found = true;
                  break;
              }
          }
      }
      isAfterBlankLine = false;
  }
  
  if (segments.length > 0) {
      segments[0].metadata.isNewPara = true;
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
  if (secondaryLang && secondaryLang !== 'ph') {
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

  // Find the book title (first H1)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('# ')) {
      title = parseBilingualText(line.substring(2), primaryLang, secondaryLang);
      contentStartIndex = i + 1;
      break;
    }
  }

  // Find all chapter start indices
  const chapterStarts: Array<{ index: number; title: string }> = [];
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
  
  if (chapterStarts.length === 0) {
    // No '##' found, treat all content as a single chapter
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
    // Process content for each chapter
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
