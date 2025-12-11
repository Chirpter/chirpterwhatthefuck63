// src/services/MarkdownParser.ts

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
 * Parses a line of text into a MultilingualContent object.
 * This is the core logic that handles both sentence and phrase-based bilingual content.
 * @param line - The raw line of text.
 * @param unit - The content unit ('sentence' or 'phrase').
 * @param primaryLang - The primary language code.
 * @param secondaryLang - The secondary language code (if bilingual).
 * @returns A MultilingualContent object.
 */
function parseLineToMultilingualContent(line: string, unit: ContentUnit, primaryLang: string, secondaryLang?: string): MultilingualContent {
    const cleanedLine = line.trim();
    if (!cleanedLine) return {};

    // For monolingual content, the process is simple.
    if (!secondaryLang) {
        return { [primaryLang]: cleanText(cleanedLine) };
    }

    // For bilingual phrase-based content (e.g., "A young boy{Một cậu bé} saw the dragon{nhìn thấy con rồng}")
    if (unit === 'phrase') {
        const parts = cleanedLine.split(/([^{}]+{[^{}]*})/g).filter(Boolean).map(part => {
            const match = part.match(/([^{}]+)\{([^{}]*)\}/);
            return match ? { primary: cleanText(match[1]), secondary: cleanText(match[2]) } : { primary: cleanText(part), secondary: '' };
        });
        
        return {
            [primaryLang]: parts.map(p => p!.primary).join('|'),
            [secondaryLang]: parts.map(p => p!.secondary).join('|'),
        };
    }

    // For bilingual sentence-based content (e.g., "English sentence. {Vietnamese sentence.}")
    const match = cleanedLine.match(/^(.*?)\s*\{(.*)\}\s*$/);
    if (match) {
        return {
            [primaryLang]: cleanText(match[1]),
            [secondaryLang]: cleanText(match[2]),
        };
    }
    
    // Fallback for bilingual content that doesn't match the pattern.
    return { [primaryLang]: cleanedLine };
}


/**
 * Main parser - processes text line-by-line and creates segments.
 * This version determines `isNewPara` by looking at the previous line, making it stateless.
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

    // Determine if this line should start a new paragraph.
    // This is true if it's the first line with content, OR if the previous line was blank.
    const isNewPara = (segments.length === 0 && trimmedLine !== '') || (lines[i - 1]?.trim() === '' && trimmedLine !== '');

    // Skip empty lines and chapter headings (they only serve as separators).
    if (!trimmedLine || trimmedLine.startsWith('##')) {
        continue;
    }
    
    // A simple regex to split by sentences. Handles ., !, ?
    const sentences = trimmedLine.match(/[^.!?]+[.!?]\s*/g) || [trimmedLine];
    
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
                    // A segment starts a new paragraph if it's the first segment of a new line that itself marks a new paragraph.
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
          stats: { totalSegments: segments.length, totalWords, estimatedReadingTime: Math.ceil(totalWords / 200) },
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
        stats: { totalSegments: segments.length, totalWords, estimatedReadingTime: Math.ceil(totalWords / 200) },
        metadata: {}
      });
    });
  }

  return { title, chapters, unit };
}


function calculateTotalWords(segments: Segment[], primaryLang: string): number {
    return segments.reduce((sum, seg) => {
        const text = seg.content[primaryLang] || '';
        // This is a simple split by space. It's not perfectly accurate but good enough for an estimate.
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
    if (book.chapters && book.chapters.length > chapterIndex) {
      return book.chapters[chapterIndex].segments || [];
    }
  }
  
  return [];
}
