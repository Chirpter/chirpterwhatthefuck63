

/**
 * @fileoverview Enhanced Markdown Parser - Architecture Aligned
 * This service is the "Editor-in-Chief" for AI-generated content.
 * Its sole responsibility is to take raw Markdown text from the AI and transform it
 * into the standardized, structured `Segment[]` format that our application uses.
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

// Enhanced configuration for parsing
interface ParseConfig {
  origin: string;
}

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
 * Enhanced sentence boundary detection with better punctuation handling and new separators.
 */
function splitIntoSentences(text: string): string[] {
  if (!text) return [];
  // Regex to split by sentence terminators or newlines.
  const sentenceBoundaryRegex = /(?<=[.!?…])\s+(?=[A-Z])|(?<=[.!?…]["'])\s+(?=[A-Z])|\n/;
  
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
    // Split by comma or semicolon, but keep the delimiter at the end of the phrase.
    // This makes re-joining the sentence easier and more accurate.
    return sentence.match(/[^,;]+[,;]?/g) || [sentence];
}

/**
 * UPGRADED: A more robust bilingual content pairing logic for sentences.
 * It now uses a specific separator ` / ` to pair sentences.
 */
function pairBilingualSentences(sentences: string[], primaryLang: string, secondaryLang: string | undefined): { [langCode: string]: string }[] {
    if (!secondaryLang) {
        return sentences.map(s => ({ [primaryLang]: s }));
    }

    const pairs: { [langCode: string]: string }[] = [];
    
    sentences.forEach(line => {
        const parts = line.split(/\s+\/\s+/);
        if (parts.length >= 2) {
            pairs.push({
                [primaryLang]: parts[0].trim(),
                [secondaryLang]: parts.slice(1).join(' / ').trim()
            });
        } else {
            pairs.push({ [primaryLang]: line.trim() });
        }
    });

    return pairs;
}

/**
 * Enhanced word count calculation with better tokenization
 */
function calculateWordCount(text: string): number {
  if (!text || !text.trim()) return 0;
  
  const words = text
    .trim()
    .replace(/\s+/g, ' ') 
    .split(/\s+/)
    .filter(word => word.length > 0);
    
  return words.length;
}

/**
 * Detect if text contains dialogue based on quotation marks
 */
function detectDialogue(text: string): boolean {
  const dialoguePatterns = [
    /"[^"]*"/,           // Standard quotes
    /'[^']*'/,           // Single quotes  
    /«[^»]*»/,           // French quotes
    /„[^"]*"/,           // German quotes
    /「[^」]*」/,         // Japanese quotes
  ];
  
  return dialoguePatterns.some(pattern => pattern.test(text));
}

/**
 * MAIN PARSING FUNCTION - Converts Markdown to structured Segments
 * This function acts as the "Editor" that takes a chunk of Markdown (e.g., the content of one chapter)
 * and transforms it into the structured data format (`Segment[]`).
 */
export function parseMarkdownToSegments(
  markdown: string, 
  origin: string,
): Segment[] {
  
  if (!markdown || !markdown.trim()) {
    return [];
  }

  const [primaryLanguage, secondaryLanguage, format] = origin.split('-');
  const isPhraseMode = format === 'ph';
  
  const segments: Segment[] = [];
  let globalSegmentOrder = 0;
  
  try {
    const tree = remark().parse(markdown) as Root;
    
    tree.children.forEach(node => {
      let isNewPara = true;
      
      const processContentNode = (contentNode: Content, isListItem = false) => {
        try {
          switch (contentNode.type) {
            case 'paragraph': {
              const paragraphText = extractTextFromNode(contentNode).trim();
              if (!paragraphText) break;

              const sentences = splitIntoSentences(paragraphText);
              const sentencePairs = pairBilingualSentences(sentences, primaryLanguage, secondaryLanguage);
              
              sentencePairs.forEach((sentencePair, index) => {
                 const primaryText = sentencePair[primaryLanguage];
                 if (!primaryText) return;

                 const isDialogue = detectDialogue(primaryText);
                 
                 const segment: Segment = {
                    id: generateLocalUniqueId(),
                    order: globalSegmentOrder++,
                    type: isDialogue ? 'dialog' : 'text',
                    content: sentencePair,
                    formatting: {},
                    metadata: {
                      isNewPara: isNewPara && index === 0 && !isListItem,
                    },
                 };

                 if (secondaryLanguage && isPhraseMode) {
                    const secondaryText = sentencePair[secondaryLanguage] || '';
                    const primaryPhrases = splitSentenceIntoPhrases(primaryText);
                    const secondaryPhrases = splitSentenceIntoPhrases(secondaryText);
                    
                    segment.phrases = primaryPhrases.map((phrase, i) => ({
                        [primaryLanguage]: phrase.trim(),
                        [secondaryLanguage as string]: (secondaryPhrases[i] || '').trim()
                    }));
                 }
                 
                 segments.push(segment);
              });
              
              break;
            }
            
            // Headings and images are typically handled at a higher level (parseBookMarkdown)
            // but we keep basic handling here for flexibility.
            case 'heading':
            case 'image': 
            default: {
                const textContent = extractTextFromNode(contentNode).trim();
                if (textContent) {
                    const type = contentNode.type === 'blockquote' ? 'blockquote' : (isListItem ? 'list_item' : 'text');
                    segments.push({
                        id: generateLocalUniqueId(),
                        order: globalSegmentOrder++,
                        type: type,
                        content: { [primaryLanguage]: textContent },
                        formatting: {},
                        metadata: {
                            isNewPara: isNewPara,
                        }
                    });
                }
                break;
            }
          }
          
          isNewPara = false;
        } catch (error) {
          console.error('Error processing content node:', error);
        }
      };
      
      processContentNode(node);
    });
  } catch (error) {
    console.error('Error parsing markdown:', error);
    return [];
  }
  
  return segments;
}

/**
 * NEW: The primary parser for the entire book's markdown content.
 * It reliably extracts the book title and splits content into structured chapters.
 */
export function parseBookMarkdown(
    markdown: string, 
    origin: string
): { title: MultilingualContent; chapters: Chapter[] } {
    const [primaryLanguage, secondaryLanguage] = origin.split('-');
    
    const lines = markdown.split('\n');
    let bookTitleText = 'Untitled Book';
    let contentStartIndex = 0;

    // 1. Extract Book Title (look for H1 first, then H3, then fallback)
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('# ')) {
            bookTitleText = line.substring(2).trim();
            contentStartIndex = i + 1;
            break;
        }
    }
    
    const contentWithoutTitle = lines.slice(contentStartIndex).join('\n').trim();

    // 2. Split content into chapter blocks based on H2 headings
    const chapterBlocks = contentWithoutTitle.split(/\n(?=##\s)/).map(block => block.trim());
    
    // 3. Process each chapter block
    const chapters: Chapter[] = chapterBlocks.map((block, index) => {
        const chapterLines = block.split('\n');
        const titleLine = chapterLines.length > 0 ? chapterLines[0].replace(/^##\s*/, '').trim() : `Chapter ${index + 1}`;
        const chapterContentMarkdown = chapterLines.slice(1).join('\n').trim();

        // Parse title for bilingualism
        const titleParts = titleLine.split(/\s*[\/|]\s*/).map(p => p.trim());
        const chapterTitle: MultilingualContent = {
            [primaryLanguage]: titleParts[0],
        };
        if (secondaryLanguage && titleParts[1]) {
            chapterTitle[secondaryLanguage] = titleParts[1];
        }

        // Parse content into segments
        const segments = chapterContentMarkdown ? parseMarkdownToSegments(chapterContentMarkdown, origin) : [];
        
        // Calculate stats
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
    });
    
    // 4. Finalize book title object
    const finalBookTitle: MultilingualContent = { [primaryLanguage]: bookTitleText };
    if (secondaryLanguage) {
        const titles = bookTitleText.split(/\s*[\/|]\s*/).map(t => t.trim());
        finalBookTitle[primaryLanguage] = titles[0];
        finalBookTitle[secondaryLanguage] = titles[1] || titles[0];
    }

    return { title: finalBookTitle, chapters };
}


/**
 * Converts unified segments into structured Chapter array.
 * This function is now a legacy helper, `parseBookMarkdown` is the preferred method for new books.
 */
export function segmentsToChapterStructure(segments: Segment[], origin: string): Chapter[] {
  // This logic can be simplified or deprecated if parseBookMarkdown is always used for new content
  const chapters: Chapter[] = [];
  let currentChapter: Chapter | null = null;
  let chapterOrder = 0;
  const [primaryLanguage] = origin.split('-');


  segments.forEach(segment => {
    if (segment.type === 'heading') {
      if (currentChapter) {
        chapters.push(currentChapter);
      }
      
      currentChapter = {
        id: segment.id,
        order: chapterOrder++,
        title: segment.content,
        segments: [], 
        stats: { totalSegments: 0, totalWords: 0, estimatedReadingTime: 0 },
        metadata: {}
      };
    } else {
      if (!currentChapter) {
        currentChapter = {
          id: generateLocalUniqueId(),
          order: chapterOrder++,
          title: { [primaryLanguage]: 'Introduction' },
          segments: [],
          stats: { totalSegments: 0, totalWords: 0, estimatedReadingTime: 0 },
          metadata: {}
        };
      }
      currentChapter.segments.push(segment);
    }
  });

  if (currentChapter) {
    chapters.push(currentChapter);
  }
  
  if (chapters.length === 0 && segments.length > 0) {
    chapters.push({
      id: generateLocalUniqueId(),
      order: 0,
      title: { [primaryLanguage]: 'Content' },
      segments: segments,
      stats: { totalSegments: 0, totalWords: 0, estimatedReadingTime: 0 },
      metadata: {}
    });
  }

  chapters.forEach(chapter => {
    chapter.stats.totalSegments = chapter.segments.length;
    const totalWords = chapter.segments.reduce((sum, segment) => {
        const text = segment.content[primaryLanguage] || '';
        return sum + calculateWordCount(text);
    }, 0);
    chapter.stats.totalWords = totalWords;
    chapter.stats.estimatedReadingTime = Math.ceil(totalWords / 200);
  });

  return chapters;
}

/**
 * Enhanced function to get segments with better error handling and validation
 */
export function getItemSegments(item: LibraryItem, chapterIndex: number = 0): Segment[] {
  try {
    if (item.type === 'piece') {
      return item.generatedContent || [];
    } 
    
    if (item.type === 'book') {
      const book = item as Book;
      if (!book.chapters || !Array.isArray(book.chapters) || book.chapters.length === 0) {
        return [];
      }
      
      if (chapterIndex < 0 || chapterIndex >= book.chapters.length) {
        return [];
      }
      
      const chapter = book.chapters[chapterIndex];
      if (!chapter) {
        return [];
      }
      
      if (!Array.isArray(chapter.segments)) {
          return [];
      }
      
      const segments = chapter.segments || [];
      return segments;
    }
  } catch (error) {
    console.error('Error getting item segments:', error, {item, chapterIndex});
  }
  
  return [];
}
