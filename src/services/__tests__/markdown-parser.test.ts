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
      expect(segments[0].metadata.isNewPara).toBe(true);
    });

    it('should treat multiple sentences on the same line as multiple segments', () => {
      const markdown = 'First sentence. Second sentence.';
      const segments = parseMarkdownToSegments(markdown, 'en');

      expect(segments).toHaveLength(1);
      expect(segments[0].content.en).toBe('First sentence. Second sentence.');
    });

    it('should detect dialogue', () => {
      const markdown = '"Hello," she said.';
      const segments = parseMarkdownToSegments(markdown, 'en');

      expect(segments[0].type).toBe('dialog');
    });

    it('should handle paragraph breaks correctly', () => {
      const markdown = `First paragraph sentence one.\n\nSecond paragraph sentence.`;
      const segments = parseMarkdownToSegments(markdown, 'en');

      expect(segments).toHaveLength(2);
      expect(segments[0].metadata.isNewPara).toBe(true);
      expect(segments[1].metadata.isNewPara).toBe(true);
    });
  });

  describe('✅ Bilingual Sentence Mode (en-vi)', () => {
    it('should pair bilingual sentences correctly', () => {
      const markdown = 'Hello world. / Xin chào thế giới.';
      const segments = parseMarkdownToSegments(markdown, 'en-vi');

      expect(segments).toHaveLength(1);
      expect(segments[0].content).toEqual({
        en: 'Hello world.',
        vi: 'Xin chào thế giới.'
      });
    });

    it('should handle multiple bilingual sentences on separate lines', () => {
      const markdown = 'First sentence. / Câu đầu tiên.\nSecond sentence. / Câu thứ hai.';
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

  describe('✅ Bilingual Phrase Mode (en-vi-ph)', () => {
    it('should split into phrases and pair them', () => {
      const markdown = 'Hello, world. / Xin chào, thế giới.';
      const segments = parseMarkdownToSegments(markdown, 'en-vi-ph');

      expect(segments).toHaveLength(1);
      expect(segments[0].phrases).toBeDefined();
      expect(segments[0].phrases).toHaveLength(2);
      expect(segments[0].phrases![0]).toEqual({ 
        en: 'Hello,', 
        vi: 'Xin chào,' 
      });
      expect(segments[0].phrases![1]).toEqual({ 
        en: 'world.', 
        vi: 'thế giới.' 
      });
    });

    it('should handle unequal phrase counts', () => {
      const markdown = 'One, two, three. / Một, hai.';
      const segments = parseMarkdownToSegments(markdown, 'en-vi-ph');

      expect(segments).toHaveLength(1);
      expect(segments[0].phrases).toHaveLength(3);
      expect(segments[0].phrases![0]).toEqual({ en: 'One,', vi: 'Một,' });
      expect(segments[0].phrases![1]).toEqual({ en: 'two,', vi: 'hai.' });
      expect(segments[0].phrases![2]).toEqual({ en: 'three.', vi: '' });
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

    it('should remove footnotes in phrase mode', () => {
        const markdown = 'A phrase[4], and another[5]. / Một cụm từ, và một cụm khác.';
        const segments = parseMarkdownToSegments(markdown, 'en-vi-ph');
        expect(segments[0].phrases![0].en).toBe('A phrase,');
        expect(segments[0].phrases![1].en).toBe('and another.');
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
      expect(segments).toHaveLength(1);
      expect(segments[0].content.en).toBe('"Hello," she said. "How are you?"');
      expect(segments[0].type).toBe('dialog');
    });

    it('should handle numbers with decimals', () => {
      const markdown = 'He scored 3.5 points. She scored 4.0.';
      const segments = parseMarkdownToSegments(markdown, 'en');
      expect(segments).toHaveLength(1);
      expect(segments[0].content.en).toContain('3.5');
      expect(segments[0].content.en).toContain('4.0');
    });

    it('should handle ellipsis...', () => {
      const markdown = 'She paused... Then continued.';
      const segments = parseMarkdownToSegments(markdown, 'en');
      expect(segments).toHaveLength(1);
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

    it('should treat multiple newlines as a single paragraph break', () => {
      const markdown = 'Sentence one.\n\n\nSentence two.';
      const segments = parseMarkdownToSegments(markdown, 'en');
      expect(segments).toHaveLength(2);
      expect(segments[0].metadata.isNewPara).toBe(true);
      expect(segments[1].metadata.isNewPara).toBe(true);
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

    it('should handle monolingual Korean', () => {
        const markdown = '이것은 테스트입니다.';
        const segments = parseMarkdownToSegments(markdown, 'ko');
        expect(segments).toHaveLength(1);
        expect(segments[0].content.ko).toBe('이것은 테스트입니다.');
    });
    
    it('should handle bilingual Arabic', () => {
        const markdown = 'Hello. / مرحبا.';
        const segments = parseMarkdownToSegments(markdown, 'en-ar');
        expect(segments).toHaveLength(1);
        expect(segments[0].content.ar).toBe('مرحبا.');
    });

    it('should handle mixed scripts', () => {
      const markdown = 'Hello 你好 Привет.';
      const segments = parseMarkdownToSegments(markdown, 'en');
      expect(segments[0].content.en).toContain('你好');
      expect(segments[0].content.en).toContain('Привет');
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

describe('🔬 Edge Cases - Advanced', () => {
  describe('⚠️ Complex Punctuation', () => {
    it('should handle colon as part of a sentence', () => {
      const markdown = 'Important: read this carefully.';
      const segments = parseMarkdownToSegments(markdown, 'en-vi-ph');

      expect(segments).toHaveLength(1);
    });

    it('should handle multiple punctuation types in one sentence', () => {
      const markdown = 'One, two; three - fourth: fifth. / Một, hai; ba - bốn: năm.';
      const segments = parseMarkdownToSegments(markdown, 'en-vi-ph');

      expect(segments).toHaveLength(1);
    });

    it('should not split sentence on ... ! ? inside a line', () => {
      const markdown = 'Really? Yes! Okay... this is one line.';
      const segments = parseMarkdownToSegments(markdown, 'en');
      expect(segments).toHaveLength(1);
    });
  });

  describe('⚠️ Whitespace Handling', () => {
    it('should handle multiple spaces around separator', () => {
      const markdown = 'English   /   Vietnamese.';
      const segments = parseMarkdownToSegments(markdown, 'en-vi');

      expect(segments[0].content.en).toBe('English');
      expect(segments[0].content.vi).toBe('Vietnamese.');
    });

    it('should handle tabs and mixed whitespace', () => {
      const markdown = 'One.\t\t\n\nTwo.';
      const segments = parseMarkdownToSegments(markdown, 'en');

      expect(segments).toHaveLength(2);
    });
  });

  describe('⚠️ Bilingual Mismatches', () => {
    it('should handle missing secondary language in middle of text', () => {
      const markdown = `First. / Đầu tiên.
Second only in English.
Third. / Thứ ba.`;
      const segments = parseMarkdownToSegments(markdown, 'en-vi');

      expect(segments).toHaveLength(3);
      expect(segments[1].content.vi).toBe('');
    });

    it('should handle separator in monolingual mode', () => {
      const markdown = 'This has a / slash in it.';
      const segments = parseMarkdownToSegments(markdown, 'en');

      expect(segments).toHaveLength(1);
      expect(segments[0].content.en).toContain('/');
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

describe('Markdown Parser - Performance', () => {
  it('should handle large book efficiently', () => {
    const largeMarkdown = `# Large Book

${Array.from({ length: 10 }, (_, i) => `
## Chapter ${i + 1}
${Array.from({ length: 50 }, (_, j) => `Sentence ${j + 1}.`).join(' ')}
`).join('\n')}`;

    const start = performance.now();
    const { chapters } = parseBookMarkdown(largeMarkdown, 'en');
    const duration = performance.now() - start;

    expect(chapters).toHaveLength(10);
    expect(duration).toBeLessThan(1000);
  });

  it('should handle long bilingual content', () => {
    const longSentence = Array.from({ length: 100 }, (_, i) => 
      `Word${i}, / Từ${i},`
    ).join(' ') + ' end. / kết thúc.';

    const start = performance.now();
    const segments = parseMarkdownToSegments(longSentence, 'en-vi-ph');
    const duration = performance.now() - start;

    expect(segments[0].phrases).toBeDefined();
    expect(duration).toBeLessThan(100);
  });
});
