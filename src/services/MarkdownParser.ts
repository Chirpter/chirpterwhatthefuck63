// src/services/MarkdownParser.ts - FINAL, ROBUST VERSION

import type { Segment, Chapter, Book, Piece, MultilingualContent } from '@/lib/types';
import { generateLocalUniqueId } from '@/lib/utils';

/**
 * Removes footnote annotations like [1], [23] and trims whitespace.
 * This is a crucial first step before any parsing logic.
 */
function cleanText(text: string): string {
  if (!text) return '';
  return text.replace(/\[\d+\]/g, '').trim();
}

/**
 * Parses content that is purely monolingual. It splits the text into
 * sentences using a regex that is smart about abbreviations and punctuation.
 */
function parseMonolingualContent(markdown: string, lang: string): Segment[] {
  if (!markdown) return [];
  
  // Regex to split sentences while respecting abbreviations (Dr., St., etc.) and quotes.
  const sentenceRegex = /(?<!\b(?:Dr|Mr|Mrs|Ms|St|No)\.)\s*([.?!"]+)(?=\s+|$)/g;
  
  const sentences = markdown
    .split(sentenceRegex)
    .reduce((acc, part, index) => {
      // Group the sentence part with its ending punctuation
      if (index % 2 === 0) {
        acc.push(part);
      } else if (acc.length > 0) {
        acc[acc.length - 1] += part;
      }
      return acc;
    }, [] as string[])
    .filter(s => s.trim().length > 0);

  return sentences.map((s, index) => ({
    id: generateLocalUniqueId(),
    order: index,
    type: 'text',
    content: { [lang]: cleanText(s) },
    formatting: {},
    metadata: { isNewPara: false } // isNewPara will be set later
  }));
}

/**
 * Parses content that is expected to be bilingual, using the "{}" syntax.
 * It correctly handles mixed monolingual and bilingual segments.
 */
function parseBilingualContent(markdown: string, primaryLang: string, secondaryLang: string): Segment[] {
  if (!markdown) return [];

  const segments: Segment[] = [];
  let remainingText = markdown;
  let order = 0;

  // Regex to find an English part followed by a Vietnamese part in braces.
  // The '(.*?)' is non-greedy.
  const bilingualPairRegex = /([\s\S]*?)\{([\s\S]*?)\}/;

  while (remainingText.length > 0) {
    const match = remainingText.match(bilingualPairRegex);

    if (match) {
      const precedingText = match[1];
      const translatedText = match[2];
      
      // If there's English text before the {translation}, treat it as its own segment
      if (precedingText.trim()) {
        const sentences = parseMonolingualContent(precedingText, primaryLang);
        sentences.forEach(s => {
          s.order = order++;
          segments.push(s);
        });
      }

      // Now, we need to correctly find the English part for the translation.
      // We look backwards from the match in the original preceding text.
      const sentencesBeforeMatch = parseMonlingualContent(precedingText, primaryLang);
      if(sentencesBeforeMatch.length > 0){
          const lastSentence = sentencesBeforeMatch.pop(); // The English part is the last sentence before the {}
          // Add back the other sentences if they exist
          sentencesBeforeMatch.forEach(s => {
            s.order = order++;
            segments.push(s);
          });
          
          if(lastSentence){
              segments.push({
                id: generateLocalUniqueId(),
                order: order++,
                type: 'text',
                content: {
                  [primaryLang]: cleanText(lastSentence.content[primaryLang]),
                  [secondaryLang]: cleanText(translatedText)
                },
                formatting: {},
                metadata: { isNewPara: false }
              });
          }
      }
      
      // Move past the processed part
      remainingText = remainingText.substring(match[0].length);

    } else {
      // If no more bilingual pairs are found, process the rest as monolingual
      if (remainingText.trim()) {
        const sentences = parseMonolingualContent(remainingText, primaryLang);
        sentences.forEach(s => {
          s.order = order++;
          segments.push(s);
        });
      }
      break; // Exit loop
    }
  }

  return segments;
}


/**
 * Main parser for segmenting markdown content. It delegates to the appropriate
 * monolingual or bilingual parser based on the origin string.
 */
export function parseMarkdownToSegments(markdown: string, origin: string): Segment[] {
  const lines = markdown.split('\n');
  const segments: Segment[] = [];
  let order = 0;
  let isNewParaNext = true;

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      isNewParaNext = true;
      continue;
    }
    
    // Skip any heading lines within the content body
    if (trimmedLine.startsWith('#')) {
      continue;
    }
    
    const [primaryLang, secondaryLang] = origin.split('-');
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
 * Parses full book markdown, including title and chapter headings.
 */
export function parseBookMarkdown(
  markdown: string,
  origin: string
): { title: MultilingualContent; chapters: Chapter[] } {
  const [primaryLang, secondaryLang] = origin.split('-');
  const lines = markdown.split('\n');
  
  let title: MultilingualContent = { [primaryLang]: 'Untitled' };
  let contentStartIndex = 0;
  
  // Find H1 title
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('# ')) {
      title = parseBilingualContent(line.substring(2), primaryLang, secondaryLang)[0]?.content || { [primaryLang]: 'Untitled' };
      contentStartIndex = i + 1;
      break;
    }
  }
  
  // Find chapter starts
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
    // Treat all content as a single chapter
    const content = lines.slice(contentStartIndex).join('\n');
    const segments = parseMarkdownToSegments(content, origin);
    if (segments.length > 0) {
        const totalWords = segments.reduce((sum, seg) => sum + (seg.content[primaryLang]?.split(/\s+/).filter(Boolean).length || 0), 0);
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
      
      const chapterTitle = parseBilingualContent(start.title, primaryLang, secondaryLang)[0]?.content || { [primaryLang]: `Chapter ${idx + 1}` };
      const segments = parseMarkdownToSegments(chapterContent, origin);
      const totalWords = segments.reduce((sum, seg) => sum + (seg.content[primaryLang]?.split(/\s+/).filter(Boolean).length || 0), 0);

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
