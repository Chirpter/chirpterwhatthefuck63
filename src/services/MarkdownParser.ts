// src/services/MarkdownParser.ts - FINALIZED VERSION

import type { Segment, Chapter, Book, Piece, MultilingualContent, PhraseMap, BilingualFormat } from '@/lib/types';
import { generateLocalUniqueId } from '@/lib/utils';

/**
 * Removes footnote annotations like [1], [23] and trims whitespace.
 */
function cleanText(text: string): string {
  if (!text) return '';
  return text.replace(/\[\d+\]/g, '').trim();
}

/**
 * Splits text into sentences, trying to respect abbreviations and other edge cases.
 * This regex looks for sentence-ending punctuation (.?!) that is followed by a space and an uppercase letter,
 * or is at the end of the string. It avoids splitting on abbreviations like "Mr." or "St.".
 */
const sentenceRegex = /(?<!\b[A-Z][a-z]{1,2}\.)(?<!\b[A-Z]\.)[.?!](?=\s+[A-Z]|$)/g;
function splitSentences(text: string): string[] {
    return text.split(sentenceRegex).map(s => s.trim()).filter(Boolean);
}

/**
 * Parses monolingual content into sentence-based segments.
 */
function parseMonolingualContent(markdown: string, lang: string): Segment[] {
    if (!markdown.trim()) return [];
    
    return splitSentences(markdown).map((sentence, index) => ({
        id: generateLocalUniqueId(),
        order: index,
        type: 'text',
        content: { [lang]: sentence },
        formatting: {},
        metadata: { 
            isNewPara: false, // This will be set by the main line-by-line parser
            bilingualFormat: 'sentence',
        }
    }));
}

/**
 * Parses bilingual content using the {translation} syntax.
 * This is the core logic for handling mixed mono/bilingual text.
 */
function parseBilingualContent(markdown: string, primaryLang: string, secondaryLang: string): Segment[] {
  const segments: Segment[] = [];
  
  // This regex finds a text block and its following {translation}.
  // The 'g' flag is crucial for finding all occurrences.
  // The 's' flag allows '.' to match newlines, although we process line by line.
  const bilingualPairRegex = /([^{}]+)\s*\{(.*?)\}/gs;
  let lastIndex = 0;
  let match;

  while ((match = bilingualPairRegex.exec(markdown)) !== null) {
      // 1. Handle any monolingual text *before* this bilingual pair
      const monoTextBefore = markdown.substring(lastIndex, match.index).trim();
      if (monoTextBefore) {
          const monoSentences = splitSentences(monoTextBefore);
          for (const sentence of monoSentences) {
              segments.push({
                  id: generateLocalUniqueId(),
                  order: segments.length,
                  type: 'text',
                  content: { [primaryLang]: sentence },
                  formatting: {},
                  metadata: { isNewPara: false, bilingualFormat: 'sentence' },
              });
          }
      }
      
      // 2. Handle the bilingual pair itself
      const primary = cleanText(match[1]);
      const secondary = cleanText(match[2]);

      if (primary || secondary) {
        segments.push({
          id: generateLocalUniqueId(),
          order: segments.length,
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
  
  // 3. Handle any remaining monolingual text at the very end
  const remainingText = markdown.substring(lastIndex).trim();
  if (remainingText) {
      const monoSentences = splitSentences(remainingText);
      for (const sentence of monoSentences) {
          segments.push({
              id: generateLocalUniqueId(),
              order: segments.length,
              type: 'text',
              content: { [primaryLang]: sentence },
              formatting: {},
              metadata: { isNewPara: false, bilingualFormat: 'sentence' },
          });
      }
  }

  return segments;
}


/**
 * Main parser - processes text line-by-line and delegates to sub-parsers.
 */
export function parseMarkdownToSegments(markdown: string, origin: string): Segment[] {
  const [primaryLang, secondaryLang, formatFlag] = origin.split('-');
  const isBilingual = !!secondaryLang;
  const bilingualFormat: BilingualFormat = formatFlag === 'ph' ? 'phrase' : 'sentence';

  const lines = markdown.split('\n');
  const segments: Segment[] = [];
  let isNewParaNext = true;

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Ignore chapter headings (or any heading) within segment content
    if (trimmedLine.startsWith('#')) {
        continue;
    }

    if (!trimmedLine) {
      isNewParaNext = true;
      continue;
    }

    let lineSegments: Segment[] = [];
    if (isBilingual) {
        if (bilingualFormat === 'phrase') {
            // Phrase mode logic
            const pairMatch = trimmedLine.match(/([^{}]+)\s*\{(.*?)\}/);
            if (pairMatch) {
                const primarySentence = cleanText(pairMatch[1]);
                const secondarySentence = cleanText(pairMatch[2]);
                const phraseRegex = /([^,;:]+[,;:]?)/g;
                const primaryPhrases = primarySentence.match(phraseRegex) || [primarySentence];
                const secondaryPhrases = secondarySentence.match(phraseRegex) || [secondarySentence];
                
                const phraseMaps: PhraseMap[] = primaryPhrases.map((phrase, i) => ({
                    [primaryLang]: phrase.trim(),
                    [secondaryLang]: (secondaryPhrases[i] || '').trim(),
                }));
                
                lineSegments.push({
                    id: generateLocalUniqueId(),
                    order: 0, // temp order
                    type: 'text',
                    content: phraseMaps,
                    formatting: {},
                    metadata: { isNewPara: false, bilingualFormat: 'phrase' },
                });
            }
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
        seg.order = segments.length; // Assign order as we add them
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
        metadata: { primaryLanguage: primaryLang }
      });
    }
  } else {
    chapterStarts.forEach((start, idx) => {
      const nextStart = chapterStarts[idx + 1]?.index || lines.length;
      const chapterContent = lines.slice(start.index + 1, nextStart).join('\n'); // Exclude title line from content
      const chapterTitle = parseBilingualText(start.title, primaryLang, secondaryLang);
      const segments = parseMarkdownToSegments(chapterContent, origin);
      const totalWords = segments.reduce((sum, seg) => sum + (Array.isArray(seg.content) ? 0 : (seg.content[primaryLang] || '').split(/\s+/).filter(Boolean).length), 0);

      chapters.push({
        id: generateLocalUniqueId(),
        order: idx,
        title: chapterTitle,
        segments,
        stats: { totalSegments: segments.length, totalWords, estimatedReadingTime: Math.ceil(totalWords / 200) },
        metadata: { primaryLanguage: primaryLang }
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
