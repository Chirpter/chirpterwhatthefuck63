// src/services/MarkdownParser.ts - COMPLETELY REWRITTEN

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
 * Improved sentence splitter that handles multiple languages.
 * For CJK languages (Chinese, Japanese, Korean), split on sentence-ending punctuation.
 * For other languages, handle abbreviations and decimals.
 */
function splitIntoSentences(text: string, lang: string = 'en'): string[] {
  if (!text || !text.trim()) return [];
  
  // For Chinese, Japanese, Korean - split on their sentence terminators
  if (lang === 'zh' || lang === 'ja' || lang === 'ko') {
    const sentences: string[] = [];
    let current = '';
    
    for (let i = 0; i < text.length; i++) {
      current += text[i];
      // CJK sentence terminators: 。！？
      if (text[i] === '。' || text[i] === '！' || text[i] === '？') {
        sentences.push(current.trim());
        current = '';
      }
    }
    
    if (current.trim()) {
      sentences.push(current.trim());
    }
    
    return sentences.filter(s => s.length > 0);
  }
  
  // For English and other languages: handle abbreviations
  const sentences: string[] = [];
  const parts = text.split(/([.!?]+\s+)/);
  let current = '';
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    current += part;
    
    // If this is a punctuation + space separator
    if (/[.!?]+\s+$/.test(part)) {
      // Check if next part starts with capital letter (new sentence)
      const nextPart = parts[i + 1];
      if (nextPart && /^[A-Z"]/.test(nextPart.trim())) {
        // Check for abbreviations in current
        const words = current.trim().split(/\s+/);
        const lastWord = words[words.length - 1];
        
        // Common abbreviations: Dr., Mr., Mrs., St., etc.
        if (lastWord && /^[A-Z][a-z]?\.$/i.test(lastWord)) {
          // It's likely an abbreviation, continue
          continue;
        }
        
        sentences.push(current.trim());
        current = '';
      }
    }
  }
  
  if (current.trim()) {
    sentences.push(current.trim());
  }
  
  return sentences.filter(s => s.length > 0);
}

/**
 * Parse bilingual sentence pairs from a line.
 * Format: "English sentence. {Vietnamese sentence.} Another English. {Another Vietnamese.}"
 * Also handles: "English only sentence." (without translation)
 * Returns array of {primary, secondary} pairs.
 */
function extractBilingualPairs(line: string): Array<{primary: string, secondary: string}> {
  const pairs: Array<{primary: string, secondary: string}> = [];
  
  // Match pattern: text followed by {translation}
  const regex = /([^{}]+?)\s*\{([^{}]*)\}/g;
  let lastIndex = 0;
  let match;
  
  while ((match = regex.exec(line)) !== null) {
    // Check if there's text before this match (monolingual sentence)
    const textBefore = line.substring(lastIndex, match.index).trim();
    if (textBefore) {
      pairs.push({
        primary: textBefore,
        secondary: ''
      });
    }
    
    // Add the bilingual pair
    pairs.push({
      primary: match[1].trim(),
      secondary: match[2].trim()
    });
    lastIndex = regex.lastIndex;
  }
  
  // Check if there's remaining text after the last pair (monolingual sentence)
  const remaining = line.substring(lastIndex).trim();
  if (remaining) {
    pairs.push({
      primary: remaining,
      secondary: ''
    });
  }
  
  return pairs;
}

/**
 * Parse phrase-based bilingual content.
 * Format: "A boy{Một cậu bé} saw{nhìn thấy} the dragon{con rồng}"
 */
function parsePhraseBased(line: string, primaryLang: string, secondaryLang: string): MultilingualContent {
  const parts = line.split(/([^{}]+\{[^{}]*\})/g).filter(Boolean).map(part => {
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

    // Skip empty lines and chapter headings (but NOT sub-headings like ###)
    if (!trimmedLine || trimmedLine.startsWith('## ')) {
      continue;
    }
    
    // Handle bilingual content
    if (secondaryLang) {
      if (unit === 'phrase') {
        // Phrase-based: entire line is one segment
        const content = parsePhraseBased(trimmedLine, primaryLang, secondaryLang);
        if (Object.keys(content).length > 0) {
          segments.push({
            id: generateLocalUniqueId(),
            order: segmentOrder++,
            type: 'text',
            content,
            metadata: { isNewPara }
          });
        }
      } else {
        // Sentence-based: extract bilingual pairs
        const pairs = extractBilingualPairs(trimmedLine);
        
        for (let j = 0; j < pairs.length; j++) {
          const pair = pairs[j];
          const content: MultilingualContent = {
            [primaryLang]: cleanText(pair.primary)
          };
          
          // Always include secondary language key, even if empty
          if (pair.secondary !== undefined) {
            content[secondaryLang] = cleanText(pair.secondary);
          }
          
          if (content[primaryLang]) {
            segments.push({
              id: generateLocalUniqueId(),
              order: segmentOrder++,
              type: 'text',
              content,
              metadata: {
                isNewPara: j === 0 && isNewPara
              }
            });
          }
        }
      }
    } else {
      // Monolingual: split into sentences
      const sentences = splitIntoSentences(trimmedLine, primaryLang);
      
      for (let j = 0; j < sentences.length; j++) {
        const sentence = sentences[j];
        const content = { [primaryLang]: cleanText(sentence) };
        
        if (content[primaryLang]) {
          segments.push({
            id: generateLocalUniqueId(),
            order: segmentOrder++,
            type: 'text',
            content,
            metadata: {
              isNewPara: j === 0 && isNewPara
            }
          });
        }
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
  
  // Split by H2 headings to get chapters
  const chapterSplitRegex = /^## /gm;
  const chapters: Chapter[] = [];
  
  // Find all H2 positions
  const h2Matches: Array<{index: number, line: string}> = [];
  const contentLines = contentAfterTitle.split('\n');
  
  for (let i = 0; i < contentLines.length; i++) {
    if (contentLines[i].trim().startsWith('## ')) {
      h2Matches.push({
        index: i,
        line: contentLines[i].trim().substring(3).trim()
      });
    }
  }
  
  // If no H2 headings, treat all content as one chapter
  if (h2Matches.length === 0) {
    if (contentAfterTitle.trim()) {
      const segments = parseMarkdownToSegments(contentAfterTitle, origin);
      if (segments.length > 0) {
        const totalWords = calculateTotalWords(segments, primaryLang);
        chapters.push({
          id: generateLocalUniqueId(),
          order: 0,
          title: { [primaryLang]: 'Chapter 1' },
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
  } else {
    // Process each chapter
    for (let i = 0; i < h2Matches.length; i++) {
      const startIdx = h2Matches[i].index;
      const endIdx = i < h2Matches.length - 1 ? h2Matches[i + 1].index : contentLines.length;
      
      const chapterTitle = parseBilingualTitle(h2Matches[i].line, primaryLang, secondaryLang);
      const chapterContent = contentLines.slice(startIdx + 1, endIdx).join('\n');
      
      const segments = parseMarkdownToSegments(chapterContent, origin);
      if (segments.length > 0) {
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
      }
    }
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