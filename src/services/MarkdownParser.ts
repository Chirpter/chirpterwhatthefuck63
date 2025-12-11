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
 * Parses monolingual content into a PhraseMap array.
 * This always returns an array with a single item for sentence-mode.
 */
function parseMonolingualContent(line: string, lang: string): PhraseMap[] {
    const cleaned = cleanText(line);
    if (!cleaned) return [];
    return [{ [lang]: cleaned }];
}

/**
 * Parses bilingual content using the {translation} syntax.
 * It handles mixed monolingual and bilingual content within the same line.
 * This now returns an array of PhraseMap objects, with one object per sentence pair.
 */
function parseBilingualContent(line: string, primaryLang: string, secondaryLang: string): PhraseMap[] {
    const bilingualRegex = /([^{}]+)\{([^{}]*)\}/g;
    let match;
    const phrases: PhraseMap[] = [];
    let lastIndex = 0;

    while ((match = bilingualRegex.exec(line)) !== null) {
        const precedingText = line.substring(lastIndex, match.index).trim();
        if (precedingText) {
            phrases.push({ [primaryLang]: precedingText });
        }

        const primary = cleanText(match[1]);
        const secondary = cleanText(match[2]);
        if (primary || secondary) {
            phrases.push({
                [primaryLang]: primary,
                [secondaryLang]: secondary,
            });
        }
        lastIndex = match.index + match[0].length;
    }

    const remainingText = line.substring(lastIndex).trim();
    if (remainingText) {
        phrases.push({ [primaryLang]: remainingText });
    }

    return phrases;
}


/**
 * Main parser - processes text line-by-line and delegates to sub-parsers.
 */
export function parseMarkdownToSegments(markdown: string, origin: string): Segment[] {
  const [primaryLang, secondaryLang, formatFlag] = origin.split('-');
  const isBilingual = !!secondaryLang;
  const contentUnit: ContentUnit = formatFlag === 'ph' ? 'phrase' : 'sentence';

  const lines = markdown.split('\n');
  const segments: Segment[] = [];
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

    let lineContent: PhraseMap[] = [];
    
    if (isBilingual) {
        if (contentUnit === 'phrase') {
            lineContent = parseBilingualContent(trimmedLine, primaryLang, secondaryLang);
        } else { // Sentence mode
            const sentencePairs = parseBilingualContent(trimmedLine, primaryLang, secondaryLang);
            sentencePairs.forEach((pair, index) => {
                segments.push({
                    id: generateLocalUniqueId(),
                    order: segments.length,
                    type: 'text',
                    content: [pair],
                    formatting: {},
                    metadata: {
                        isNewPara: isNewParaNext && index === 0,
                        unit: 'sentence',
                    }
                });
            });
            isNewParaNext = false;
            continue;
        }
    } else { // Monolingual
      lineContent = parseMonolingualContent(trimmedLine, primaryLang);
    }
    
    if (lineContent.length > 0) {
      const newSegment: Segment = {
          id: generateLocalUniqueId(),
          order: segments.length,
          type: 'text',
          content: lineContent,
          formatting: {},
          metadata: {
              isNewPara: isNewParaNext,
              unit: contentUnit,
          }
      };
      segments.push(newSegment);
      isNewParaNext = false;
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
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('# ')) {
      const titleText = line.substring(2).trim();
      title = parseBilingualText(titleText, primaryLang, secondaryLang);
      contentStartIndex = i + 1;
      break;
    }
  }
  
  const contentAfterTitle = lines.slice(contentStartIndex).join('\n');
  const chapterParts = contentAfterTitle.split(/\n## /);

  const chapters: Chapter[] = [];
  
  if (chapterParts.length <= 1) {
    const segments = parseMarkdownToSegments(contentAfterTitle, origin);
    if (segments.length > 0) {
      const totalWords = calculateTotalWords(segments, primaryLang);
      chapters.push({
        id: generateLocalUniqueId(),
        order: 0,
        title: { [primaryLang]: 'Chapter 1' },
        segments,
        stats: { totalSegments: segments.length, totalWords, estimatedReadingTime: Math.ceil(totalWords / 200) },
        metadata: { primaryLanguage: primaryLang }
      });
    }
  } else {
    if (chapterParts[0].trim()) {
        const segments = parseMarkdownToSegments(chapterParts[0], origin);
        const totalWords = calculateTotalWords(segments, primaryLang);
         chapters.push({
            id: generateLocalUniqueId(),
            order: 0,
            title: { [primaryLang]: 'Introduction' },
            segments,
            stats: { totalSegments: segments.length, totalWords, estimatedReadingTime: Math.ceil(totalWords / 200) },
            metadata: { primaryLanguage: primaryLang }
        });
    }

    chapterParts.slice(1).forEach((part, idx) => {
      const partLines = part.split('\n');
      const chapterTitleLine = partLines[0].trim();
      const chapterContent = partLines.slice(1).join('\n');
      
      const chapterTitle = parseBilingualText(chapterTitleLine, primaryLang, secondaryLang);
      const segments = parseMarkdownToSegments(chapterContent, origin);
      const totalWords = calculateTotalWords(segments, primaryLang);

      chapters.push({
        id: generateLocalUniqueId(),
        order: chapters.length,
        title: chapterTitle,
        segments,
        stats: { totalSegments: segments.length, totalWords, estimatedReadingTime: Math.ceil(totalWords / 200) },
        metadata: { primaryLanguage: primaryLang }
      });
    });
  }

  return { title, chapters };
}


function calculateTotalWords(segments: Segment[], primaryLang: string): number {
    return segments.reduce((sum, seg) => {
        const phraseSum = seg.content.reduce((phraseTotal, phrase) => {
            return phraseTotal + (phrase[primaryLang]?.split(/\s+/).filter(Boolean).length || 0);
        }, 0);
        return sum + phraseSum;
    }, 0);
}


function parseBilingualText(text: string, primaryLang: string, secondaryLang?: string): MultilingualContent {
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
