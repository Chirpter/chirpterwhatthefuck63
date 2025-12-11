
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
  
  // This regex splits the string by commas, semicolons, colons, or dashes,
  // but it keeps the delimiter attached to the preceding phrase.
  // Example: "One, two; three." -> ["One,", "two;", "three."]
  const phrases = sentence.match(/[^,;:\-]+[,;:\-]?|\S+/g) || [];
  
  return phrases.map(p => p.trim()).filter(p => p.length > 0);
}


/**
 * Extracts primary and secondary language sentences from a bilingual string.
 * Always returns a string for the secondary part, even if empty.
 */
function extractBilingualSentence(
  text: string,
): { primary: string; secondary: string } {
  const separator = ' / ';
  if (text.includes(separator)) {
    const parts = text.split(separator, 2);
    return {
      primary: removeFootnoteAnnotations(parts[0]),
      secondary: removeFootnoteAnnotations(parts[1]),
    };
  }
  // If no separator, the whole line is primary content
  return {
    primary: removeFootnoteAnnotations(text),
    secondary: '', // Return empty string for consistency
  };
}

/**
 * Main parser for markdown text into segments.
 */
export function parseMarkdownToSegments(
  markdown: string,
  origin: string
): Segment[] {
  if (!markdown || !markdown.trim()) return [];
  
  const [primaryLang, secondaryLang, format] = origin.split('-');
  const isBilingual = !!secondaryLang;
  const isPhraseMode = format === 'ph';
  
  const lines = markdown.split('\n');
  const segments: Segment[] = [];
  let globalOrder = 0;
  let previousLineWasEmpty = true;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.length === 0) {
        previousLineWasEmpty = true;
        continue;
    }

    const isDialog = /^["']/.test(trimmedLine) || /["']$/.test(trimmedLine);
    const isNewPara = previousLineWasEmpty;
      
    if (isBilingual) {
      const { primary, secondary } = extractBilingualSentence(trimmedLine);
      const content: MultilingualContent = { [primaryLang]: primary };
      if (secondaryLang) {
        content[secondaryLang] = secondary;
      }
      
      let phrases: PhraseMap[] | undefined = undefined;
      if (isPhraseMode) {
        const primaryPhrases = splitIntoPhrases(primary);
        const secondaryPhrases = splitIntoPhrases(secondary);
        const maxLen = Math.max(primaryPhrases.length, secondaryPhrases.length);
        phrases = [];
        
        for (let i = 0; i < maxLen; i++) {
          const phrasePair: PhraseMap = { [primaryLang]: primaryPhrases[i] || '' };
          if (secondaryLang) {
            phrasePair[secondaryLang] = secondaryPhrases[i] || '';
          }
          phrases.push(phrasePair);
        }
      }
      
      segments.push({
        id: generateLocalUniqueId(),
        order: globalOrder++,
        type: isDialog ? 'dialog' : 'text',
        content,
        phrases,
        formatting: {},
        metadata: { isNewPara }
      });
      
    } else { // Monolingual
      const cleanLine = removeFootnoteAnnotations(trimmedLine);
      segments.push({
        id: generateLocalUniqueId(),
        order: globalOrder++,
        type: isDialog ? 'dialog' : 'text',
        content: { [primaryLang]: cleanLine },
        formatting: {},
        metadata: { isNewPara }
      });
    }

    previousLineWasEmpty = false;
  }
  
  return segments;
}


/**
 * Parses bilingual text, ensuring secondary language is always a string.
 */
function parseBilingualText(
  text: string,
  primaryLang: string,
  secondaryLang?: string
): MultilingualContent {
  const cleanedText = removeFootnoteAnnotations(text);
  if (!secondaryLang) {
    return { [primaryLang]: cleanedText };
  }
  
  const separator = ' / ';
  if (cleanedText.includes(separator)) {
      const parts = cleanedText.split(separator, 2);
      return { 
          [primaryLang]: parts[0]?.trim() || '',
          [secondaryLang]: parts[1]?.trim() || '' // Ensure secondary is always a string
      };
  }

  // If no separator, assume it's all primary language
  return { [primaryLang]: cleanedText };
}

/**
 * Extracts title and parses chapters from book-specific markdown.
 */
export function parseBookMarkdown(
  markdown: string,
  origin: string
): { title: MultilingualContent; chapters: Chapter[] } {
  const [primaryLang, secondaryLang] = origin.split('-');
  const lines = markdown.split('\n').filter(l => l.trim());
  
  let title: MultilingualContent = { [primaryLang]: 'Untitled' };
  let contentStartIndex = 0;

  // Find H1 title
  const h1Index = lines.findIndex(l => l.startsWith('# '));
  if (h1Index !== -1) {
    const titleText = lines[h1Index].substring(2).trim();
    title = parseBilingualText(titleText, primaryLang, secondaryLang);
    contentStartIndex = h1Index + 1;
  } else {
    // Fallback: use first non-empty line that is NOT a chapter heading
    const firstContentLineIndex = lines.findIndex(l => !l.startsWith('## '));
    if (firstContentLineIndex !== -1) {
        title = parseBilingualText(lines[firstContentLineIndex], primaryLang, secondaryLang);
        // We COPY the title, we don't consume the line from content
        contentStartIndex = firstContentLineIndex;
    }
  }

  const contentMarkdown = lines.slice(contentStartIndex).join('\n');
  
  // Split by chapter headings (## )
  const chapterSections = contentMarkdown.split(/(?=^## )/m).filter(s => s.trim());
  
  const chapters: Chapter[] = [];
  let chapterOrder = 0;
  
  for (const section of chapterSections) {
    const sectionLines = section.split('\n');
    const firstLine = sectionLines[0];
    
    if (!firstLine.startsWith('## ')) continue;
    
    const chapterTitleText = firstLine.substring(3).trim();
    const chapterTitle = parseBilingualText(chapterTitleText, primaryLang, secondaryLang);
    
    const chapterContent = sectionLines.slice(1).join('\n').trim();
    const segments = parseMarkdownToSegments(chapterContent, origin);
    
    const totalWords = segments.reduce((sum, seg) => {
      const text = Object.values(seg.content || {}).join(' ');
      return sum + text.split(/\s+/).length;
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
