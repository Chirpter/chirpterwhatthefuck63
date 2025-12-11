// src/services/MarkdownParser.ts - REFACTORED to handle phrase splitting from sentence content

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
 * Splits a single sentence into phrases based on commas and semicolons.
 */
function splitSentenceIntoPhrases(sentence: string): string[] {
  if (!sentence) return [];
  // Split by comma or semicolon, but keep the delimiter attached to the preceding part.
  const parts = sentence.match(/[^,;]+[,;]?/g) || [];
  return parts.map(p => p.trim()).filter(p => p.length > 0);
}

/**
 * Main parser - processes text line-by-line and creates segments.
 * Now handles splitting sentences into phrases if the unit is 'phrase'.
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

    const isNewPara = (segments.length === 0 && trimmedLine !== '') || 
                      (lines[i - 1]?.trim() === '' && trimmedLine !== '');

    if (!trimmedLine || trimmedLine.startsWith('## ')) {
      continue;
    }

    const sentencePairs = extractBilingualSentences(trimmedLine, primaryLang, secondaryLang);

    sentencePairs.forEach((pair, sentenceIndex) => {
      const primarySentence = cleanText(pair[primaryLang]);
      const secondarySentence = secondaryLang ? cleanText(pair[secondaryLang] || '') : undefined;

      if (!primarySentence) return;

      const isFirstSentenceOfPara = sentenceIndex === 0 && isNewPara;

      if (unit === 'phrase' && secondaryLang) {
        // --- PHRASE MODE LOGIC ---
        const primaryPhrases = splitSentenceIntoPhrases(primarySentence);
        const secondaryPhrases = secondarySentence ? splitSentenceIntoPhrases(secondarySentence) : [];

        for (let j = 0; j < primaryPhrases.length; j++) {
          const content: MultilingualContent = {
            [primaryLang]: primaryPhrases[j],
            [secondaryLang]: secondaryPhrases[j] || '',
          };
          
          segments.push({
            id: generateLocalUniqueId(),
            order: segmentOrder++,
            type: 'text',
            content,
            metadata: {
              isNewPara: j === 0 && isFirstSentenceOfPara
            }
          });
        }
      } else {
        // --- SENTENCE MODE LOGIC ---
        const content: MultilingualContent = { [primaryLang]: primarySentence };
        if (secondaryLang) {
          content[secondaryLang] = secondarySentence || '';
        }

        segments.push({
          id: generateLocalUniqueId(),
          order: segmentOrder++,
          type: 'text',
          content,
          metadata: {
            isNewPara: isFirstSentenceOfPara
          }
        });
      }
    });
  }

  return segments;
}

/**
 * Extracts bilingual sentence pairs from a line.
 * Format: "English sentence. {Vietnamese sentence.}"
 */
function extractBilingualSentences(line: string, primaryLang: string, secondaryLang?: string): Array<MultilingualContent> {
  const pairs: Array<MultilingualContent> = [];
  let remainingLine = line;

  if (secondaryLang) {
    const regex = /([^{}]+?)\s*\{([^{}]*)\}/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(line)) !== null) {
      const textBefore = line.substring(lastIndex, match.index).trim();
      if (textBefore) {
        pairs.push({ [primaryLang]: textBefore });
      }
      
      pairs.push({
        [primaryLang]: match[1].trim(),
        [secondaryLang]: match[2].trim()
      });
      lastIndex = regex.lastIndex;
    }
    remainingLine = line.substring(lastIndex);
  }

  if (remainingLine.trim()) {
    pairs.push({ [primaryLang]: remainingLine.trim() });
  }

  return pairs;
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
  let contentAfterTitle = markdown;
  
  const firstH1Index = lines.findIndex(line => line.trim().startsWith('# '));
  if (firstH1Index !== -1) {
    const titleLine = lines[firstH1Index].trim().substring(2).trim();
    title = parseBilingualTitle(titleLine, primaryLang, secondaryLang);
    contentAfterTitle = lines.slice(firstH1Index + 1).join('\n');
  }
  
  const chapterSplitRegex = /^## /m;
  const chapterContents = contentAfterTitle.split(chapterSplitRegex).filter(c => c.trim() !== '');
  const chapters: Chapter[] = [];

  const processChapter = (chapterText: string) => {
    const chapterLines = chapterText.trim().split('\n');
    const chapterTitleLine = chapterLines[0] || `Chapter ${chapters.length + 1}`;
    const chapterContent = chapterLines.slice(1).join('\n');
    
    const chapterTitle = parseBilingualTitle(chapterTitleLine, primaryLang, secondaryLang);
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
  };
  
  if (chapterContents.length === 0 && contentAfterTitle.trim()) {
    processChapter(contentAfterTitle);
    if(chapters[0]) chapters[0].title = { [primaryLang]: 'Chapter 1' };
  } else {
    chapterContents.forEach(processChapter);
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
