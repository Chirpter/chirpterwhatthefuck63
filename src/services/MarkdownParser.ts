// src/services/MarkdownParser.ts - FINALIZED & COMMENTED

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
 * Parses a line of text into a MultilingualContent object, handling both sentence and phrase units.
 * @param line - The raw line of text.
 * @param unit - The content unit ('sentence' or 'phrase').
 * @param primaryLang - The primary language code.
 * @param secondaryLang - The secondary language code (if bilingual).
 * @returns A MultilingualContent object.
 */
function parseLineToMultilingualContent(line: string, unit: ContentUnit, primaryLang: string, secondaryLang?: string): MultilingualContent {
    const cleanedLine = line.trim();
    if (!cleanedLine) return {};

    if (!secondaryLang) {
        // Monolingual: Content is simple. For phrases, they would need to be pre-joined if on multiple lines.
        return { [primaryLang]: cleanText(cleanedLine) };
    }

    if (unit === 'phrase') {
        // Bilingual phrase mode: "primary {secondary}|primary {secondary}"
        const pairs = cleanedLine.split('|').map(pair => {
            const match = pair.match(/([^{}]+)\{([^{}]*)\}/);
            if (match) {
                return { primary: cleanText(match[1]), secondary: cleanText(match[2]) };
            }
            return null;
        }).filter(Boolean);
        
        return {
            [primaryLang]: pairs.map(p => p!.primary).join(' | '),
            [secondaryLang]: pairs.map(p => p!.secondary).join(' | '),
        };
    }

    // Bilingual sentence mode: "primary sentence. {secondary sentence.}"
    const match = cleanedLine.match(/^(.*?)\s*\{(.*)\}\s*$/);
    if (match) {
        return {
            [primaryLang]: cleanText(match[1]),
            [secondaryLang]: cleanText(match[2]),
        };
    }
    
    // Fallback for lines that might not have a translation (e.g., monolingual line in a bilingual context)
    return { [primaryLang]: cleanedLine };
}


/**
 * Main parser - processes text line-by-line and creates segments.
 */
export function parseMarkdownToSegments(markdown: string, origin: string): Segment[] {
  const [primaryLang, secondaryLang, formatFlag] = origin.split('-');
  const unit: ContentUnit = formatFlag === 'ph' ? 'phrase' : 'sentence';

  const lines = markdown.split('\n');
  const segments: Segment[] = [];
  
  // ========================================================================
  // BẮT ĐẦU LOGIC isNewPara
  // Đây chính là biến trạng thái để theo dõi đoạn văn mới.
  // ========================================================================
  let isNewParaNext = true;

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (trimmedLine.startsWith('#')) {
        continue; // Bỏ qua tất cả các dòng heading
    }

    // KHI GẶP DÒNG TRỐNG:
    // Reset cờ, báo hiệu rằng bất kỳ nội dung nào tiếp theo sẽ là một đoạn mới.
    if (!trimmedLine) {
      isNewParaNext = true;
      continue;
    }
    
    // ========================================================================
    // KHI GẶP DÒNG CÓ CHỮ:
    // ========================================================================
    const sentences = trimmedLine.match(/[^.!?]+[.!?]\s*/g) || [trimmedLine];

    for (const sentence of sentences) {
        const content = parseLineToMultilingualContent(sentence, unit, primaryLang, secondaryLang);
        
        if (Object.keys(content).length > 0) {
            segments.push({
                id: generateLocalUniqueId(),
                order: segments.length,
                type: 'text',
                content: content,
                metadata: {
                    // Gán giá trị hiện tại của cờ vào segment.
                    isNewPara: isNewParaNext,
                }
            });
            
            // SAU KHI GÁN:
            // Đặt ngay lại cờ thành false. Chỉ có segment đầu tiên của một khối
            // văn bản mới được coi là bắt đầu một đoạn mới.
            isNewParaNext = false;
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
): { title: MultilingualContent; chapters: Chapter[] } {
  const [primaryLang, secondaryLang] = origin.split('-');
  const lines = markdown.split('\n');
  
  let title: MultilingualContent = { [primaryLang]: 'Untitled' };
  let contentStartIndex = 0;
  
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

  if (chapterParts.length <= 1) {
    if (contentAfterTitle.trim()) {
      processChapterContent(contentAfterTitle, 0, 'Chapter 1');
    }
  } else {
    if (chapterParts[0].trim()) {
        processChapterContent(chapterParts[0], 0, 'Introduction');
    }

    chapterParts.slice(1).forEach((part, index) => {
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

  return { title, chapters };
}


function calculateTotalWords(segments: Segment[], primaryLang: string): number {
    return segments.reduce((sum, seg) => {
        const text = seg.content[primaryLang]?.split('|').join(' ') || '';
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
    return item.generatedContent || [];
  }
  
  if (item.type === 'book') {
    const chapter = (item.chapters || [])[chapterIndex];
    return chapter?.segments || [];
  }
  
  return [];
}
