

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
 * This function acts as the "Editor" that takes the raw AI manuscript (Markdown)
 * and transforms it into the structured data format (`Segment[]`) that our application uses.
 * This separation of concerns is critical for reliability and control.
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
            
            case 'heading': {
              const headingText = extractTextFromNode(contentNode).trim();
              const headingDepth = (contentNode as any).depth || 1;
              
              if (headingText) {
                const titleParts = headingText.split(/\s*[\/|]\s*/).map(p => p.trim());
                const contentObj: ChapterTitle = {
                  [primaryLanguage]: titleParts[0],
                };
                if (secondaryLanguage && titleParts[1]) {
                    contentObj[secondaryLanguage] = titleParts[1];
                }
                
                segments.push({
                  id: generateLocalUniqueId(),
                  order: globalSegmentOrder++,
                  type: 'heading',
                  content: contentObj,
                  formatting: { headingLevel: headingDepth },
                  metadata: {
                    isNewPara: true,
                  }
                });
              }
              break;
            }
            
            case 'image': {
              const imageNode = contentNode as any;
              if (imageNode.url) {
                segments.push({
                  id: generateLocalUniqueId(),
                  order: globalSegmentOrder++,
                  type: 'image',
                  content: { [primaryLanguage]: imageNode.url },
                  formatting: {},
                  metadata: {
                    isNewPara: true,
                  }
                });
              }
              break;
            }
            
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
 * Converts unified segments into structured Chapter array with enhanced stats
 */
export function segmentsToChapterStructure(segments: Segment[], origin: string): Chapter[] {
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
        segments: [], // Start with no segments, add non-heading segments below
        stats: { totalSegments: 0, totalWords: 0, estimatedReadingTime: 0 },
        metadata: {
          primaryLanguage: primaryLanguage,
        }
      };
    } else {
      if (!currentChapter) {
        // Create a default first chapter if content starts without a heading
        currentChapter = {
          id: generateLocalUniqueId(),
          order: chapterOrder++,
          title: { [primaryLanguage]: 'Introduction' },
          segments: [],
          stats: { totalSegments: 0, totalWords: 0, estimatedReadingTime: 0 },
          metadata: {
            primaryLanguage: primaryLanguage,
          }
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
      metadata: {
        primaryLanguage: primaryLanguage,
      }
    });
  }

  // Calculate stats for each chapter
  chapters.forEach(chapter => {
    chapter.stats.totalSegments = chapter.segments.length;
    
    const totalWords = chapter.segments.reduce((sum, segment) => {
        const text = segment.content[primaryLanguage] || '';
        return sum + calculateWordCount(text);
    }, 0);
    
    chapter.stats.totalWords = totalWords;
    chapter.stats.estimatedReadingTime = Math.ceil(totalWords / 200); // Avg reading speed
  });

  return chapters;
}

/**
 * Enhanced function to get segments with better error handling and validation
 */
export function getItemSegments(item: LibraryItem, chapterIndex: number = 0): Segment[] {
  try {
    if (item.type === 'piece') {
      return item.content || [];
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
      
      // A chapter's content IS its segments.
      const segments = chapter.segments || [];
      return segments;
    }
  } catch (error) {
    console.error('Error getting item segments:', error, {item, chapterIndex});
  }
  
  return [];
}
