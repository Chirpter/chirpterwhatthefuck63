// src/services/MarkdownParser.ts - FINALIZED VERSION

import type { Segment, Chapter, Book, Piece, MultilingualContent } from '@/lib/types';
import { generateLocalUniqueId } from '@/lib/utils';

/**
 * Removes footnote annotations like [1], [23] and trims whitespace.
 */
function cleanText(text: string): string {
  if (!text) return '';
  return text.replace(/\[\d+\]/g, '').trim();
}

/**
 * Uses a more robust regex to split text into sentences, respecting abbreviations.
 */
function splitIntoSentences(text: string): string[] {
  if (!text) return [];
  // This regex looks for sentence-ending punctuation (.!?) followed by a space and an uppercase letter, or the end of the string.
  // It uses a negative lookbehind to avoid splitting on common abbreviations.
  const sentenceRegex = /(?<!\b(?:Dr|Mr|Mrs|Ms|St|Mt|No|vs|etc|Prof|Sr|Jr)\.)[.?!](\s+(?=[A-ZÀ-Ý])|$)/g;
  const sentences = text.replace(sentenceRegex, '$1\u00A0').split('\u00A0');
  return sentences.map(s => s.trim()).filter(s => s.length > 0);
}


/**
 * Parses purely monolingual content.
 */
function parseMonolingualContent(markdown: string, lang: string): Segment[] {
    const segments: Segment[] = [];
    const lines = markdown.split('\n');
    let order = 0;
    let isNewParaNext = true;

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) {
            isNewParaNext = true;
            continue;
        }

        const sentences = splitIntoSentences(trimmedLine);
        sentences.forEach((sentence, index) => {
            segments.push({
                id: generateLocalUniqueId(),
                order: order++,
                type: 'text',
                content: { [lang]: sentence },
                formatting: {},
                metadata: { isNewPara: isNewParaNext && index === 0 }
            });
        });
        isNewParaNext = false;
    }
    return segments;
}

/**
 * Parses bilingual content using the {translation} syntax.
 * This function now correctly handles mixed monolingual and bilingual sentences.
 */
function parseBilingualContent(markdown: string, primaryLang: string, secondaryLang: string): Segment[] {
    const segments: Segment[] = [];
    let order = 0;
    let lastIndex = 0;
    
    // Regex to find all translation blocks: {...}
    const translationRegex = /\{([^}]*)\}/g;
    let match;

    while ((match = translationRegex.exec(markdown)) !== null) {
        const translationText = match[1];
        const translationStartIndex = match.index;

        // Get the text chunk before the current translation block
        const textBefore = markdown.substring(lastIndex, translationStartIndex);
        
        // Find the last sentence in this chunk
        const sentencesBefore = splitIntoSentences(textBefore);

        if (sentencesBefore.length > 0) {
            // All but the last sentence are monolingual
            for (let i = 0; i < sentencesBefore.length - 1; i++) {
                segments.push({
                    id: generateLocalUniqueId(),
                    order: order++,
                    type: 'text',
                    content: { [primaryLang]: cleanText(sentencesBefore[i]) },
                    formatting: {},
                    metadata: { isNewPara: false }
                });
            }

            // The last sentence is paired with the translation
            segments.push({
                id: generateLocalUniqueId(),
                order: order++,
                type: 'text',
                content: {
                    [primaryLang]: cleanText(sentencesBefore[sentencesBefore.length - 1]),
                    [secondaryLang]: cleanText(translationText)
                },
                formatting: {},
                metadata: { isNewPara: false }
            });
        } else {
             // Handle cases where a translation block might appear without a preceding sentence (e.g., " {Vietnamese only}")
            if (cleanText(translationText)) {
                segments.push({
                    id: generateLocalUniqueId(),
                    order: order++,
                    type: 'text',
                    content: { [secondaryLang]: cleanText(translationText) },
                    formatting: {},
                    metadata: { isNewPara: false }
                });
            }
        }
        
        lastIndex = match.index + match[0].length;
    }

    // Process any remaining text after the last translation block
    const remainingText = markdown.substring(lastIndex);
    if (remainingText.trim()) {
        const monoSegments = parseMonolingualContent(remainingText, primaryLang);
        monoSegments.forEach(seg => {
            seg.order = order++;
            segments.push(seg);
        });
    }

    return segments;
}


/**
 * Main parser - delegates to appropriate sub-parser.
 */
export function parseMarkdownToSegments(markdown: string, origin: string): Segment[] {
  const [primaryLang, secondaryLang] = origin.split('-');
  const lines = markdown.split('\n');
  const segments: Segment[] = [];
  let order = 0;
  let isNewParaNext = true;

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith('#')) {
      continue;
    }
    
    if (!trimmedLine) {
      isNewParaNext = true;
      continue;
    }
    
    let lineSegments: Segment[];

    if (secondaryLang) {
      lineSegments = parseBilingualContent(trimmedLine, primaryLang, secondaryLang);
    } else {
      lineSegments = parseMonolingualContent(trimmedLine, primaryLang);
    }

    if (lineSegments.length > 0) {
      if (isNewParaNext) {
        lineSegments[0].metadata.isNewPara = true;
        isNewParaNext = false;
      }
      
      lineSegments.forEach(seg => {
        seg.order = order++;
        segments.push(seg);
      });
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
  
  // Extract H1 title
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('# ')) {
      const titleText = line.substring(2).trim();
      
      const bilingualMatch = titleText.match(/^(.+?)\s*\{(.+?)\}\s*$/);
      if (secondaryLang && bilingualMatch) {
        title = {
          [primaryLang]: cleanText(bilingualMatch[1]),
          [secondaryLang]: cleanText(bilingualMatch[2])
        };
      } else {
        title = { [primaryLang]: cleanText(titleText) };
      }
      
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
        title: line.substring(3).trim()
      });
    }
  }

  const chapters: Chapter[] = [];
  
  if (chapterStarts.length === 0) {
    const content = lines.slice(contentStartIndex).join('\n');
    const segments = parseMarkdownToSegments(content, origin);
    
    if (segments.length > 0) {
      const totalWords = segments.reduce((sum, seg) => sum + (seg.content?.[primaryLang]?.split(/\s+/).filter(Boolean).length || 0), 0);
      
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
      
      let chapterTitle: MultilingualContent;
      const bilingualMatch = start.title.match(/^(.+?)\s*\{(.+?)\}\s*$/);
      if (secondaryLang && bilingualMatch) {
        chapterTitle = {
          [primaryLang]: cleanText(bilingualMatch[1]),
          [secondaryLang]: cleanText(bilingualMatch[2])
        };
      } else {
        chapterTitle = { [primaryLang]: cleanText(start.title) };
      }
      
      const segments = parseMarkdownToSegments(chapterContent, origin);
      const totalWords = segments.reduce((sum, seg) => sum + (seg.content?.[primaryLang]?.split(/\s+/).filter(Boolean).length || 0), 0);

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
