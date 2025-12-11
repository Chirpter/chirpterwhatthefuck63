// src/services/MarkdownParser.ts - FINALIZED VERSION

import type { Segment, Chapter, Book, Piece, MultilingualContent, PhraseMap } from '@/lib/types';
import { generateLocalUniqueId } from '@/lib/utils';

/**
 * Removes footnote annotations like [1], [23] and trims whitespace.
 */
function cleanText(text: string): string {
  if (!text) return '';
  return text.replace(/\[\d+\]/g, '').trim();
}

/**
 * Parses monolingual content, splitting by sentences.
 */
function parseMonolingualContent(markdown: string, lang: string): Segment[] {
    if (!markdown.trim()) return [];
    
    // Regex to split sentences, trying to respect abbreviations.
    const sentenceRegex = /(?<!\b(?:[Dd]r|[Mm]r|[Mm]rs|[Mm]s|[Ss]t|[Mm]t)\.)[.?!](\s+|$)/g;
    
    return markdown
        .split(sentenceRegex)
        .reduce((acc, part, index) => {
            if (index % 2 === 0 && part.trim()) {
                acc.push(part.trim());
            } else if (part) {
                // This part is the delimiter (e.g., ". "), add it to the previous sentence
                if (acc.length > 0) {
                    acc[acc.length - 1] += part.trim();
                }
            }
            return acc;
        }, [] as string[])
        .filter(s => s)
        .map((sentence, index) => ({
            id: generateLocalUniqueId(),
            order: index,
            type: 'text',
            content: { [lang]: sentence },
            formatting: {},
            metadata: { 
                isNewPara: false, // This will be set later
                bilingualFormat: 'sentence',
            }
        }));
}


/**
 * Parses bilingual content using the {translation} syntax.
 * Handles mixed monolingual and bilingual content.
 */
function parseBilingualContent(markdown: string, primaryLang: string, secondaryLang: string): Segment[] {
  const segments: Segment[] = [];
  let order = 0;
  
  // This regex finds a primary text chunk and its optional {secondary} part.
  // It's non-greedy `(.*?)` to capture only up to the next opening brace or end of string.
  const bilingualPairRegex = /(.*?)\s*\{(.*?)\}/g;
  let lastIndex = 0;
  let match;

  while ((match = bilingualPairRegex.exec(markdown)) !== null) {
      // 1. Handle any monolingual text before this bilingual pair
      const monoTextBefore = markdown.substring(lastIndex, match.index).trim();
      if (monoTextBefore) {
          const monoSegments = parseMonlingualContentForBilingual(monoTextBefore, primaryLang, order);
          segments.push(...monoSegments);
          order += monoSegments.length;
      }
      
      // 2. Handle the bilingual pair
      const primary = cleanText(match[1]);
      const secondary = cleanText(match[2]);

      if (primary || secondary) {
        segments.push({
          id: generateLocalUniqueId(),
          order: order++,
          type: 'text',
          content: {
            [primaryLang]: primary,
            [secondaryLang]: secondary,
          },
          formatting: {},
          metadata: { isNewPara: false, bilingualFormat: 'sentence' },
        });
      }

      lastIndex = match.index + match[0].length;
  }
  
  // 3. Handle any remaining monolingual text at the end
  const remainingText = markdown.substring(lastIndex).trim();
  if (remainingText) {
      const monoSegments = parseMonlingualContentForBilingual(remainingText, primaryLang, order);
      segments.push(...monoSegments);
  }

  return segments;
}

// A helper specifically for parsing monolingual parts discovered within bilingual content
function parseMonlingualContentForBilingual(text: string, lang: string, initialOrder: number): Segment[] {
    const sentences = splitSentences(text);
    return sentences.map((sentence, index) => ({
        id: generateLocalUniqueId(),
        order: initialOrder + index,
        type: 'text',
        content: { [lang]: sentence },
        formatting: {},
        metadata: { isNewPara: false, bilingualFormat: 'sentence' },
    }));
}


function splitSentences(text: string): string[] {
    // Improved regex to handle abbreviations and direct speech.
    const sentenceEndings = /(?<!\b[A-Z][a-z]{1,2}\.|[Pp]rof\.|[Mm]r\.|[Mm]s\.)[.?!](?:\s+|$|(?=[\"“]))/g;
    const sentences = text.replace(sentenceEndings, '$&\u00A0').split('\u00A0');
    return sentences.map(s => s.trim()).filter(Boolean);
}

/**
 * Main parser - delegates to appropriate sub-parser.
 */
export function parseMarkdownToSegments(markdown: string, origin: string): Segment[] {
  const [primaryLang, secondaryLang, formatFlag] = origin.split('-');
  const isBilingual = !!secondaryLang;
  const bilingualFormat: 'sentence' | 'phrase' = formatFlag === 'ph' ? 'phrase' : 'sentence';

  const lines = markdown.split('\n').filter(line => !line.trim().startsWith('#'));
  const segments: Segment[] = [];
  let order = 0;
  let isNewParaNext = true;

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      isNewParaNext = true;
      continue;
    }

    let lineSegments: Segment[] = [];
    if (isBilingual) {
        if (bilingualFormat === 'phrase') {
            lineSegments = parseBilingualPhraseContent(trimmedLine, primaryLang, secondaryLang);
        } else {
            lineSegments = parseBilingualContent(trimmedLine, primaryLang, secondaryLang);
        }
    } else {
      lineSegments = parseMonolingualContent(trimmedLine, primaryLang);
    }
    
    if (lineSegments.length > 0) {
      if (isNewParaNext) {
        lineSegments[0].metadata.isNewPara = true;
      }
      isNewParaNext = false;
      
      lineSegments.forEach(seg => {
        seg.order = order++;
        segments.push(seg);
      });
    }
  }

  return segments;
}

function parseBilingualPhraseContent(line: string, primaryLang: string, secondaryLang: string): Segment[] {
    const match = line.match(/^(.*?)\s*\{(.*)\}\s*$/);
    if (!match) {
        // If the line doesn't match the phrase format, treat it as a single sentence.
        return [{
            id: generateLocalUniqueId(),
            order: 0,
            type: 'text',
            content: { [primaryLang]: cleanText(line) },
            formatting: {},
            metadata: { isNewPara: false, bilingualFormat: 'sentence' }
        }];
    }

    const primarySentence = cleanText(match[1]);
    const secondarySentence = cleanText(match[2]);
    
    const punctuationRegex = /([,;:.?!—])\s*/g;
    const primaryPhrases = primarySentence.split(punctuationRegex).filter(Boolean);
    const secondaryPhrases = secondarySentence.split(punctuationRegex).filter(Boolean);

    const combinedPhrases: string[] = [];
    for (let i = 0; i < primaryPhrases.length; i += 2) {
        combinedPhrases.push((primaryPhrases[i] + (primaryPhrases[i+1] || '')).trim());
    }

    const phraseMap: PhraseMap[] = combinedPhrases.map((primaryPhrase, index) => {
        // This is a simplification; a more robust solution would align phrases smartly.
        const secondaryPhrase = secondaryPhrases[index * 2] + (secondaryPhrases[index * 2 + 1] || '');
        return {
            [primaryLang]: primaryPhrase,
            [secondaryLang]: secondaryPhrase ? secondaryPhrase.trim() : ''
        };
    });
    
    return [{
        id: generateLocalUniqueId(),
        order: 0,
        type: 'text',
        content: phraseMap,
        formatting: {},
        metadata: { isNewPara: false, bilingualFormat: 'phrase' }
    }];
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
      const totalWords = segments.reduce((sum, seg) => sum + (Array.isArray(seg.content) ? 0 : (seg.content[primaryLang] || '').split(/\s+/).filter(Boolean).length), 0);
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
      const chapterContent = lines.slice(start.index, nextStart).join('\n'); // Keep title in content for segment parsing
      const chapterTitle = parseBilingualText(start.title, primaryLang, secondaryLang);
      const segments = parseMarkdownToSegments(chapterContent, origin);
      const totalWords = segments.reduce((sum, seg) => sum + (Array.isArray(seg.content) ? 0 : (seg.content[primaryLang] || '').split(/\s+/).filter(Boolean).length), 0);

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
