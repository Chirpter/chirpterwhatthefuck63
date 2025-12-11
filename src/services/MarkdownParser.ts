// src/services/MarkdownParser.ts - PRODUCTION READY
import type { Segment, Chapter, Book, Piece, MultilingualContent, PhraseMap } from '@/lib/types';
import { generateLocalUniqueId } from '@/lib/utils';

/**
 * Removes footnote-style annotations (e.g., [1], [23]) from a string.
 * @param text The input string.
 * @returns The cleaned string.
 */
function removeFootnoteAnnotations(text: string): string {
  if (!text) return '';
  return text.replace(/\[\d+\]/g, '').trim();
}

/**
 * Extracts a primary and optional secondary language string from a line.
 * It specifically looks for ' / ' as a separator.
 * @param text The full line of text.
 * @param primaryLang The language code for the first part.
 * @param secondaryLang The language code for the second part (optional).
 * @returns A MultilingualContent object.
 */
function extractBilingualContent(text: string, primaryLang: string, secondaryLang?: string): MultilingualContent {
    const separator = ' / ';
    const separatorIndex = text.indexOf(separator);

    if (secondaryLang && separatorIndex !== -1) {
        const primaryText = removeFootnoteAnnotations(text.substring(0, separatorIndex));
        const secondaryText = removeFootnoteAnnotations(text.substring(separatorIndex + separator.length));
        return {
            [primaryLang]: primaryText,
            [secondaryLang]: secondaryText,
        };
    }

    // If no separator or not bilingual, the whole line is primary content.
    return {
        [primaryLang]: removeFootnoteAnnotations(text),
    };
}


/**
 * NEW, ROBUST PARSER: Processes markdown line by line.
 * Each non-empty line is treated as a potential segment.
 */
export function parseMarkdownToSegments(
  markdown: string,
  origin: string
): Segment[] {
  if (!markdown || !markdown.trim()) return [];
  
  const [primaryLang, secondaryLang] = origin.split('-');
  const lines = markdown.split('\n');
  const segments: Segment[] = [];
  let globalOrder = 0;
  let isNewParaFlag = true;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine) {
      // Don't create segments for chapter headings
      if (trimmedLine.startsWith('## ')) continue;
      
      segments.push({
        id: generateLocalUniqueId(),
        order: globalOrder++,
        type: 'text',
        content: extractBilingualContent(trimmedLine, primaryLang, secondaryLang),
        formatting: {},
        metadata: { isNewPara: isNewParaFlag }
      });
      isNewParaFlag = false; // Subsequent lines in the same block are not new paragraphs
    } else {
      // An empty line signals the start of a new paragraph
      isNewParaFlag = true;
    }
  }
  
  return segments;
}


/**
 * Extracts title and parses chapters from book-specific markdown.
 */
export function parseBookMarkdown(
  markdown: string,
  origin: string
): { title: MultilingualContent; chapters: Chapter[] } {
  const [primaryLang, secondaryLang] = origin.split('-');
  const lines = markdown.split('\n').filter(l => l.trim() !== ''); // Remove all empty lines for easier processing

  let title: MultilingualContent = { [primaryLang]: 'Untitled' };
  let contentStartIndex = 0;

  // Find H1 title
  const h1Index = lines.findIndex(l => l.trim().startsWith('# '));
  if (h1Index !== -1) {
    const titleText = lines[h1Index].trim().substring(2).trim();
    title = extractBilingualContent(titleText, primaryLang, secondaryLang);
    contentStartIndex = h1Index + 1;
  }

  const contentLines = lines.slice(contentStartIndex);
  const chapterIndices = contentLines
    .map((line, index) => (line.startsWith('## ') ? index : -1))
    .filter(index => index !== -1);

  const chapters: Chapter[] = [];
  
  if (chapterIndices.length === 0 && contentLines.length > 0) {
      // No '##' found, treat all content as Chapter 1
      const content = contentLines.join('\n');
      const segments = parseMarkdownToSegments(content, origin);
      const totalWords = segments.reduce((sum, seg) => sum + (seg.content[primaryLang]?.split(/\s+/).length || 0), 0);
      chapters.push({
          id: generateLocalUniqueId(),
          order: 0,
          title: { [primaryLang]: "Chapter 1" },
          segments,
          stats: { totalSegments: segments.length, totalWords, estimatedReadingTime: Math.ceil(totalWords / 200) },
          metadata: {}
      });
  } else {
    chapterIndices.forEach((startIndex, i) => {
        const endIndex = (i + 1 < chapterIndices.length) ? chapterIndices[i + 1] : contentLines.length;
        const chapterTitleLine = contentLines[startIndex];
        const chapterContent = contentLines.slice(startIndex + 1, endIndex).join('\n');

        const chapterTitle = extractBilingualContent(chapterTitleLine.substring(3).trim(), primaryLang, secondaryLang);
        const segments = parseMarkdownToSegments(chapterContent, origin);
        const totalWords = segments.reduce((sum, seg) => sum + (seg.content[primaryLang]?.split(/\s+/).length || 0), 0);

        chapters.push({
          id: generateLocalUniqueId(),
          order: i,
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
 * Helper to extract segments from any library item.
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
