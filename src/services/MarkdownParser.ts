

/**
 * @fileoverview Enhanced Markdown Parser - Architecture Aligned
 * This service is the "Editor-in-Chief" for AI-generated content.
 * Its sole responsibility is to take raw Markdown text from the AI and transform it
 * into the standardized, structured `Segment[]` or `Chapter[]` format that our application uses.
 * This centralized approach ensures data consistency and decouples the AI from our
 * internal data structures.
 */

import { remark } from 'remark';
import type { Root, Content } from 'mdast';
import type { 
  Book, 
  Segment,
  Chapter,
  ChapterTitle,
  PhraseMap,
  LibraryItem,
  MultilingualContent,
} from '@/lib/types';
import { generateLocalUniqueId } from '@/lib/utils';

// Helper to extract all text from a node and its children
const extractTextFromNode = (node: Content): string => {
  if (node.type === 'text') {
    return node.value;
  }
  if ('children' in node && Array.isArray(node.children)) {
    return node.children.map(extractTextFromNode).join('');
  }
  return '';
};

/**
 * Enhanced sentence boundary detection with better punctuation handling.
 * It now correctly splits sentences ending with quotes.
 */
function splitIntoSentences(text: string): string[] {
  if (!text) return [];
  // This regex looks for a sentence-ending punctuation mark (. ! ? …)
  // which may be followed by quotes, and then whitespace that is followed by an uppercase letter.
  // This is a common heuristic for sentence splitting. It also handles newlines as sentence breaks.
  const sentenceBoundaryRegex = /(?<=[.!?…]["']?)\s+(?=[A-Z])|\n+/;
  
  return text
    .split(sentenceBoundaryRegex)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}


/**
 * Splits a sentence into smaller phrases based on commas and semicolons.
 */
function splitSentenceIntoPhrases(sentence: string): string[] {
    if (!sentence) return [];
    // This regex matches any sequence of characters that are not a comma or semicolon,
    // optionally followed by a comma or semicolon. It effectively splits by these delimiters.
    return sentence.match(/[^,;]+[,;]?/g) || [sentence];
}

/**
 * Robust bilingual content pairing logic for sentences or phrases using a ' / ' separator.
 */
function pairBilingualContent(items: string[], primaryLang: string, secondaryLang: string | undefined): MultilingualContent[] {
    if (!secondaryLang) {
        return items.map(s => ({ [primaryLang]: s }));
    }

    const pairs: MultilingualContent[] = [];
    
    items.forEach(line => {
        const parts = line.split(/\s+\/\s+/);
        if (parts.length >= 2) {
            pairs.push({
                [primaryLang]: parts[0].trim(),
                [secondaryLang]: parts.slice(1).join(' / ').trim()
            });
        } else {
            // If no separator is found, assign the whole line to the primary language.
            pairs.push({ [primaryLang]: line.trim() });
        }
    });

    return pairs;
}

/**
 * Enhanced word count calculation with better tokenization.
 */
function calculateWordCount(text: string): number {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Detect if text contains dialogue based on various quotation marks.
 */
function detectDialogue(text: string): boolean {
  const dialoguePatterns = [/"[^"]*"/, /'[^']*'/, /«[^»]*»/, /„[^"]*"/, /「[^」]*」/];
  return dialoguePatterns.some(pattern => pattern.test(text));
}

/**
 * MAIN PARSING FUNCTION - Converts a Markdown CHUNK to structured Segments.
 * This is the core logic that transforms raw text blocks into our application's data structure.
 * It now handles the 'phrase' mode by creating the optional `phrases` array.
 */
export function parseMarkdownToSegments(
  markdown: string, 
  origin: string,
): Segment[] {
  if (!markdown || !markdown.trim()) return [];

  const [primaryLanguage, secondaryLanguage, format] = origin.split('-');
  const isPhraseMode = format === 'ph';
  
  const segments: Segment[] = [];
  let globalSegmentOrder = 0;
  
  try {
    const tree = remark().parse(markdown) as Root;
    
    tree.children.forEach((node) => {
        if (node.type !== 'paragraph') return;
        
        const paragraphText = extractTextFromNode(node).trim();
        if (!paragraphText) return;

        const sentences = splitIntoSentences(paragraphText);
        const sentencePairs = pairBilingualContent(sentences, primaryLanguage, secondaryLanguage);
        
        sentencePairs.forEach((sentencePair) => {
            const primaryText = sentencePair[primaryLanguage];
            if (!primaryText) return;

            const segment: Segment = {
                id: generateLocalUniqueId(),
                order: globalSegmentOrder++,
                type: detectDialogue(primaryText) ? 'dialog' : 'text',
                content: sentencePair, // Always store the full sentence
                formatting: {},
                metadata: { isNewPara: false }, // Will be refined later
            };
            
            // --- PHRASE ENHANCEMENT STEP ---
            if (isPhraseMode && secondaryLanguage) {
                const secondaryText = sentencePair[secondaryLanguage] || '';
                const primaryPhrases = splitSentenceIntoPhrases(primaryText);
                const secondaryPhrases = splitSentenceIntoPhrases(secondaryText);
                
                // Simple 1-to-1 mapping based on array index. Assumes AI provides corresponding phrases.
                segment.phrases = primaryPhrases.map((phrase, i) => ({
                    [primaryLanguage]: phrase.trim(),
                    [secondaryLanguage]: (secondaryPhrases[i] || '').trim()
                }));
            }
         
            segments.push(segment);
        });
    });

    // Refine isNewPara metadata based on actual paragraphs from the markdown tree
    let segmentIndex = 0;
    tree.children.forEach(node => {
      if (node.type === 'paragraph' && segmentIndex < segments.length) {
        segments[segmentIndex].metadata.isNewPara = true;
        
        const paragraphText = extractTextFromNode(node).trim();
        const sentenceCount = splitIntoSentences(paragraphText).length;
        segmentIndex += sentenceCount;
      }
    });

  } catch (error) {
    console.error('Error parsing markdown chunk to segments:', error);
    return [];
  }
  
  return segments;
}

/**
 * THE DEFINITIVE PARSER for an entire book's markdown content.
 * It extracts the book title (from H1) and splits the content into structured chapters (from H2).
 * This function now has smarter fallback logic for finding the book title.
 */
export function parseBookMarkdown(
    markdown: string, 
    origin: string
): { title: MultilingualContent; chapters: Chapter[] } {
    const [primaryLanguage, secondaryLanguage] = origin.split('-');
    const lines = markdown.split('\n');
    
    let bookTitleText = 'Untitled Book';
    let contentStartIndex = 0;

    // --- ENHANCED TITLE PARSING ---
    let titleLineIndex = lines.findIndex(line => line.trim().startsWith('# '));
    let titlePrefix = '# ';
    if (titleLineIndex === -1) {
        // Fallback 1: Look for H3
        titleLineIndex = lines.findIndex(line => line.trim().startsWith('### '));
        titlePrefix = '### ';
    }
    
    if (titleLineIndex !== -1) {
        bookTitleText = lines[titleLineIndex].substring(titlePrefix.length).trim();
        contentStartIndex = titleLineIndex + 1;
    } else {
        // Fallback 2: Use the first non-empty line
        const firstNonEmptyLineIndex = lines.findIndex(line => line.trim() !== '');
        if (firstNonEmptyLineIndex !== -1) {
            bookTitleText = lines[firstNonEmptyLineIndex].trim();
            contentStartIndex = firstNonEmptyLineIndex + 1;
        }
    }

    const contentWithoutTitle = lines.slice(contentStartIndex).join('\n').trim();

    // Split content into chapter blocks based on H2 headings
    const chapterBlocks = contentWithoutTitle.split(/\n(?=##\s)/).map(block => block.trim());
    
    const chapters: Chapter[] = chapterBlocks.map((block, index) => {
        const chapterLines = block.split('\n');
        const titleLine = chapterLines.length > 0 ? chapterLines[0].replace(/^##\s*/, '').trim() : `Chapter ${index + 1}`;
        const chapterContentMarkdown = chapterLines.slice(1).join('\n').trim();

        const titleParts = titleLine.split(/\s*[\/|]\s*/).map(p => p.trim());
        const chapterTitle: MultilingualContent = { [primaryLanguage]: titleParts[0] || `Chapter ${index + 1}` };
        if (secondaryLanguage && titleParts[1]) {
            chapterTitle[secondaryLanguage] = titleParts[1];
        }

        const segments = chapterContentMarkdown ? parseMarkdownToSegments(chapterContentMarkdown, origin) : [];
        
        const totalWords = segments.reduce((sum, seg) => sum + (seg.content[primaryLanguage] ? calculateWordCount(seg.content[primaryLanguage]) : 0), 0);

        return {
            id: generateLocalUniqueId(),
            order: index,
            title: chapterTitle,
            segments,
            stats: {
                totalSegments: segments.length,
                totalWords: totalWords,
                estimatedReadingTime: Math.ceil(totalWords / 200),
            },
            metadata: {},
        };
    }).filter(ch => (ch.title[primaryLanguage] && ch.title[primaryLanguage].trim() !== '') || ch.segments.length > 0);

    const finalBookTitle: MultilingualContent = {};
    const titleParts = bookTitleText.split(/\s*[\/|]\s*/).map(t => t.trim());
    finalBookTitle[primaryLanguage] = titleParts[0] || 'Untitled';
    if (secondaryLanguage) {
        finalBookTitle[secondaryLanguage] = titleParts[1] || titleParts[0] || 'Chưa có tiêu đề';
    }

    return { title: finalBookTitle, chapters };
}

/**
 * Retrieves segments for a specific item and chapter index.
 */
export function getItemSegments(item: LibraryItem, chapterIndex: number = 0): Segment[] {
  try {
    if (item.type === 'piece') {
      return item.generatedContent || [];
    } 
    
    if (item.type === 'book') {
      const book = item as Book;
      if (!book.chapters || chapterIndex < 0 || chapterIndex >= book.chapters.length) {
        return [];
      }
      return book.chapters[chapterIndex]?.segments || [];
    }
  } catch (error) {
    console.error('Error getting item segments:', error, {item, chapterIndex});
  }
  
  return [];
}
