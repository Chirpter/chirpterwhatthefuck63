// src/services/MarkdownParser.ts - PRODUCTION READY
import type { Segment, Chapter, Book, Piece, MultilingualContent, PhraseMap } from '@/lib/types';
import { generateLocalUniqueId } from '@/lib/utils';

/**
 * ✅ FIX: Improved sentence splitting that KEEPS punctuation
 */
function splitIntoSentences(text: string): string[] {
  if (!text || !text.trim()) return [];
  
  // Split on sentence-ending punctuation while keeping the punctuation
  // Pattern: Match sentence enders (. ! ? :) followed by space or end of string
  const sentenceRegex = /([^.!?:]+[.!?:](?:\s+|$))/g;
  const sentences = text.match(sentenceRegex) || [];
  
  return sentences
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * ✅ FIX: Phrase splitting that preserves punctuation
 */
function splitIntoPhrases(sentence: string): string[] {
  if (!sentence || !sentence.trim()) return [];
  
  // Split on phrase boundaries (,;-:) but keep the punctuation
  const parts = sentence.split(/([,;:\-])/);
  
  const phrases: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) continue;
    
    // If it's a punctuation mark, attach it to the previous phrase
    if ([',', ';', ':', '-'].includes(part)) {
      if (phrases.length > 0) {
        phrases[phrases.length - 1] += part;
      }
    } else {
      phrases.push(part);
    }
  }
  
  return phrases.filter(p => p.length > 0);
}

/**
 * ✅ FIX: Improved bilingual sentence extraction
 */
function extractBilingualSentence(
  text: string,
  primaryLang: string,
  secondaryLang: string
): { primary: string; secondary: string } {
  const parts = text.split(/\s+\/\s+/);
  
  return {
    primary: (parts[0] || '').trim(),
    secondary: (parts[1] || '').trim()
  };
}

/**
 * Main parser for markdown text into segments
 */
export function parseMarkdownToSegments(
  markdown: string,
  origin: string
): Segment[] {
  if (!markdown || !markdown.trim()) return [];
  
  const [primaryLang, secondaryLang, format] = origin.split('-');
  const isPhraseMode = format === 'ph';
  const isBilingual = !!secondaryLang;
  
  const lines = markdown.split('\n').filter(p => p.trim().length > 0);
  const segments: Segment[] = [];
  let globalOrder = 0;
  
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex].trim();
    const isDialog = /^["']/.test(line) || /["']$/.test(line);
      
    if (isBilingual && isPhraseMode) {
      // ✅ Bilingual Phrase Mode
      const { primary, secondary } = extractBilingualSentence(line, primaryLang, secondaryLang);
      
      const primaryPhrases = splitIntoPhrases(primary);
      const secondaryPhrases = splitIntoPhrases(secondary);
      
      const maxLen = Math.max(primaryPhrases.length, secondaryPhrases.length);
      const phrases: PhraseMap[] = [];
      
      for (let i = 0; i < maxLen; i++) {
        phrases.push({
          [primaryLang]: primaryPhrases[i] || '',
          [secondaryLang]: secondaryPhrases[i] || ''
        });
      }
      
      segments.push({
        id: generateLocalUniqueId(),
        order: globalOrder++,
        type: isDialog ? 'dialog' : 'text',
        content: undefined!, // Phrase mode doesn't use content
        phrases,
        formatting: {},
        metadata: {
          isNewPara: lineIndex === 0 || lines[lineIndex - 1].trim() === '',
        }
      });
      
    } else if (isBilingual) {
      // ✅ Bilingual Sentence Mode
      const { primary, secondary } = extractBilingualSentence(line, primaryLang, secondaryLang);
      
      const content: MultilingualContent = {};
      if (primary) content[primaryLang] = primary;
      if (secondary) content[secondaryLang] = secondary;
      
      segments.push({
        id: generateLocalUniqueId(),
        order: globalOrder++,
        type: isDialog ? 'dialog' : 'text',
        content,
        formatting: {},
        metadata: {
          isNewPara: lineIndex === 0 || lines[lineIndex - 1].trim() === '',
        }
      });
      
    } else {
      // ✅ Monolingual Mode
      segments.push({
        id: generateLocalUniqueId(),
        order: globalOrder++,
        type: isDialog ? 'dialog' : 'text',
        content: { [primaryLang]: line },
        formatting: {},
        metadata: {
          isNewPara: lineIndex === 0 || lines[lineIndex - 1].trim() === '',
        }
      });
    }
  }
  
  return segments;
}

/**
 * ✅ FIX: Improved title extraction with better fallbacks
 */
function extractTitle(markdown: string, origin: string): MultilingualContent {
  const [primaryLang, secondaryLang] = origin.split('-');
  const lines = markdown.split('\n').filter(l => l.trim());
  
  // Try H1
  const h1Match = lines.find(l => l.startsWith('# '));
  if (h1Match) {
    const titleText = h1Match.substring(2).trim();
    return parseBilingualText(titleText, primaryLang, secondaryLang);
  }
  
  // Use first non-empty line
  if (lines.length > 0) {
    const firstLine = lines[0].replace(/^#+\s*/, '').trim();
    return parseBilingualText(firstLine, primaryLang, secondaryLang);
  }
  
  return { [primaryLang]: 'Untitled' };
}

function parseBilingualText(
  text: string,
  primaryLang: string,
  secondaryLang?: string
): MultilingualContent {
  if (!secondaryLang) {
    return { [primaryLang]: text };
  }
  
  const parts = text.split(/\s+\/\s+/);
  const result: MultilingualContent = { [primaryLang]: parts[0]?.trim() || text };
  
  if (parts[1]) {
    result[secondaryLang] = parts[1].trim();
  }
  
  return result;
}

/**
 * Parse book-specific markdown with chapters
 */
export function parseBookMarkdown(
  markdown: string,
  origin: string
): { title: MultilingualContent; chapters: Chapter[] } {
  const title = extractTitle(markdown, origin);
  
  // Split by chapter headings (## )
  const chapterSections = markdown.split(/(?=^## )/m).filter(s => s.trim());
  
  const chapters: Chapter[] = [];
  let chapterOrder = 0;
  
  for (const section of chapterSections) {
    const lines = section.split('\n');
    const firstLine = lines[0];
    
    // Skip if not a chapter heading
    if (!firstLine.startsWith('## ')) continue;
    
    const chapterTitleText = firstLine.substring(3).trim();
    const chapterTitle = parseBilingualText(chapterTitleText, ...origin.split('-') as [string, string?]);
    
    const content = lines.slice(1).join('\n').trim();
    const segments = parseMarkdownToSegments(content, origin);
    
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
 * Helper to extract segments from any library item
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
