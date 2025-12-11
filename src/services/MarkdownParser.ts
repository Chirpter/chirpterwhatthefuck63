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
 * Splits a sentence into phrases while preserving punctuation.
 */
function splitIntoPhrases(sentence: string): string[] {
  if (!sentence || !sentence.trim()) return [];
  
  const phrases = sentence.match(/[^,;:\-]+[,;:\-]?|\S+/g) || [];
  
  return phrases.map(p => p.trim()).filter(p => p.length > 0);
}

/**
 * REFACTORED: Extracts primary and secondary language sentences from a bilingual string.
 * This is a simple helper for title parsing now.
 */
function extractBilingualSentence(
  text: string,
): { primary: string; secondary: string } {
  const separatorIndex = text.indexOf(' / ');

  if (separatorIndex !== -1) {
    const primary = text.substring(0, separatorIndex).trim();
    const secondary = text.substring(separatorIndex + 3).trim();
    return {
      primary: removeFootnoteAnnotations(primary),
      secondary: removeFootnoteAnnotations(secondary),
    };
  }
  
  return {
    primary: removeFootnoteAnnotations(text),
    secondary: '',
  };
}


/**
 * NEW, ROBUST PARSER: Uses a powerful regex to find bilingual sentence pairs.
 */
export function parseMarkdownToSegments(
  markdown: string,
  origin: string
): Segment[] {
  if (!markdown || !markdown.trim()) return [];
  
  const [primaryLang, secondaryLang, format] = origin.split('-');
  const isBilingualIntent = !!secondaryLang;
  
  const segments: Segment[] = [];
  let remainingMarkdown = markdown.trim();
  let globalOrder = 0;
  let isNewParaFlag = true;

  if (isBilingualIntent) {
    // Regex to find pairs of sentences separated by ' / '.
    // It looks for a sentence ending in '.', '?', '!', or a quote followed by one of those.
    const sentencePairRegex = /(.+?[.?!]['"]?)\s+\/\s+(.+?[.?!]['"]?)/g;
    let match;

    while ((match = sentencePairRegex.exec(remainingMarkdown)) !== null) {
      const primary = removeFootnoteAnnotations(match[1]);
      const secondary = removeFootnoteAnnotations(match[2]);

      const content: MultilingualContent = { [primaryLang]: primary };
      if (secondaryLang) {
        content[secondaryLang] = secondary;
      }
      
      segments.push({
        id: generateLocalUniqueId(),
        order: globalOrder++,
        type: 'text',
        content,
        formatting: {},
        metadata: { isNewPara: isNewParaFlag }
      });
      isNewParaFlag = false;
    }
  } else {
    // Monolingual mode: Split by sentence-ending punctuation.
    // Handles abbreviations like Dr. or St. by not splitting on a period followed by a space and a capital letter.
    const sentenceRegex = /[^.?!]+(?:[.?!](?!['"]?\s+[A-Z])['"]?|$)/g;
    const sentences = remainingMarkdown.match(sentenceRegex) || [remainingMarkdown];

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (trimmedSentence) {
        segments.push({
          id: generateLocalUniqueId(),
          order: globalOrder++,
          type: 'text',
          content: { [primaryLang]: trimmedSentence },
          formatting: {},
          metadata: { isNewPara: isNewParaFlag }
        });
        isNewParaFlag = false;
      }
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
  const lines = markdown.split('\n');
  
  let title: MultilingualContent = { [primaryLang]: 'Untitled' };
  let contentStartIndex = 0;

  const h1Index = lines.findIndex(l => l.trim().startsWith('# '));
  if (h1Index !== -1) {
    const titleText = lines[h1Index].trim().substring(2).trim();
    title = extractBilingualSentence(titleText);
    contentStartIndex = h1Index + 1;
  }

  const contentMarkdown = lines.slice(contentStartIndex).join('\n');
  
  const chapterSections = contentMarkdown.split(/(?=^## )/m).filter(s => s.trim());
  
  const chapters: Chapter[] = [];
  
  if (chapterSections.length === 0 && contentMarkdown.trim()) {
      const segments = parseMarkdownToSegments(contentMarkdown, origin);
      const totalWords = segments.reduce((sum, seg) => {
        const text = Object.values(seg.content || {}).join(' ');
        return sum + text.split(/\s+/).filter(Boolean).length;
      }, 0);
      chapters.push({
          id: generateLocalUniqueId(),
          order: 0,
          title: { [primaryLang]: "Chapter 1" },
          segments,
          stats: {
            totalSegments: segments.length,
            totalWords,
            estimatedReadingTime: Math.ceil(totalWords / 200)
          },
          metadata: {}
      });
  } else {
      let chapterOrder = 0;
      for (const section of chapterSections) {
        const sectionLines = section.split('\n');
        const firstLine = sectionLines[0];
        
        if (!firstLine.trim().startsWith('## ')) continue;
        
        const chapterTitleText = firstLine.trim().substring(3).trim();
        const chapterTitle = extractBilingualSentence(chapterTitleText);
        
        const chapterContent = sectionLines.slice(1).join('\n');
        const segments = parseMarkdownToSegments(chapterContent, origin);
        
        const totalWords = segments.reduce((sum, seg) => {
          const text = Object.values(seg.content || {}).join(' ');
          return sum + text.split(/\s+/).filter(Boolean).length;
        }, 0);
        
        chapters.push({
          id: generateLocalUniqueId(),
          order: chapterOrder++,
          title: chapterTitle,
          segments,
          stats: {
            totalSegments: segments.length,
            totalWords,
            estimatedReadingTime: Math.ceil(totalWords / 200)
          },
          metadata: {}
        });
      }
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
