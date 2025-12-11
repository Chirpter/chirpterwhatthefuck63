// src/services/__tests__/markdown-parser.test.ts
import { describe, it, expect } from 'vitest';
import { 
  parseMarkdownToSegments, 
  parseBookMarkdown,
  getItemSegments 
} from '../MarkdownParser';
import type { Book, Piece } from '@/lib/types';

describe('MarkdownParser - Final Robust Version', () => {
  
  describe('✅ Monolingual Parsing (en)', () => {
    it('should parse a single sentence as one segment', () => {
      const md = 'Hello world.';
      const segments = parseMarkdownToSegments(md, 'en');
      expect(segments).toHaveLength(1);
      expect(segments[0].content.en).toBe('Hello world.');
    });

    it('should treat multiple sentences on the same line as one segment', () => {
      const markdown = 'First sentence. Second sentence.';
      const segments = parseMarkdownToSegments(markdown, 'en');
      expect(segments).toHaveLength(1);
      expect(segments[0].content.en).toBe('First sentence. Second sentence.');
    });

    it('should handle sentences with exclamation marks and question marks', () => {
      const markdown = 'Hello! How are you? I am fine.';
      const segments = parseMarkdownToSegments(markdown, 'en');
      expect(segments).toHaveLength(1);
      expect(segments[0].content.en).toBe('Hello! How are you? I am fine.');
    });

    it('should NOT split on abbreviations like Dr. or St.', () => {
      const md = 'Dr. Smith went to St. Louis.';
      const segments = parseMarkdownToSegments(md, 'en');
      expect(segments).toHaveLength(1);
      expect(segments[0].content.en).toBe('Dr. Smith went to St. Louis.');
    });

    it('should NOT split on decimal numbers', () => {
      const md = 'The price is $99.99 today.';
      const segments = parseMarkdownToSegments(md, 'en');
      expect(segments).toHaveLength(1);
      expect(segments[0].content.en).toBe('The price is $99.99 today.');
    });
    
    it('should handle ellipsis correctly as part of a sentence', () => {
      const md = 'She paused... then continued.';
      const segments = parseMarkdownToSegments(md, 'en');
      expect(segments).toHaveLength(1);
      expect(segments[0].content.en).toBe('She paused... then continued.');
    });

    it('should handle quoted dialogue correctly', () => {
      const md = '"Hello," she said. "How are you?"';
      const segments = parseMarkdownToSegments(md, 'en');
      expect(segments).toHaveLength(1);
      expect(segments[0].content.en).toBe('"Hello," she said. "How are you?"');
    });

     it('should handle complex sentences with semicolons', () => {
        const md = 'I came; I saw; I conquered. That was easy.';
        const segments = parseMarkdownToSegments(md, 'en');
        expect(segments).toHaveLength(1);
        expect(segments[0].content.en).toBe('I came; I saw; I conquered. That was easy.');
    });
  });

  describe('✅ Bilingual Sentence Mode (en-vi)', () => {
    it('should parse a single bilingual sentence', () => {
      const md = 'Hello world. {Xin chào thế giới.}';
      const segments = parseMarkdownToSegments(md, 'en-vi');
      expect(segments).toHaveLength(1);
      expect(segments[0].content).toEqual({
        en: 'Hello world.',
        vi: 'Xin chào thế giới.'
      });
    });

    it('should parse multiple bilingual sentences on separate lines', () => {
        const md = `First. {Đầu tiên.}
Second. {Thứ hai.}`;
        const segments = parseMarkdownToSegments(md, 'en-vi');
        expect(segments).toHaveLength(2);
        expect(segments[0].content).toEqual({ en: 'First.', vi: 'Đầu tiên.' });
        expect(segments[1].content).toEqual({ en: 'Second.', vi: 'Thứ hai.' });
    });
    
    it('should handle AI-generated continuous format as a single segment', () => {
        const md = "Hello, how are you? {Xin chào bạn ổn không?} I'm fine. {Tôi ổn.}";
        const segments = parseMarkdownToSegments(md, 'en-vi');
        expect(segments).toHaveLength(1);
        expect(segments[0].content).toEqual({
            en: "Hello, how are you? {Xin chào bạn ổn không?} I'm fine.",
            vi: "Tôi ổn."
        });
    });

    it('should handle missing translation gracefully', () => {
      const md = 'English only. {}';
      const segments = parseMarkdownToSegments(md, 'en-vi');
      expect(segments).toHaveLength(1);
      expect(segments[0].content.en).toBe('English only.');
      expect(segments[0].content.vi).toBe('');
    });

    it('should handle quoted dialogue', () => {
      const md = '"Hello," I said. {"Xin chào," tôi nói.}';
      const segments = parseMarkdownToSegments(md, 'en-vi');
      expect(segments).toHaveLength(1);
      expect(segments[0].content.en).toBe('"Hello," I said.');
      expect(segments[0].content.vi).toBe('"Xin chào," tôi nói.');
    });
  });
  
  describe('✅ Paragraph Breaks', () => {
    it('should mark first sentence of a paragraph as isNewPara', () => {
      const md = `First paragraph.

Second paragraph.`;
      const segments = parseMarkdownToSegments(md, 'en');
      expect(segments).toHaveLength(2);
      expect(segments[0].metadata.isNewPara).toBe(true);
      expect(segments[1].metadata.isNewPara).toBe(true);
    });

    it('should NOT mark subsequent sentences in same paragraph as isNewPara', () => {
      const md = `First line.
Second line.`;
      const segments = parseMarkdownToSegments(md, 'en');
      expect(segments).toHaveLength(2);
      expect(segments[0].metadata.isNewPara).toBe(true);
      expect(segments[1].metadata.isNewPara).toBe(false);
    });
  });

  describe('✅ Footnote Annotation Removal', () => {
    it('should remove footnote [1] from monolingual text', () => {
        const markdown = 'This is a sentence with a note[1].';
        const segments = parseMarkdownToSegments(markdown, 'en');
        expect(segments[0].content.en).toBe('This is a sentence with a note.');
    });

    it('should remove multiple footnotes [23] from bilingual text', () => {
        const markdown = 'English part[23]. {Phần Tiếng Việt.[45]}';
        const segments = parseMarkdownToSegments(markdown, 'en-vi');
        expect(segments[0].content.en).toBe('English part.');
        expect(segments[0].content.vi).toBe('Phần Tiếng Việt.');
    });
  });

  describe('✅ Edge Cases', () => {
    it('should handle empty markdown', () => {
      const segments = parseMarkdownToSegments('', 'en');
      expect(segments).toHaveLength(0);
    });

    it('should handle only whitespace', () => {
      const segments = parseMarkdownToSegments('   \n\n  ', 'en');
      expect(segments).toHaveLength(0);
    });
    
    it('should handle emoji', () => {
      const md = 'Hello 👋 world! Nice to meet you. 😊';
      const segments = parseMarkdownToSegments(md, 'en');
      expect(segments).toHaveLength(1);
      expect(segments[0].content.en).toContain('👋');
      expect(segments[0].content.en).toContain('😊');
    });

    it('should skip chapter headings in content', () => {
      const md = `This is content.
## This is a chapter title
More content.`;
      const segments = parseMarkdownToSegments(md, 'en');
      expect(segments).toHaveLength(2);
      expect(segments[0].content.en).toBe('This is content.');
      expect(segments[1].content.en).toBe('More content.');
    });
  });
  
  describe('✅ Other Languages', () => {
    it('should handle Chinese', () => {
      const md = '这是一个测试。这是第二句。';
      const segments = parseMarkdownToSegments(md, 'zh');
      expect(segments).toHaveLength(1);
      expect(segments[0].content.zh).toBe('这是一个测试。这是第二句。');
    });

    it('should handle bilingual Japanese', () => {
        const markdown = 'This is a test. {これはテストです。}';
        const segments = parseMarkdownToSegments(markdown, 'en-ja');
        expect(segments).toHaveLength(1);
        expect(segments[0].content.ja).toBe('これはテストです。');
    });

    it('should handle bilingual Korean', () => {
        const markdown = 'Test. {이것은 테스트입니다.}';
        const segments = parseMarkdownToSegments(markdown, 'en-ko');
        expect(segments).toHaveLength(1);
        expect(segments[0].content.ko).toBe('이것은 테스트입니다.');
    });
    
    it('should handle bilingual Arabic', () => {
        const markdown = 'Hello. {مرحبا.}';
        const segments = parseMarkdownToSegments(markdown, 'en-ar');
        expect(segments).toHaveLength(1);
        expect(segments[0].content.ar).toBe('مرحبا.');
    });
  });

  describe('✅ Complex Real-World Examples', () => {
    it('should handle mixed mono and bilingual content on different lines', () => {
      const markdown = `First pair. {Cặp đầu tiên.}
Second only in English.
Third pair. {Cặp thứ ba.}`;
      const segments = parseMarkdownToSegments(markdown, 'en-vi');
      
      expect(segments).toHaveLength(3);
      expect(segments[0].content).toEqual({ en: 'First pair.', vi: 'Cặp đầu tiên.' });
      expect(segments[1].content).toEqual({ en: 'Second only in English.' });
      expect(segments[2].content).toEqual({ en: 'Third pair.', vi: 'Cặp thứ ba.' });
    });
  });
});

describe('Book Markdown Parser', () => {
  
  describe('✅ Title Extraction', () => {
    it('should extract monolingual title from H1', () => {
      const md = `# My Book Title

## Chapter 1
Content here.`;
      const { title, chapters } = parseBookMarkdown(md, 'en');
      expect(title.en).toBe('My Book Title');
      expect(chapters).toHaveLength(1);
    });

    it('should handle bilingual title', () => {
      const md = `# English Title {Tiêu đề Tiếng Việt}

## Chapter 1
Content.`;
      const { title } = parseBookMarkdown(md, 'en-vi');
      expect(title).toEqual({
        en: 'English Title',
        vi: 'Tiêu đề Tiếng Việt'
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

## Chapter 1
First content.

## Chapter 2
Second content.`;
      const { chapters } = parseBookMarkdown(md, 'en');
      expect(chapters).toHaveLength(2);
      expect(chapters[0].title.en).toBe('Chapter 1');
      expect(chapters[1].title.en).toBe('Chapter 2');
    });

    it('should maintain chapter order', () => {
      const md = `# Book

## Chapter 1
Content 1.

## Chapter 2
Content 2.

## Chapter 3
Content 3.`;
      const { chapters } = parseBookMarkdown(md, 'en');
      expect(chapters[0].order).toBe(0);
      expect(chapters[1].order).toBe(1);
      expect(chapters[2].order).toBe(2);
    });

    it('should calculate chapter stats', () => {
      const md = `# Book

## Chapter 1
This is a test. It has multiple sentences.`;
      const { chapters } = parseBookMarkdown(md, 'en');
      expect(chapters[0].stats.totalSegments).toBe(1);
      expect(chapters[0].stats.totalWords).toBe(8);
      expect(chapters[0].stats.estimatedReadingTime).toBe(1);
    });

    it('should treat content without chapter headings as a single chapter', () => {
        const markdown = `# My Book
This is content.
This is more content.`;
        const { chapters } = parseBookMarkdown(markdown, 'en');
        expect(chapters).toHaveLength(1);
        expect(chapters[0].title.en).toBe('Chapter 1');
        expect(chapters[0].segments.length).toBe(2);
    });

    it('should parse bilingual chapter titles', () => {
      const md = `# Book

## Chapter 1 {Chương 1}
Content. {Nội dung.}`;
      const { chapters } = parseBookMarkdown(md, 'en-vi');
      expect(chapters[0].title).toEqual({
        en: 'Chapter 1',
        vi: 'Chương 1'
      });
    });
  });
  
  describe('✅ Malformed Markdown', () => {
    it('should handle nested headings as regular content', () => {
      const md = `## Chapter 1
### Subsection
Content here.`;
      const { chapters } = parseBookMarkdown(md, 'en');
      
      expect(chapters).toHaveLength(1);
      // The new logic treats each line as a segment if not a chapter heading
      expect(chapters[0].segments).toHaveLength(2);
      expect(chapters[0].segments[0].content.en).toBe('### Subsection');
      expect(chapters[0].segments[1].content.en).toBe('Content here.');
    });
  });
});

describe('getItemSegments Helper', () => {
  
  it('should extract segments from Piece', () => {
    const piece: Piece = {
      id: 'p1',
      userId: 'u1',
      type: 'piece',
      title: { en: 'Test' },
      status: 'draft',
      contentState: 'ready',
      origin: 'en',
      langs: ['en'],
      display: 'card',
      isBilingual: false,
      generatedContent: [
        {
          id: 's1',
          order: 0,
          type: 'text',
          content: { en: 'Test content.' },
          formatting: {},
          metadata: { isNewPara: true }
        }
      ],
    };
    
    const segments = getItemSegments(piece);
    
    expect(segments).toHaveLength(1);
    expect(segments[0].content.en).toBe('Test content.');
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
              type: 'text',
              content: { en: 'Chapter content.' },
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
    expect(segments[0].content.en).toBe('Chapter content.');
  });

  it('should return empty for invalid chapter index', () => {
    const book: Book = {
      id: 'b1',
      userId: 'u1',
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

  it('should return empty for null item', () => {
    const segments = getItemSegments(null);
    expect(segments).toHaveLength(0);
  });
});
