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
  // Advanced regex: splits on sentence-ending punctuation.
  // It avoids splitting on abbreviations (e.g., Dr., St.) by checking what precedes the dot.
  // It correctly handles endings like .", ?", !".
  const sentenceRegex = /(?<!\b(?:[A-Z][a-z]{1,2})\.)(?<=[.?!])(?:"|'|”|’)?\s+(?=[A-Z"']|[\r\n]|$)/g;
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
      metadata: { isNewPara: false }
    };
  }).filter((s): s is Segment => s !== null);
}

/**
 * Parses bilingual text that follows the `English part {Vietnamese part}` format.
 * This version is robust and handles monolingual sentences mixed in.
 * @param text The block of text to parse.
 * @param primaryLang The language code for the main text.
 * @param secondaryLang The language code for the text within braces.
 * @returns An array of Segments.
 */
function parseBilingualContent(text: string, primaryLang: string, secondaryLang: string): Segment[] {
    if (!text.trim()) return [];
    
    // This regex finds all instances of `english {vietnamese}` and also captures the text between them.
    const bilingualPairRegex = /(.+?)\s*\{(.*?)\}/g;
    const segments: Segment[] = [];
    let lastIndex = 0;
    let order = 0;

    const matches = Array.from(text.matchAll(bilingualPairRegex));

    matches.forEach(match => {
        const [fullMatch, primaryPart, secondaryPart] = match;
        const matchIndex = match.index!;

        // Handle any text between the last match and this one as monolingual
        if (matchIndex > lastIndex) {
            const precedingText = text.substring(lastIndex, matchIndex);
            const monoSegments = parseMonolingualContent(precedingText, primaryLang);
            monoSegments.forEach(seg => {
                segments.push({ ...seg, order: order++ });
            });
        }
        
        const cleanedPrimary = cleanText(primaryPart);
        const cleanedSecondary = cleanText(secondaryPart);

        // Parse the primary part into sentences, in case it contains multiple.
        const primarySentences = splitIntoSentences(cleanedPrimary);
        const secondarySentences = splitIntoSentences(cleanedSecondary);
        
        // This is a simple pairing strategy. For more complex cases, a more advanced alignment might be needed.
        const maxLength = Math.max(primarySentences.length, secondarySentences.length);

        for (let i = 0; i < maxLength; i++) {
             segments.push({
                id: generateLocalUniqueId(),
                order: order++,
                type: 'text',
                content: {
                    [primaryLang]: primarySentences[i] || '',
                    [secondaryLang]: secondarySentences[i] || '',
                },
                formatting: {},
                metadata: { isNewPara: false }
            });
        }

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
  
  const contentToParse = markdown
    .split('\n')
    .filter(line => !line.trim().startsWith('##'))
    .join('\n');

  let segments: Segment[];

  if (secondaryLang && secondaryLang !== 'ph') {
    segments = parseBilingualContent(contentToParse, primaryLang, secondaryLang);
  } else {
    segments = parseMonolingualContent(contentToParse, primaryLang);
  }

  // Final pass to set paragraph metadata
  if (segments.length > 0) {
      segments[0].metadata.isNewPara = true;
      // This logic can be improved if more precise paragraph detection is needed.
      // For now, only the first segment is marked as a new paragraph.
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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('# ')) {
      title = parseBilingualText(line.substring(2), primaryLang, secondaryLang);
      contentStartIndex = i + 1;
      break;
    }
  }

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
