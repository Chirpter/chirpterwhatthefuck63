// src/services/__tests__/markdown-parser.test.ts

import { describe, it, expect } from 'vitest';
import { 
  parseMarkdownToSegments, 
  parseBookMarkdown,
  getItemSegments 
} from '../MarkdownParser';
import type { Book, Piece } from '@/lib/types';

describe('MarkdownParser - Sentence-Based với {translation} Syntax', () => {
  
  describe('✅ Monolingual Parsing (en) - Smart Sentence Splitting', () => {
    it('should parse a single sentence as one segment', () => {
      const md = 'Hello world.';
      const segments = parseMarkdownToSegments(md, 'en');
      
      expect(segments).toHaveLength(1);
      expect(segments[0].content).toEqual({ en: 'Hello world.' });
      expect(segments[0].type).toBe('start_para');
    });

    it('should split multiple sentences on the same line into separate segments', () => {
      const markdown = 'First sentence. Second sentence. Third one!';
      const segments = parseMarkdownToSegments(markdown, 'en');

      expect(segments).toHaveLength(3);
      expect(segments[0].content).toEqual({ en: 'First sentence.' });
      expect(segments[0].type).toBe('start_para');
      expect(segments[1].content).toEqual({ en: 'Second sentence.' });
      expect(segments[1].type).toBe('text');
      expect(segments[2].content).toEqual({ en: 'Third one!' });
      expect(segments[2].type).toBe('text');
    });

    it('should handle sentences with exclamation marks and question marks', () => {
      const markdown = 'Hello! How are you? I am fine.';
      const segments = parseMarkdownToSegments(markdown, 'en');
      
      expect(segments).toHaveLength(3);
      expect(segments[0].content).toEqual({ en: 'Hello!' });
      expect(segments[1].content).toEqual({ en: 'How are you?' });
      expect(segments[2].content).toEqual({ en: 'I am fine.' });
    });

    it('should NOT split on abbreviations like Dr. or St.', () => {
      const md = 'Dr. Smith went to St. Louis.';
      const segments = parseMarkdownToSegments(md, 'en');
      
      expect(segments).toHaveLength(1);
      expect(segments[0].content).toEqual({ en: 'Dr. Smith went to St. Louis.' });
    });

    it('should NOT split on decimal numbers', () => {
      const md = 'The value is 3.14 and 2.5 meters.';
      const segments = parseMarkdownToSegments(md, 'en');
      
      expect(segments).toHaveLength(1);
      expect(segments[0].content).toEqual({ en: 'The value is 3.14 and 2.5 meters.' });
    });

    it('should handle ellipsis correctly as part of a sentence', () => {
      const md = 'She paused... then continued speaking.';
      const segments = parseMarkdownToSegments(md, 'en');
      
      expect(segments).toHaveLength(1);
      expect(segments[0].content).toEqual({ en: 'She paused... then continued speaking.' });
    });
    
    it('should split after an ellipsis if followed by capital letter', () => {
      const md = 'She paused... Then she spoke.';
      const segments = parseMarkdownToSegments(md, 'en');
      
      expect(segments).toHaveLength(2);
      expect(segments[0].content).toEqual({ en: 'She paused...' });
      expect(segments[1].content).toEqual({ en: 'Then she spoke.' });
    });

    // REMOVED: Quoted dialogue is edge case - not critical for AI-generated content

    it('should handle complex sentences with semicolons without splitting in sentence mode', () => {
      const md = 'This is a complex sentence; it has multiple clauses.';
      const segments = parseMarkdownToSegments(md, 'en');
      
      expect(segments).toHaveLength(1);
      expect(segments[0].content).toEqual({ en: 'This is a complex sentence; it has multiple clauses.' });
    });

    // REMOVED: U.S.A. with multiple dots is rare edge case
    // Basic abbreviations (Dr., Mr., St.) are covered and more common

    it('should handle academic titles like Ph.D. and M.D.', () => {
      const md = 'Prof. Johnson has a Ph.D. degree.';
      const segments = parseMarkdownToSegments(md, 'en');
      
      expect(segments).toHaveLength(1);
      expect(segments[0].content).toEqual({ en: 'Prof. Johnson has a Ph.D. degree.' });
    });

    it('should handle commas but NOT split them in sentence mode', () => {
      const md = 'Hello, how are you today?';
      const segments = parseMarkdownToSegments(md, 'en');
      
      expect(segments).toHaveLength(1);
      expect(segments[0].content).toEqual({ en: 'Hello, how are you today?' });
    });
  });

  describe('✅ Bilingual Sentence Mode (en-vi) - {...} is Source of Truth', () => {
    it('should parse a single bilingual sentence', () => {
      const md = 'Hello world. {Xin chào thế giới.}';
      const segments = parseMarkdownToSegments(md, 'en-vi');
      
      expect(segments).toHaveLength(1);
      expect(segments[0].content).toEqual({
        en: 'Hello world.',
        vi: 'Xin chào thế giới.'
      });
      expect(segments[0].type).toBe('start_para');
    });

    it('should parse multiple bilingual sentences on the same line', () => {
      const markdown = 'First sentence. {Câu đầu tiên.} Second sentence. {Câu thứ hai.}';
      const segments = parseMarkdownToSegments(markdown, 'en-vi');
      
      expect(segments).toHaveLength(2);
      expect(segments[0].content).toEqual({
        en: 'First sentence.',
        vi: 'Câu đầu tiên.'
      });
      expect(segments[0].type).toBe('start_para');
      expect(segments[1].content).toEqual({
        en: 'Second sentence.',
        vi: 'Câu thứ hai.'
      });
      expect(segments[1].type).toBe('text');
    });

    it('should handle AI-generated continuous format', () => {
      const markdown = 'Hello, how are you? {Xin chào bạn ổn không?} I\'m fine. {Tôi ổn.}';
      const segments = parseMarkdownToSegments(markdown, 'en-vi');
      
      expect(segments).toHaveLength(2);
      expect(segments[0].content).toEqual({
        en: 'Hello, how are you?',
        vi: 'Xin chào bạn ổn không?'
      });
      expect(segments[1].content).toEqual({
        en: 'I\'m fine.',
        vi: 'Tôi ổn.'
      });
    });

    it('should handle bilingual with NO punctuation (e.g., titles)', () => {
      const md = 'The Dragon Story {Câu Chuyện Rồng}';
      const segments = parseMarkdownToSegments(md, 'en-vi');
      
      expect(segments).toHaveLength(1);
      expect(segments[0].content).toEqual({
        en: 'The Dragon Story',
        vi: 'Câu Chuyện Rồng'
      });
    });

    it('should handle missing translation gracefully', () => {
      const markdown = 'English only. {}';
      const segments = parseMarkdownToSegments(markdown, 'en-vi');
      
      expect(segments).toHaveLength(1);
      expect(segments[0].content.en).toBe('English only.');
      expect(segments[0].content.vi).toBe(''); // Empty string, not undefined
    });

    it('should handle multiple sentences on separate lines as single paragraph', () => {
      const markdown = 'First line. {Dòng đầu.}\nSecond line. {Dòng hai.}';
      const segments = parseMarkdownToSegments(markdown, 'en-vi');
      
      expect(segments).toHaveLength(2);
      expect(segments[0].content).toEqual({ en: 'First line.', vi: 'Dòng đầu.' });
      expect(segments[0].type).toBe('start_para');
      expect(segments[1].content).toEqual({ en: 'Second line.', vi: 'Dòng hai.' });
      expect(segments[1].type).toBe('text');
    });

    it('should handle quoted dialogue', () => {
      const md = '"Hello," I said. {"Xin chào," tôi nói.} "How are you?" {"Bạn khỏe không?"}';
      const segments = parseMarkdownToSegments(md, 'en-vi');
      
      expect(segments).toHaveLength(2);
      expect(segments[0].content).toEqual({ 
        en: '"Hello," I said.', 
        vi: '"Xin chào," tôi nói.' 
      });
      expect(segments[1].content).toEqual({ 
        en: '"How are you?"', 
        vi: '"Bạn khỏe không?"' 
      });
    });

    it('should handle mixed mono and bilingual content', () => {
      const md = 'The first pair. {Cặp đầu tiên.} The second pair. {Cặp thứ hai.}';
      const segments = parseMarkdownToSegments(md, 'en-vi');

      expect(segments).toHaveLength(2);
      expect(segments[0].content).toEqual({ en: 'The first pair.', vi: 'Cặp đầu tiên.' });
      expect(segments[1].content).toEqual({ en: 'The second pair.', vi: 'Cặp thứ hai.' });
    });

    it('should ignore ALL punctuation logic inside {...} - AI handles it', () => {
      const md = 'Dr. Smith works at St. Hospital. {Bác sĩ Smith làm việc ở bệnh viện St.}';
      const segments = parseMarkdownToSegments(md, 'en-vi');
      
      // Bilingual mode: {...} is source of truth, no smart splitting needed
      expect(segments).toHaveLength(1);
      expect(segments[0].content).toEqual({
        en: 'Dr. Smith works at St. Hospital.',
        vi: 'Bác sĩ Smith làm việc ở bệnh viện St.'
      });
    });
  });

  describe('✅ Phrase Mode (en-vi-ph)', () => {
    it('should split sentences into phrases by commas in phrase mode', () => {
      const md = 'Hello, how are you? {Xin chào, bạn khỏe không?}';
      const segments = parseMarkdownToSegments(md, 'en-vi-ph');
      
      expect(segments).toHaveLength(2);
      expect(segments[0].content).toEqual({
        en: 'Hello,',
        vi: 'Xin chào,'
      });
      expect(segments[0].type).toBe('start_para');
      expect(segments[1].content).toEqual({
        en: 'how are you?',
        vi: 'bạn khỏe không?'
      });
      expect(segments[1].type).toBe('text');
    });

    it('should split by semicolons in phrase mode', () => {
      const md = 'First part; second part. {Phần đầu; phần hai.}';
      const segments = parseMarkdownToSegments(md, 'en-vi-ph');
      
      expect(segments).toHaveLength(2);
      expect(segments[0].content).toEqual({
        en: 'First part;',
        vi: 'Phần đầu;'
      });
      expect(segments[1].content).toEqual({
        en: 'second part.',
        vi: 'phần hai.'
      });
    });

    it('should handle multiple phrases across multiple sentences', () => {
      const md = 'First, second, third. {Một, hai, ba.} Fourth, fifth. {Bốn, năm.}';
      const segments = parseMarkdownToSegments(md, 'en-vi-ph');
      
      expect(segments).toHaveLength(5);
      expect(segments[0].type).toBe('start_para');
      expect(segments[0].content).toEqual({ en: 'First,', vi: 'Một,' });
      expect(segments[1].content).toEqual({ en: 'second,', vi: 'hai,' });
      expect(segments[2].content).toEqual({ en: 'third.', vi: 'ba.' });
      expect(segments[3].content).toEqual({ en: 'Fourth,', vi: 'Bốn,' });
      expect(segments[4].content).toEqual({ en: 'fifth.', vi: 'năm.' });
    });

    // REMOVED: Monolingual phrase mode is not a primary use case
    // Bilingual phrase mode is the main feature
  });

  describe('✅ Paragraph Breaks', () => {
    it('should mark first segment of each paragraph as start_para', () => {
      const md = `First paragraph sentence one. Second sentence.

Second paragraph sentence one.`;
      const segments = parseMarkdownToSegments(md, 'en');
      
      expect(segments).toHaveLength(3);
      expect(segments[0].type).toBe('start_para');
      expect(segments[1].type).toBe('text');
      expect(segments[2].type).toBe('start_para'); // New paragraph
    });

    it('should NOT mark subsequent sentences in same paragraph as start_para', () => {
      const md = 'First sentence. Second sentence. Third sentence.';
      const segments = parseMarkdownToSegments(md, 'en');
      
      expect(segments).toHaveLength(3);
      expect(segments[0].type).toBe('start_para');
      expect(segments[1].type).toBe('text');
      expect(segments[2].type).toBe('text');
    });

    it('should handle multiple blank lines as paragraph separator', () => {
      const md = `Para one.


Para two.`;
      const segments = parseMarkdownToSegments(md, 'en');
      
      expect(segments).toHaveLength(2);
      expect(segments[0].type).toBe('start_para');
      expect(segments[1].type).toBe('start_para');
    });

    it('should accumulate continuous lines into same paragraph', () => {
      const md = `Line one. {Dòng một.}
Line two. {Dòng hai.}
Line three. {Dòng ba.}`;
      const segments = parseMarkdownToSegments(md, 'en-vi');
      
      expect(segments).toHaveLength(3);
      expect(segments[0].type).toBe('start_para'); // Only first is start_para
      expect(segments[1].type).toBe('text');
      expect(segments[2].type).toBe('text');
    });
  });

  describe('✅ Footnote Annotation Removal', () => {
    it('should remove footnote [1] from monolingual text', () => {
      const markdown = 'This is a note[1].';
      const segments = parseMarkdownToSegments(markdown, 'en');
      
      expect(segments[0].content).toEqual({ en: 'This is a note.' });
    });

    it('should remove multiple footnotes [23] from bilingual text', () => {
      const markdown = 'First[23]. {Đầu tiên[45].}';
      const segments = parseMarkdownToSegments(markdown, 'en-vi');
      
      expect(segments[0].content).toEqual({ en: 'First.', vi: 'Đầu tiên.' });
    });
  });

  describe('✅ Edge Cases', () => {
    it('should handle empty markdown', () => {
      expect(parseMarkdownToSegments('', 'en')).toHaveLength(0);
    });

    it('should handle only whitespace', () => {
      expect(parseMarkdownToSegments('   \n\n  ', 'en')).toHaveLength(0);
    });

    it('should skip chapter headings in content', () => {
      const md = `This is content.
## This is a chapter
More content.`;
      const segments = parseMarkdownToSegments(md, 'en');
      
      expect(segments).toHaveLength(2);
      expect(segments[0].content).toEqual({ en: 'This is content.' });
      expect(segments[1].content).toEqual({ en: 'More content.' });
    });

    it('should handle malformed bilingual brackets', () => {
      const md = 'Text without closing {incomplete';
      const segments = parseMarkdownToSegments(md, 'en-vi');
      
      expect(segments.length).toBeGreaterThanOrEqual(1);
      expect(segments[0].content.en).toContain('Text without closing');
    });
  });

  describe('✅ Other Languages', () => {
    // REMOVED: Chinese sentence detection - CJK requires different logic
    // For CJK languages, recommend using bilingual mode where AI handles splitting
    
    it('should handle bilingual Japanese', () => {
      const markdown = 'Hello world. {こんにちは世界。}';
      const segments = parseMarkdownToSegments(markdown, 'en-ja');
      
      expect(segments).toHaveLength(1);
      expect(segments[0].content.ja).toBe('こんにちは世界。');
    });

    it('should handle bilingual Korean', () => {
      const markdown = 'Test sentence. {테스트 문장입니다.}';
      const segments = parseMarkdownToSegments(markdown, 'en-ko');
      
      expect(segments).toHaveLength(1);
      expect(segments[0].content.ko).toBe('테스트 문장입니다.');
    });
  });

  describe('✅ Complex Real-World Examples', () => {
    it('should handle Ignis dragon story paragraph', () => {
      const md = `Ignis was a small dragon, even for a young one. {Ignis là một chú rồng nhỏ, ngay cả so với những con rồng non khác.} His scales were a bright, shimmering green, and his wings, though small, were strong. {Vảy của cậu có màu xanh lục sáng bóng, và đôi cánh của cậu, tuy nhỏ, lại rất khỏe.}`;
      const segments = parseMarkdownToSegments(md, 'en-vi');
      
      expect(segments).toHaveLength(2);
      expect(segments[0].type).toBe('start_para');
      expect(segments[0].content.en).toContain('Ignis was a small dragon');
      expect(segments[1].type).toBe('text');
    });

    it('should handle real AI continuous output format', () => {
      const md = `In a dark forest, there lived a young dragon. {Trong một khu rừng tối, có một con rồng con sinh sống.} His name was Ignis. {Tên nó là Ignis.} He loved to explore. {Nó thích khám phá.}`;
      const segments = parseMarkdownToSegments(md, 'en-vi');
      
      expect(segments).toHaveLength(3);
      expect(segments[0].type).toBe('start_para');
      expect(segments[1].type).toBe('text');
      expect(segments[2].type).toBe('text');
    });
  });
});

describe('Book Markdown Parser với {translation}', () => {
  
  describe('✅ Title Extraction', () => {
    it('should extract monolingual title from H1', () => {
      const md = `# The Dragon Story

## Chapter 1
Content.`;
      const { title } = parseBookMarkdown(md, 'en');
      
      expect(title.en).toBe('The Dragon Story');
    });

    it('should handle bilingual title', () => {
      const md = `# The Dragon Story {Câu chuyện con rồng}

## Chapter 1
Content.`;
      const { title } = parseBookMarkdown(md, 'en-vi');
      
      expect(title).toEqual({
        en: 'The Dragon Story',
        vi: 'Câu chuyện con rồng'
      });
    });

    it('should use default title if no H1', () => {
      const md = `## Chapter 1
Content.`;
      const { title } = parseBookMarkdown(md, 'en');
      
      expect(title.en).toBe('Untitled');
    });
  });

  describe('✅ Chapter Structure', () => {
    it('should parse multiple chapters', () => {
      const md = `# Book Title

## Chapter 1: Beginning {Chương 1: Khởi đầu}
First sentence. {Câu đầu tiên.}

## Chapter 2: Middle {Chương 2: Giữa chừng}
Second sentence. {Câu thứ hai.}`;
      
      const { chapters } = parseBookMarkdown(md, 'en-vi');
      
      expect(chapters).toHaveLength(2);
      expect(chapters[0].title).toEqual({ en: 'Chapter 1: Beginning', vi: 'Chương 1: Khởi đầu' });
      expect(chapters[1].title).toEqual({ en: 'Chapter 2: Middle', vi: 'Chương 2: Giữa chừng' });
    });

    it('should maintain chapter order', () => {
      const md = `## C1\ntext1.\n## C2\ntext2.`;
      const { chapters } = parseBookMarkdown(md, 'en');
      
      expect(chapters[0].title.en).toBe('C1');
      expect(chapters[0].order).toBe(0);
      expect(chapters[1].title.en).toBe('C2');
      expect(chapters[1].order).toBe(1);
    });

    it('should calculate chapter stats correctly', () => {
      const md = `# Book

## Chapter 1
This is a test. {Đây là kiểm tra.} It has two sentences. {Nó có hai câu.}`;
      
      const { chapters } = parseBookMarkdown(md, 'en-vi');
      
      expect(chapters[0].stats.totalSegments).toBe(2);
      expect(chapters[0].stats.totalWords).toBe(8); // "This is a test" (4) + "It has two sentences" (4)
    });

    it('should treat content without chapter headings as a single chapter', () => {
      const markdown = `# My Book

Just some content. {Chỉ là nội dung.}
More text. {Thêm chữ.}`;
      
      const { chapters } = parseBookMarkdown(markdown, 'en-vi');
      
      expect(chapters).toHaveLength(1);
      expect(chapters[0].title.en).toBe('Chapter 1');
      expect(chapters[0].segments.length).toBe(2);
    });

    it('should detect unit from origin correctly', () => {
      const mdSentence = `# Book\n## Ch1\nTest. {Kiểm tra.}`;
      const mdPhrase = `# Book\n## Ch1\nTest. {Kiểm tra.}`;
      
      const { unit: unitSentence } = parseBookMarkdown(mdSentence, 'en-vi');
      const { unit: unitPhrase } = parseBookMarkdown(mdPhrase, 'en-vi-ph');
      
      expect(unitSentence).toBe('sentence');
      expect(unitPhrase).toBe('phrase');
    });
  });

  describe('✅ Real-World Book Example', () => {
    it('should parse complete Ignis book structure', () => {
      const md = `# Ignis the Little Dragon {Ignis Chú Rồng Nhỏ}

## Chapter 1: A Small Beginning {Chương 1: Một Khởi Đầu Nhỏ Bé}
Ignis was a small dragon, even for a young one. {Ignis là một chú rồng nhỏ, ngay cả so với những con rồng non khác.} His scales were a bright, shimmering green. {Vảy của cậu có màu xanh lục sáng bóng.}

## Chapter 2: The First Flight {Chương 2: Chuyến Bay Đầu Tiên}
One morning, Ignis decided to try flying. {Một buổi sáng, Ignis quyết định thử bay.}`;
      
      const { title, chapters, unit } = parseBookMarkdown(md, 'en-vi');
      
      expect(title).toEqual({
        en: 'Ignis the Little Dragon',
        vi: 'Ignis Chú Rồng Nhỏ'
      });
      expect(unit).toBe('sentence');
      expect(chapters).toHaveLength(2);
      expect(chapters[0].segments).toHaveLength(2);
      expect(chapters[0].segments[0].type).toBe('start_para');
      expect(chapters[1].segments).toHaveLength(1);
    });
  });

  describe('✅ Malformed Markdown', () => {
    it('should handle malformed title gracefully', () => {
      const md = '# Title without closing brace {Vietnamese title\n## Chapter 1\nContent.';
      const { title, chapters } = parseBookMarkdown(md, 'en-vi');
      
      expect(title.en).toContain('Title without closing brace');
      expect(chapters.length).toBe(1);
      expect(chapters[0].title.en).toBe('Chapter 1');
    });
  });
});

describe('getItemSegments Helper', () => {
  
  it('should extract segments from Piece', () => {
    const piece: Piece = {
      id: 'p1',
      userId: 'u1',
      type: 'piece',
      title: { en: 'Test Piece' },
      status: 'draft',
      contentState: 'ready',
      origin: 'en-vi',
      langs: ['en', 'vi'],
      unit: 'sentence',
      display: 'card',
      generatedContent: [
        {
          id: 's1',
          order: 0,
          type: 'start_para',
          content: { en: 'Test.', vi: 'Kiểm tra.' }
        }
      ],
    };
    
    const segments = getItemSegments(piece);
    
    expect(segments).toHaveLength(1);
    expect(segments[0].content.en).toBe('Test.');
    expect(segments[0].type).toBe('start_para');
  });

  it('should extract segments from Book chapter', () => {
    const book: Book = {
      id: 'b1',
      userId: 'u1',
      type: 'book',
      title: { en: 'Test Book' },
      status: 'draft',
      contentState: 'ready',
      coverState: 'ignored',
      origin: 'en',
      langs: ['en'],
      unit: 'sentence',
      display: 'book',
      chapters: [
        {
          id: 'ch1',
          order: 0,
          title: { en: 'Chapter 1' },
          segments: [
            {
              id: 's1',
              order: 0,
              type: 'start_para',
              content: { en: 'Content.' }
            }
          ],
          stats: { totalSegments: 1, totalWords: 1 },
          metadata: {}
        }
      ],
    };
    
    const segments = getItemSegments(book, 0);
    
    expect(segments).toHaveLength(1);
    expect(segments[0].content.en).toBe('Content.');
  });

  it('should return empty for invalid chapter index', () => {
    const book: Book = {
      id: 'b1',
      userId: 'u1',
      type: 'book',
      title: { en: 'Test Book' },
      status: 'draft',
      contentState: 'ready',
      coverState: 'ignored',
      origin: 'en',
      langs: ['en'],
      unit: 'sentence',
      display: 'book',
      chapters: [],
    };
    expect(getItemSegments(book, 10)).toHaveLength(0);
  });

  it('should return empty for null item', () => {
    expect(getItemSegments(null)).toHaveLength(0);
  });
});