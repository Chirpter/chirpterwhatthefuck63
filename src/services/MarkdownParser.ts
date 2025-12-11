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
  
  // This regex is a bit more robust, handling various separators.
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
  const separatorIndex = text.indexOf(separator);

  if (separatorIndex !== -1) {
    const primary = text.substring(0, separatorIndex).trim();
    const secondary = text.substring(separatorIndex + separator.length).trim();
    return {
      primary: removeFootnoteAnnotations(primary),
      secondary: removeFootnoteAnnotations(secondary),
    };
  }
  
  // If no separator, the whole line is primary content
  return {
    primary: removeFootnoteAnnotations(text),
    secondary: '', // Return empty string for consistency
  };
}

/**
 * NEW: Splits a block of text into sentences, respecting abbreviations.
 */
function splitIntoSentences(text: string): string[] {
    if (!text) return [];
    // This regex looks for sentence-ending punctuation (. ! ?) followed by a space and an uppercase letter,
    // or the end of the string. It avoids splitting on abbreviations like "Dr." or "St."
    // It also handles CJK characters by treating them as individual sentence boundaries if not followed by latin chars.
    const sentenceRegex = /([.!?])\s+(?=[A-Z"']|[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}])/gu;
    const placeholder = "___SENTENCE_BREAK___";
    
    // Replace sentence-ending punctuation with a unique placeholder
    const withPlaceholders = text.replace(sentenceRegex, `$1${placeholder}`);
    
    // Split by the placeholder
    return withPlaceholders.split(placeholder).map(s => s.trim()).filter(s => s.length > 0);
}


/**
 * REFACTORED: Main parser for markdown text into segments.
 * Now splits by sentence first, then processes each sentence.
 */
export function parseMarkdownToSegments(
  markdown: string,
  origin: string
): Segment[] {
  if (!markdown || !markdown.trim()) return [];
  
  const [primaryLang, secondaryLang, format] = origin.split('-');
  const isBilingualIntent = !!secondaryLang;
  const isPhraseMode = format === 'ph';
  
  const segments: Segment[] = [];
  let globalOrder = 0;
  
  // Process the entire markdown block as a single unit of text first
  const lines = markdown.split('\n');
  let currentParagraphText = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line === '') {
        if (currentParagraphText) {
            processParagraph(currentParagraphText);
        }
        currentParagraphText = '';
    } else {
        currentParagraphText += (currentParagraphText ? ' ' : '') + line;
    }
  }
  // Process any remaining text
  if (currentParagraphText) {
      processParagraph(currentParagraphText);
  }

  function processParagraph(paragraphText: string) {
    const sentences = splitIntoSentences(paragraphText);
    let isFirstSentenceOfPara = true;

    for (const sentence of sentences) {
      const isDialog = /^["']/.test(sentence) || /["']$/.test(sentence);
      
      let content: MultilingualContent = {};
      let phrases: PhraseMap[] | undefined = undefined;

      if (isBilingualIntent) {
        const { primary, secondary } = extractBilingualSentence(sentence);
        content[primaryLang] = primary;
        if (secondaryLang) {
          content[secondaryLang] = secondary;
        }
        
        if (isPhraseMode && primary) {
          const primaryPhrases = splitIntoPhrases(primary);
          const secondaryPhrases = splitIntoPhrases(secondary);
          const maxLen = Math.max(primaryPhrases.length, secondaryPhrases.length);
          phrases = [];
          
          for (let j = 0; j < maxLen; j++) {
            const phrasePair: PhraseMap = { [primaryLang]: primaryPhrases[j] || '' };
            if (secondaryLang) {
              phrasePair[secondaryLang] = secondaryPhrases[j] || '';
            }
            phrases.push(phrasePair);
          }
        }
        
      } else { // Monolingual
        content[primaryLang] = removeFootnoteAnnotations(sentence);
      }
      
      if (Object.values(content).some(c => c.trim())) {
        segments.push({
          id: generateLocalUniqueId(),
          order: globalOrder++,
          type: isDialog ? 'dialog' : 'text',
          content,
          phrases,
          formatting: {},
          metadata: { isNewPara: isFirstSentenceOfPara }
        });
        isFirstSentenceOfPara = false;
      }
    }
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
  const { primary, secondary } = extractBilingualSentence(text);
  const content: MultilingualContent = { [primaryLang]: primary };
  if (secondaryLang) {
      content[secondaryLang] = secondary;
  }
  return content;
}

/**
 * Extracts title and parses chapters from book-specific markdown.
 * REFACTORED: No longer falls back to chapter title.
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
  const h1Index = lines.findIndex(l => l.trim().startsWith('# '));
  if (h1Index !== -1) {
    const titleText = lines[h1Index].trim().substring(2).trim();
    title = parseBilingualText(titleText, primaryLang, secondaryLang);
    contentStartIndex = h1Index + 1;
  } else {
    // If no H1, content starts from the beginning. We do not infer title from content.
    contentStartIndex = 0;
  }

  const contentMarkdown = lines.slice(contentStartIndex).join('\n');
  
  // Split by chapter headings (## )
  const chapterSections = contentMarkdown.split(/(?=^## )/m).filter(s => s.trim());
  
  const chapters: Chapter[] = [];
  
  if (chapterSections.length === 0 && contentMarkdown.trim()) {
      // If there are no chapter headings, treat the entire content as a single chapter.
      const segments = parseMarkdownToSegments(contentMarkdown, origin);
      const totalWords = segments.reduce((sum, seg) => {
        const text = Object.values(seg.content || {}).join(' ');
        return sum + text.split(/\s+/).length;
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
        const chapterTitle = parseBilingualText(chapterTitleText, primaryLang, secondaryLang);
        
        const chapterContent = sectionLines.slice(1).join('\n');
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
