// src/services/MarkdownParser.ts - FIXED VERSION

import type { Segment, Chapter, Book, Piece, MultilingualContent, ContentUnit } from '@/lib/types';
import { generateLocalUniqueId } from '@/lib/utils';

/**
 * Removes footnote annotations like [1], [23] and trims whitespace.
 */
function cleanText(text: string): string {
  if (!text) return '';
  return text.replace(/\[\d+\]/g, '').trim();
}

/**
 * Improved sentence splitter that handles edge cases.
 * Splits on . ! ? but avoids common abbreviations and decimals.
 */
function splitIntoSentences(text: string): string[] {
  if (!text || !text.trim()) return [];
  
  const sentences: string[] = [];
  let current = '';
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    current += char;
    
    // Check if we hit a sentence terminator
    if (char === '.' || char === '!' || char === '?') {
      const next = text[i + 1];
      const prev = text[i - 1];
      
      // Don't split on abbreviations (Dr., St., Mr., etc.)
      if (char === '.' && prev && /[A-Z]/.test(prev) && next === ' ') {
        const wordBefore = current.trim().split(/\s+/).pop() || '';
        if (wordBefore.length <= 3 && /^[A-Z][a-z]?\.?$/.test(wordBefore)) {
          continue; // It's likely an abbreviation
        }
      }
      
      // Don't split on decimals (3.14)
      if (char === '.' && prev && /\d/.test(prev) && next && /\d/.test(next)) {
        continue;
      }
      
      // Don't split on ellipsis unless followed by capital letter
      if (char === '.' && text[i - 1] === '.' && text[i - 2] === '.') {
        if (!next || next === ' ' && text[i + 2] && /[a-z]/.test(text[i + 2])) {
          continue; // Keep ellipsis with the sentence
        }
      }
      
      // Split if followed by space + capital letter OR end of string
      if (!next || (next === ' ' && text[i + 2] && /[A-Z"]/.test(text[i + 2])) || next && /[A-Z"]/.test(next)) {
        sentences.push(current.trim());
        current = '';
      }
    }
  }
  
  // Add remaining content
  if (current.trim()) {
    sentences.push(current.trim());
  }
  
  return sentences.filter(s => s.length > 0);
}

/**
 * Parses a line of text into a MultilingualContent object.
 * Handles both sentence and phrase-based bilingual content.
 */
function parseLineToMultilingualContent(
  line: string, 
  unit: ContentUnit, 
  primaryLang: string, 
  secondaryLang?: string
): MultilingualContent {
  const cleanedLine = line.trim();
  if (!cleanedLine) return {};

  // Monolingual: simple case
  if (!secondaryLang) {
    return { [primaryLang]: cleanText(cleanedLine) };
  }

  // Bilingual phrase-based: "A young boy{Một cậu bé} saw{nhìn thấy}"
  if (unit === 'phrase') {
    const parts = cleanedLine.split(/([^{}]+\{[^{}]*\})/g).filter(Boolean).map(part => {
      const match = part.match(/([^{}]+)\{([^{}]*)\}/);
      return match 
        ? { primary: cleanText(match[1]), secondary: cleanText(match[2]) } 
        : { primary: cleanText(part), secondary: '' };
    });
    
    return {
      [primaryLang]: parts.map(p => p.primary).join('|'),
      [secondaryLang]: parts.map(p => p.secondary).join('|'),
    };
  }

  // Bilingual sentence-based: "English sentence. {Vietnamese sentence.}"
  const match = cleanedLine.match(/^(.*?)\s*\{(.*)\}\s*$/);
  if (match) {
    return {
      [primaryLang]: cleanText(match[1]),
      [secondaryLang]: cleanText(match[2]),
    };
  }
  
  // Fallback: treat as monolingual primary
  return { [primaryLang]: cleanText(cleanedLine) };
}

/**
 * Main parser - processes text line-by-line and creates segments.
 */
export function parseMarkdownToSegments(markdown: string, origin: string): Segment[] {
  const [primaryLang, secondaryLang, format] = origin.split('-');
  const unit: ContentUnit = format === 'ph' ? 'phrase' : 'sentence';

  const lines = markdown.split('\n');
  const segments: Segment[] = [];
  
  let segmentOrder = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Determine if this line should start a new paragraph
    const isNewPara = (segments.length === 0 && trimmedLine !== '') || 
                      (lines[i - 1]?.trim() === '' && trimmedLine !== '');

    // Skip empty lines and chapter headings
    if (!trimmedLine || trimmedLine.startsWith('##')) {
      continue;
    }
    
    // Use improved sentence splitter
    const sentences = splitIntoSentences(trimmedLine);
    
    for (let j = 0; j < sentences.length; j++) {
      const sentence = sentences[j];
      const content = parseLineToMultilingualContent(sentence, unit, primaryLang, secondaryLang);
      
      if (Object.keys(content).length > 0 && Object.values(content)[0] !== '') {
        segments.push({
          id: generateLocalUniqueId(),
          order: segmentOrder++,
          type: 'text',
          content: content,
          metadata: {
            isNewPara: j === 0 && isNewPara,
          }
        });
      }
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
): { title: MultilingualContent; chapters: Chapter[]; unit: ContentUnit } {
  const [primaryLang, secondaryLang, format] = origin.split('-');
  const unit: ContentUnit = format === 'ph' ? 'phrase' : 'sentence';
  const lines = markdown.split('\n');
  
  let title: MultilingualContent = { [primaryLang]: 'Untitled' };
  let contentStartIndex = 0;
  
  // Find the first H1 to use as the book title
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('# ')) {
      const titleText = line.substring(2).trim();
      title = parseBilingualTitle(titleText, primaryLang, secondaryLang);
      contentStartIndex = i + 1;
      break;
    }
  }
  
  const contentAfterTitle = lines.slice(contentStartIndex).join('\n');
  
  // Split the rest of the content by H2 to get chapters
  const chapterParts = contentAfterTitle.split(/\n## /);

  const chapters: Chapter[] = [];
  
  const processChapterContent = (content: string, order: number, defaultTitle: string) => {
    const segments = parseMarkdownToSegments(content, origin);
    if (segments.length === 0) return;
    
    const totalWords = calculateTotalWords(segments, primaryLang);
    chapters.push({
      id: generateLocalUniqueId(),
      order: order,
      title: { [primaryLang]: defaultTitle },
      segments,
      stats: { 
        totalSegments: segments.length, 
        totalWords, 
        estimatedReadingTime: Math.ceil(totalWords / 200) 
      },
      metadata: {}
    });
  };

  // If there are no '##' headings, treat the whole content as a single chapter
  if (chapterParts.length <= 1) {
    if (contentAfterTitle.trim()) {
      processChapterContent(contentAfterTitle, 0, 'Chapter 1');
    }
  } else {
    // If the first part (before the first '##') has content, treat it as an introduction
    if (chapterParts[0].trim()) {
      processChapterContent(chapterParts[0], 0, 'Introduction');
    }

    // Process each subsequent chapter part
    chapterParts.slice(1).forEach((part) => {
      const partLines = part.split('\n');
      const chapterTitleLine = partLines[0].trim();
      const chapterContent = partLines.slice(1).join('\n');
      
      const chapterTitle = parseBilingualTitle(chapterTitleLine, primaryLang, secondaryLang);
      const segments = parseMarkdownToSegments(chapterContent, origin);
      const totalWords = calculateTotalWords(segments, primaryLang);

      chapters.push({
        id: generateLocalUniqueId(),
        order: chapters.length,
        title: chapterTitle,
        segments,
        stats: { 
          totalSegments: segments.length, 
          totalWords, 
          estimatedReadingTime: Math.ceil(totalWords / 200) 
        },
        metadata: {}
      });
    });
  }

  return { title, chapters, unit };
}

function calculateTotalWords(segments: Segment[], primaryLang: string): number {
  return segments.reduce((sum, seg) => {
    const text = seg.content[primaryLang] || '';
    return sum + (text.split(/\s+/).filter(Boolean).length || 0);
  }, 0);
}

function parseBilingualTitle(text: string, primaryLang: string, secondaryLang?: string): MultilingualContent {
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
    return (item as Piece).generatedContent || [];
  }
  
  if (item.type === 'book') {
    const book = item as Book;
    const chapter = book.chapters?.[chapterIndex];
    return chapter?.segments || [];
  }
  
  return [];
}