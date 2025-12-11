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
 * Parses monolingual text into sentence-based segments.
 * Uses a regex that splits based on sentence-ending punctuation,
 * while trying to avoid splitting on common abbreviations or numbers.
 * @param text The block of text to parse.
 * @param primaryLang The language code for the content.
 * @returns An array of Segments.
 */
function parseMonolingualContent(text: string, primaryLang: string): Segment[] {
  if (!text.trim()) return [];

  // Regex to split sentences. It looks for punctuation followed by a space and an uppercase letter, or end of string.
  // It avoids splitting on "Mr.", "Mrs.", "Dr.", "St." and numbers like "3.14".
  const sentenceRegex = /(?<!\b(?:Mr|Mrs|Ms|Dr|St)\.)(?<=[.?!])\s+(?=[A-Z"])|(?<=[.?!])(?=[\r\n]|$)/g;
  const sentences = text.split(sentenceRegex).filter(s => s && s.trim());

  let order = 0;
  let isNewPara = true;

  const segments = sentences.map(sentence => {
    const cleanedSentence = cleanText(sentence);
    if (!cleanedSentence) return null;

    const segment: Segment = {
      id: generateLocalUniqueId(),
      order: order++,
      type: 'text',
      content: { [primaryLang]: cleanedSentence },
      formatting: {},
      metadata: { isNewPara }
    };
    isNewPara = false; // Only the first segment after a blank line is a new paragraph
    return segment;
  }).filter((s): s is Segment => s !== null);

  // Re-evaluate isNewPara based on original line breaks
  const lines = text.split('\n');
  let segmentIndex = 0;
  let linePointer = 0;
  while(segmentIndex < segments.length && linePointer < lines.length) {
    const line = lines[linePointer].trim();
    if (line === '') {
        if(segments[segmentIndex]) {
            segments[segmentIndex].metadata.isNewPara = true;
        }
    }
    if(line.includes(segments[segmentIndex].content[primaryLang])) {
        segmentIndex++;
    }
    linePointer++;
  }

  return segments;
}

/**
 * Parses bilingual text that follows the `English part {Vietnamese part}` format.
 * @param text The block of text to parse.
 * @param primaryLang The language code for the main text.
 * @param secondaryLang The language code for the text within braces.
 * @returns An array of Segments.
 */
function parseBilingualContent(text: string, primaryLang: string, secondaryLang: string): Segment[] {
    if (!text.trim()) return [];
    
    // Regex to find all pairs of 'English {Vietnamese}'
    const bilingualPairRegex = /(.*?)\s*\{(.*?)\}/g;
    const segments: Segment[] = [];
    let lastIndex = 0;
    let order = 0;
    let isNewPara = true;

    // Use matchAll to get all matches with their indices
    const matches = Array.from(text.matchAll(bilingualPairRegex));

    matches.forEach(match => {
        const [fullMatch, primaryPart, secondaryPart] = match;
        const matchIndex = match.index!;

        // Handle any text between the last match and this one as monolingual
        if (matchIndex > lastIndex) {
            const precedingText = cleanText(text.substring(lastIndex, matchIndex));
            if (precedingText) {
                segments.push({
                    id: generateLocalUniqueId(),
                    order: order++,
                    type: 'text',
                    content: { [primaryLang]: precedingText },
                    formatting: {},
                    metadata: { isNewPara }
                });
                isNewPara = false;
            }
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
            metadata: { isNewPara }
        });

        isNewPara = false; // Subsequent segments are not new paragraphs unless a blank line is detected
        lastIndex = matchIndex + fullMatch.length;
    });

    // Handle any remaining text after the last match
    if (lastIndex < text.length) {
        const remainingText = cleanText(text.substring(lastIndex));
        if (remainingText) {
            segments.push({
                id: generateLocalUniqueId(),
                order: order++,
                type: 'text',
                content: { [primaryLang]: remainingText },
                formatting: {},
                metadata: { isNewPara }
            });
        }
    }
    
    // Final check for paragraph breaks from original text
    const lines = text.split('\n');
    let segmentIndex = 0;
    let linePointer = 0;
    while (segmentIndex < segments.length && linePointer < lines.length) {
        const line = lines[linePointer].trim();
        if (line === '') {
            if(segments[segmentIndex]) {
                segments[segmentIndex].metadata.isNewPara = true;
            }
        }
        if (line.includes(segments[segmentIndex].content[primaryLang])) {
            segmentIndex++;
        }
        linePointer++;
    }
    if (segments.length > 0) {
        segments[0].metadata.isNewPara = true;
    }


    return segments;
}


/**
 * Main parser function that delegates to the appropriate content parser.
 */
export function parseMarkdownToSegments(
  markdown: string,
  origin: string
): Segment[] {
  const [primaryLang, secondaryLang] = origin.split('-');

  if (secondaryLang) {
    return parseBilingualContent(markdown, primaryLang, secondaryLang);
  } else {
    return parseMonolingualContent(markdown, primaryLang);
  }
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
    if (lines[i].trim().startsWith('## ')) {
      chapterStarts.push({
        index: i,
        title: lines[i].trim().substring(3)
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
