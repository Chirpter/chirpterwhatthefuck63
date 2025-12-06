/**
 * @fileoverview Enhanced Markdown Parser - Architecture Aligned
 * Converts AI markdown output into structured, unified segments.
 * Supports monolingual, and multilingual content by parsing structured pairs.
 */

import { remark } from 'remark';
import type { Root, Content, ListItem } from 'mdast';
import type { 
  LibraryItem, 
  Book, 
  Piece, 
  Chapter, 
  BilingualFormat,
  Segment,
  SegmentMetadata,
  ChapterStats,
  TextFormatting,
  ChapterTitle
} from '@/lib/types';
import { generateLocalUniqueId } from '@/lib/utils';

// Enhanced configuration for parsing
interface ParseConfig {
  isBilingual: boolean;
  bilingualFormat: BilingualFormat;
  primaryLanguage: string;
  secondaryLanguage?: string;
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
 * UPGRADED: A more robust bilingual content pairing logic.
 * It now uses a specific separator ` / ` to pair sentences.
 */
function pairBilingualContent(sentences: string[], config: ParseConfig): { [langCode: string]: string }[] {
    const { primaryLanguage, secondaryLanguage, isBilingual } = config;

    if (!isBilingual || !secondaryLanguage) {
        return sentences.map(s => ({ [primaryLanguage]: s }));
    }

    const pairs: { [langCode: string]: string }[] = [];
    
    sentences.forEach(line => {
        const parts = line.split(/\s+\/\s+/);
        if (parts.length >= 2) {
            pairs.push({
                [primaryLanguage]: parts[0].trim(),
                [secondaryLanguage]: parts.slice(1).join(' / ').trim()
            });
        } else {
            // If there's no separator, assume it's a primary language line
            pairs.push({ [primaryLanguage]: line.trim() });
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
 */
export function parseMarkdownToSegments(
  markdown: string, 
  isBilingual: boolean,
  bilingualFormat: BilingualFormat = 'sentence',
  primaryLanguage: string,
  secondaryLanguage?: string
): Segment[] {
  
  if (!markdown || !markdown.trim()) {
    return [];
  }

  const config: ParseConfig = {
    isBilingual,
    bilingualFormat,
    primaryLanguage,
    secondaryLanguage,
  };

  const segments: Segment[] = [];
  let globalSegmentOrder = 0;
  
  try {
    const tree = remark().parse(markdown) as Root;
    
    tree.children.forEach(node => {
      let isParagraphStart = true;
      
      const processContentNode = (contentNode: Content, isListItem = false) => {
        try {
          switch (contentNode.type) {
            case 'paragraph': {
              const paragraphText = extractTextFromNode(contentNode).trim();
              if (!paragraphText) break;

              const sentences = splitIntoSentences(paragraphText);
              const contentObjects = pairBilingualContent(sentences, config);
              
              contentObjects.forEach((contentObj, index) => {
                 const primaryText = contentObj[config.primaryLanguage];
                 if (!primaryText) return;

                 const isDialogue = detectDialogue(primaryText);
                 
                 segments.push({
                   id: generateLocalUniqueId(),
                   order: globalSegmentOrder++,
                   type: isDialogue ? 'dialog' : 'text',
                   content: contentObj,
                   formatting: {},
                   metadata: {
                     isParagraphStart: isParagraphStart && index === 0 && !isListItem,
                     wordCount: Object.fromEntries(
                        Object.entries(contentObj).map(([lang, text]) => [lang, calculateWordCount(text)])
                     ),
                     primaryLanguage: config.primaryLanguage,
                   }
                 });
              });
              
              break;
            }
            
            case 'heading': {
              const headingText = extractTextFromNode(contentNode).trim();
              const headingDepth = (contentNode as any).depth || 1;
              
              if (headingText) {
                const titleParts = headingText.split(/\s*[\/|]\s*/).map(p => p.trim());
                const contentObj: ChapterTitle = {
                  [config.primaryLanguage]: titleParts[0],
                };
                if (config.isBilingual && config.secondaryLanguage && titleParts[1]) {
                    contentObj[config.secondaryLanguage] = titleParts[1];
                }
                
                segments.push({
                  id: generateLocalUniqueId(),
                  order: globalSegmentOrder++,
                  type: 'heading',
                  content: contentObj,
                  formatting: { headingLevel: headingDepth },
                  metadata: {
                    isParagraphStart: true,
                    wordCount: { [config.primaryLanguage]: calculateWordCount(headingText) },
                    primaryLanguage: config.primaryLanguage,
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
                  content: { [config.primaryLanguage]: imageNode.url },
                  formatting: {},
                  metadata: {
                    isParagraphStart: true,
                    wordCount: { [config.primaryLanguage]: 0 },
                    primaryLanguage: config.primaryLanguage,
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
                        content: { [config.primaryLanguage]: textContent },
                        formatting: {},
                        metadata: {
                            isParagraphStart: isParagraphStart,
                            wordCount: { [config.primaryLanguage]: calculateWordCount(textContent) },
                            primaryLanguage: config.primaryLanguage,
                        }
                    });
                }
                break;
            }
          }
          
          isParagraphStart = false;
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
export function segmentsToChapterStructure(segments: Segment[], primaryLanguage: string = 'en'): Chapter[] {
  const chapters: Chapter[] = [];
  let currentChapter: Chapter | null = null;
  let chapterOrder = 0;

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

  chapters.forEach(chapter => {
    // A heading segment is part of the chapter's identity, not its content count
    chapter.stats.totalSegments = chapter.segments.length;
    
    // Calculate word count from content segments only
    const contentWordCount = chapter.segments.reduce((sum, segment) => {
      // ✅ FIX: Use the segment's own primary language metadata
      const segmentPrimaryLang = segment.metadata.primaryLanguage || primaryLanguage;
      const primaryWords = segment.metadata.wordCount?.[segmentPrimaryLang] || 0;
      return sum + primaryWords;
    }, 0);
    
    const titleWords = calculateWordCount(chapter.title[chapter.metadata.primaryLanguage]);
    
    chapter.stats.totalWords = contentWordCount + titleWords;
    chapter.stats.estimatedReadingTime = Math.ceil(chapter.stats.totalWords / 200);
  });

  return chapters;
}

/**
 * Enhanced function to get segments with better error handling and validation
 */
export function getItemSegments(item: LibraryItem, chapterIndex: number = 0): Segment[] {
  console.log(`[getItemSegments] Called for item: ${item.id}, chapterIndex: ${chapterIndex}`);
  try {
    if (item.type === 'piece') {
      const piece = item as Piece;
      return piece.content || [];
    } 
    
    if (item.type === 'book') {
      const book = item as Book;
      if (!book.chapters || !Array.isArray(book.chapters) || book.chapters.length === 0) {
        console.warn(`[getItemSegments] Book ${item.id} has no chapters.`);
        return [];
      }
      
      if (chapterIndex < 0 || chapterIndex >= book.chapters.length) {
        console.warn(`[getItemSegments] Invalid chapterIndex ${chapterIndex} for book ${item.id} with ${book.chapters.length} chapters.`);
        return [];
      }
      
      const chapter = book.chapters[chapterIndex];
      if (!chapter) {
        console.warn(`[getItemSegments] Chapter at index ${chapterIndex} is undefined for book ${item.id}.`);
        return [];
      }
      
      if (!Array.isArray(chapter.segments)) {
          console.warn(`[getItemSegments] Segments for chapter ${chapterIndex} is not an array for book ${item.id}.`);
          return [];
      }
      
      // A chapter's content IS its segments.
      const segments = chapter.segments || [];
      console.log(`[getItemSegments] Returning ${segments.length} segments for chapter ${chapterIndex}.`);
      return segments;
    }
  } catch (error) {
    console.error('Error getting item segments:', error, {item, chapterIndex});
  }
  
  return [];
}
