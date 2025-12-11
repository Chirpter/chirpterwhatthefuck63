// src/services/__tests__/markdown-parser.test.ts - ENHANCED
import { describe, it, expect } from 'vitest';
import { 
  parseMarkdownToSegments, 
  parseBookMarkdown,
  getItemSegments 
} from '../MarkdownParser';
import type { Book, Piece } from '@/lib/types';

describe('Markdown Parser - Basic Functionality', () => {
  describe('✅ Monolingual Parsing (en)', () => {
    it('should parse single sentence with punctuation', () => {
      const markdown = 'This is a test sentence.';
      const segments = parseMarkdownToSegments(markdown, 'en');

      expect(segments).toHaveLength(1);
      expect(segments[0].content.en).toBe('This is a test sentence.');
    });

    it('should treat multiple sentences on the same line as multiple segments', () => {
      const markdown = 'First sentence. Second sentence.';
      const segments = parseMarkdownToSegments(markdown, 'en');

      expect(segments).toHaveLength(2);
      expect(segments[0].content.en).toBe('First sentence.');
      expect(segments[1].content.en).toBe('Second sentence.');
    });

    it('should not create a segment for just whitespace', () => {
        const markdown = 'Sentence. \n\n ';
        const segments = parseMarkdownToSegments(markdown, 'en');
        expect(segments).toHaveLength(1);
    });

    it('should handle paragraph breaks correctly by ignoring them in segment content', () => {
      const markdown = `First paragraph sentence one.\n\nSecond paragraph sentence.`;
      const segments = parseMarkdownToSegments(markdown, 'en');

      expect(segments).toHaveLength(2);
      expect(segments[0].content.en).toBe('First paragraph sentence one.');
      expect(segments[1].content.en).toBe('Second paragraph sentence.');
    });
  });

  describe('✅ Bilingual Sentence Mode (en-vi)', () => {
    it('should pair a single bilingual sentence correctly', () => {
      const markdown = 'Hello world. / Xin chào thế giới.';
      const segments = parseMarkdownToSegments(markdown, 'en-vi');

      expect(segments).toHaveLength(1);
      expect(segments[0].content).toEqual({
        en: 'Hello world.',
        vi: 'Xin chào thế giới.'
      });
    });

    it('should handle multiple bilingual sentences on the same line', () => {
      const markdown = 'First sentence. / Câu đầu tiên. Second sentence. / Câu thứ hai.';
      const segments = parseMarkdownToSegments(markdown, 'en-vi');

      expect(segments).toHaveLength(2);
      expect(segments[0].content).toEqual({
        en: 'First sentence.',
        vi: 'Câu đầu tiên.'
      });
      expect(segments[1].content).toEqual({
        en: 'Second sentence.',
        vi: 'Câu thứ hai.'
      });
    });

    it('should handle missing translation gracefully', () => {
      const markdown = 'Only English sentence. / ';
      const segments = parseMarkdownToSegments(markdown, 'en-vi');

      expect(segments).toHaveLength(1);
      expect(segments[0].content.en).toBe('Only English sentence.');
      expect(segments[0].content.vi).toBe('');
    });
  });

  describe('✅ Footnote Annotation Removal', () => {
    it('should remove footnote [1] from monolingual text', () => {
        const markdown = 'This is a sentence with a note[1].';
        const segments = parseMarkdownToSegments(markdown, 'en');
        expect(segments[0].content.en).toBe('This is a sentence with a note.');
    });

    it('should remove multiple footnotes [2] [3] from bilingual text', () => {
        const markdown = 'Another sentence[2]. / Một câu khác[3].';
        const segments = parseMarkdownToSegments(markdown, 'en-vi');
        expect(segments[0].content.en).toBe('Another sentence.');
        expect(segments[0].content.vi).toBe('Một câu khác.');
    });
  });
});

describe('Markdown Parser - Edge Cases', () => {
  describe('⚠️ Sentence Boundary Detection', () => {
    it('should not split abbreviations like Dr. or St.', () => {
      const markdown = 'Dr. Smith went to St. Louis.';
      const segments = parseMarkdownToSegments(markdown, 'en');
      expect(segments).toHaveLength(1);
    });

    it('should handle quotes correctly', () => {
      const markdown = '"Hello," she said. "How are you?"';
      const segments = parseMarkdownToSegments(markdown, 'en');
      expect(segments).toHaveLength(2);
      expect(segments[0].content.en).toBe('"Hello," she said.');
      expect(segments[1].content.en).toBe('"How are you?"');
    });

    it('should handle numbers with decimals', () => {
      const markdown = 'He scored 3.5 points. She scored 4.0.';
      const segments = parseMarkdownToSegments(markdown, 'en');
      expect(segments).toHaveLength(2);
    });

    it('should handle ellipsis...', () => {
      const markdown = 'She paused... Then continued.';
      const segments = parseMarkdownToSegments(markdown, 'en');
      expect(segments).toHaveLength(1);
      expect(segments[0].content.en).toBe('She paused... Then continued.');
    });
  });

  describe('⚠️ Whitespace Handling', () => {
    it('should handle empty markdown', () => {
      const segments = parseMarkdownToSegments('', 'en');
      expect(segments).toHaveLength(0);
    });

    it('should handle only whitespace', () => {
      const segments = parseMarkdownToSegments('   \n\n  ', 'en');
      expect(segments).toHaveLength(0);
    });
  });

  describe('⚠️ Special Characters & Other Languages', () => {
    it('should handle emoji', () => {
      const markdown = 'Hello 👋 world 🌍!';
      const segments = parseMarkdownToSegments(markdown, 'en');
      expect(segments[0].content.en).toContain('👋');
      expect(segments[0].content.en).toContain('🌍');
    });

    it('should handle monolingual Chinese', () => {
        const markdown = '這是一個測試。';
        const segments = parseMarkdownToSegments(markdown, 'zh');
        expect(segments).toHaveLength(1);
        expect(segments[0].content.zh).toBe('這是一個測試。');
    });

    it('should handle bilingual Japanese', () => {
        const markdown = 'This is a test. / これはテストです。';
        const segments = parseMarkdownToSegments(markdown, 'en-ja');
        expect(segments).toHaveLength(1);
        expect(segments[0].content.ja).toBe('これはテストです。');
    });
    
    it('should handle bilingual Korean', () => {
        const markdown = 'This is a test. / 이것은 테스트입니다.';
        const segments = parseMarkdownToSegments(markdown, 'en-ko');
        expect(segments).toHaveLength(1);
        expect(segments[0].content.ko).toBe('이것은 테스트입니다.');
    });
    
    it('should handle bilingual Arabic', () => {
        const markdown = 'Hello. / مرحبا.';
        const segments = parseMarkdownToSegments(markdown, 'en-ar');
        expect(segments).toHaveLength(1);
        expect(segments[0].content.ar).toBe('مرحبا.');
    });
  });

  describe('⚠️ Bilingual Mismatches', () => {
    it('should treat a line with only English as monolingual within a bilingual text block', () => {
      const markdown = `First. / Đầu tiên.\nSecond only in English.\nThird. / Thứ ba.`;
      const segments = parseMarkdownToSegments(markdown, 'en-vi');
      
      expect(segments).toHaveLength(3);
      expect(segments[1].content).toEqual({ en: 'Second only in English.' });
      expect(segments[1].content.vi).toBeUndefined();
    });

    it('should handle separator in monolingual mode as part of the text', () => {
      const markdown = 'This has a / slash in it.';
      const segments = parseMarkdownToSegments(markdown, 'en');

      expect(segments).toHaveLength(1);
      expect(segments[0].content.en).toContain('/');
    });
  });
});

describe('Book Markdown Parser', () => {
  describe('✅ Title Extraction', () => {
    it('should extract title from H1', () => {
      const markdown = `# My Book Title

## Chapter 1
Content here.`;

      const { title, chapters } = parseBookMarkdown(markdown, 'en');

      expect(title.en).toBe('My Book Title');
      expect(chapters).toHaveLength(1);
    });

    it('should handle bilingual title', () => {
      const markdown = `# English Title / Tiêu đề Tiếng Việt

## Chapter 1 / Chương 1
Content.`;

      const { title } = parseBookMarkdown(markdown, 'en-vi');

      expect(title).toEqual({
        en: 'English Title',
        vi: 'Tiêu đề Tiếng Việt'
      });
    });

    it('should use a default title if markdown has no H1 title', () => {
        const markdown = `## Chapter 1
This content starts with a chapter.`;
        const { title } = parseBookMarkdown(markdown, 'en');
        expect(title.en).toBe('Untitled');
    });
  });

  describe('✅ Chapter Structure', () => {
    it('should parse multiple chapters', () => {
      const markdown = `# Book Title

## Chapter 1
First chapter content.

## Chapter 2
Second chapter content.`;

      const { chapters } = parseBookMarkdown(markdown, 'en');

      expect(chapters).toHaveLength(2);
      expect(chapters[0].title.en).toContain('Chapter 1');
      expect(chapters[1].title.en).toContain('Chapter 2');
    });

    it('should maintain chapter order', () => {
      const markdown = `# Book

## Chapter 1
Content 1.

## Chapter 2
Content 2.

## Chapter 3
Content 3.`;

      const { chapters } = parseBookMarkdown(markdown, 'en');

      expect(chapters[0].order).toBe(0);
      expect(chapters[1].order).toBe(1);
      expect(chapters[2].order).toBe(2);
    });

    it('should calculate chapter stats', () => {
      const markdown = `# Book

## Chapter 1
This is a test sentence with several words.`;

      const { chapters } = parseBookMarkdown(markdown, 'en');

      expect(chapters[0].stats.totalSegments).toBeGreaterThan(0);
      expect(chapters[0].stats.totalWords).toBeGreaterThan(0);
      expect(chapters[0].stats.estimatedReadingTime).toBeGreaterThan(0);
    });
    
    it('should treat content without chapter headings as a single chapter', () => {
        const markdown = `# Book Title
This is content.
This is more content.`;
        const { chapters } = parseBookMarkdown(markdown, 'en');
        expect(chapters).toHaveLength(1);
        expect(chapters[0].title.en).toBe('Chapter 1');
        expect(chapters[0].segments.length).toBe(2);
    });
  });

  describe('⚠️ Malformed Markdown', () => {
    it('should handle nested headings as regular content', () => {
      const markdown = `# Book

## Chapter 1
### Subsection
Content here.`;

      const { chapters } = parseBookMarkdown(markdown, 'en');

      expect(chapters).toHaveLength(1);
      expect(chapters[0].segments[0].content.en).toBe('### Subsection');
    });
  });
});

describe('Get Item Segments Helper', () => {
  it('should extract segments from piece', () => {
    const piece: Piece = {
      id: 'piece-1',
      userId: 'user-1',
      type: 'piece',
      title: { en: 'Test' },
      status: 'draft',
      contentState: 'ready',
      origin: 'en',
      langs: ['en'],
      display: 'card',
      aspectRatio: '3:4',
      generatedContent: [
        {
          id: 'seg1',
          order: 0,
          type: 'text',
          content: { en: 'Test content' },
          formatting: {},
          metadata: { isNewPara: true }
        }
      ],
      isBilingual: false,
    };

    const segments = getItemSegments(piece);

    expect(segments).toHaveLength(1);
    expect(segments[0].content.en).toBe('Test content');
  });

  it('should extract segments from book chapter', () => {
    const book: Book = {
      id: 'book-1',
      userId: 'user-1',
      type: 'book',
      title: { en: 'Test Book' },
      status: 'draft',
      contentState: 'ready',
      coverState: 'ignored',
      origin: 'en',
      langs: ['en'],
      display: 'book',
      chapters: [
        {
          id: 'ch1',
          order: 0,
          title: { en: 'Chapter 1' },
          segments: [
            {
              id: 'seg1',
              order: 0,
              type: 'text',
              content: { en: 'Chapter content' },
              formatting: {},
              metadata: { isNewPara: true }
            }
          ],
          stats: { totalSegments: 1, totalWords: 2, estimatedReadingTime: 1 },
          metadata: {}
        }
      ],
    };

    const segments = getItemSegments(book, 0);

    expect(segments).toHaveLength(1);
    expect(segments[0].content.en).toBe('Chapter content');
  });

  it('should return empty for invalid chapter index', () => {
    const book: Book = {
      id: 'book-1',
      userId: 'user-1',
      type: 'book',
      title: { en: 'Test' },
      status: 'draft',
      contentState: 'ready',
      coverState: 'ignored',
      origin: 'en',
      langs: ['en'],
      display: 'book',
      chapters: [],
    };

    const segments = getItemSegments(book, 999);

    expect(segments).toHaveLength(0);
  });
});
