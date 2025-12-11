// src/services/__tests__/markdown-parser.test.ts - FINAL, ROBUST VERSION
import { describe, it, expect } from 'vitest';
import { 
  parseMarkdownToSegments, 
  parseBookMarkdown,
  getItemSegments 
} from '../MarkdownParser';
import type { Book, Piece } from '@/lib/types';

describe('MarkdownParser - Sentence-Based Parsing', () => {
  
  // ===================================
  // Monolingual Parsing
  // ===================================
  describe('Monolingual - English', () => {
    it('should parse single sentence as one segment', () => {
      const md = 'Hello world.';
      const segments = parseMarkdownToSegments(md, 'en');
      expect(segments).toHaveLength(1);
      expect(segments[0].content.en).toBe('Hello world.');
    });

    it('should split multiple sentences on same line into separate segments', () => {
      const md = 'First sentence. Second sentence.';
      const segments = parseMarkdownToSegments(md, 'en');
      expect(segments).toHaveLength(2);
      expect(segments[0].content.en).toBe('First sentence.');
      expect(segments[1].content.en).toBe('Second sentence.');
    });

    it('should handle sentences with exclamation marks', () => {
      const md = 'Hello! How are you? I am fine.';
      const segments = parseMarkdownToSegments(md, 'en');
      expect(segments).toHaveLength(3);
      expect(segments[0].content.en).toBe('Hello!');
      expect(segments[1].content.en).toBe('How are you?');
      expect(segments[2].content.en).toBe('I am fine.');
    });

    it('should NOT split on abbreviations like Dr. Mr. etc.', () => {
      const md = 'Dr. Smith went to St. Louis.';
      const segments = parseMarkdownToSegments(md, 'en');
      expect(segments).toHaveLength(1);
      expect(segments[0].content.en).toBe('Dr. Smith went to St. Louis.');
    });

    it('should NOT split on decimal numbers', () => {
      const md = 'The score was 3.5 points.';
      const segments = parseMarkdownToSegments(md, 'en');
      expect(segments).toHaveLength(1);
      expect(segments[0].content.en).toBe('The score was 3.5 points.');
    });

    it('should handle ellipsis without splitting mid-sentence', () => {
        const md = 'She paused... then continued.';
        const segments = parseMarkdownToSegments(md, 'en');
        expect(segments).toHaveLength(1);
        expect(segments[0].content.en).toBe('She paused... then continued.');
    });

    it('should split ellipsis when followed by new sentence', () => {
      const md = 'She paused... Then she continued.';
      const segments = parseMarkdownToSegments(md, 'en');
      expect(segments).toHaveLength(2);
      expect(segments[0].content.en).toBe('She paused...');
      expect(segments[1].content.en).toBe('Then she continued.');
    });

    it('should handle quotes correctly', () => {
      const md = '"Hello," she said. "How are you?"';
      const segments = parseMarkdownToSegments(md, 'en');
      expect(segments).toHaveLength(2);
      expect(segments[0].content.en).toBe('"Hello," she said.');
      expect(segments[1].content.en).toBe('"How are you?"');
    });
    
    it('should handle complex sentences with semicolons', () => {
        const md = 'I came; I saw; I conquered. That was easy.';
        const segments = parseMarkdownToSegments(md, 'en');
        expect(segments).toHaveLength(2);
        expect(segments[0].content.en).toBe('I came; I saw; I conquered.');
        expect(segments[1].content.en).toBe('That was easy.');
    });
  });

  // ===================================
  // Bilingual Parsing
  // ===================================
  describe('Bilingual - English/Vietnamese', () => {
    it('should parse single bilingual sentence', () => {
      const md = 'Hello world. / Xin chào thế giới.';
      const segments = parseMarkdownToSegments(md, 'en-vi');
      expect(segments).toHaveLength(1);
      expect(segments[0].content).toEqual({
        en: 'Hello world.',
        vi: 'Xin chào thế giới.'
      });
    });

    it('should parse multiple bilingual sentences on same line', () => {
      const md = 'First. / Đầu tiên. Second. / Thứ hai.';
      const segments = parseMarkdownToSegments(md, 'en-vi');
      expect(segments).toHaveLength(2);
      expect(segments[0].content).toEqual({
        en: 'First.',
        vi: 'Đầu tiên.'
      });
      expect(segments[1].content).toEqual({
        en: 'Second.',
        vi: 'Thứ hai.'
      });
    });

    it('should handle AI-generated continuous format', () => {
      const md = 'Hello, how are you? / Xin chào bạn ổn không? I\'m fine. / Tôi ổn.';
      const segments = parseMarkdownToSegments(md, 'en-vi');
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

    it('should handle missing translation gracefully', () => {
      const md = 'English only. / ';
      const segments = parseMarkdownToSegments(md, 'en-vi');
      expect(segments).toHaveLength(1);
      expect(segments[0].content.en).toBe('English only.');
      expect(segments[0].content.vi).toBe('');
    });

    it('should handle multiple sentences on separate lines', () => {
      const md = `First sentence. / Câu đầu tiên.
Second sentence. / Câu thứ hai.`;
      const segments = parseMarkdownToSegments(md, 'en-vi');
      expect(segments).toHaveLength(2);
      expect(segments[0].content.en).toBe('First sentence.');
      expect(segments[1].content.en).toBe('Second sentence.');
    });

    it('should handle quoted dialogue', () => {
      const md = '"Hello," I said. / "Xin chào," tôi nói. "How are you?" / "Bạn khỏe không?"';
      const segments = parseMarkdownToSegments(md, 'en-vi');
      expect(segments).toHaveLength(2);
      expect(segments[0].content.en).toBe('"Hello," I said.');
      expect(segments[0].content.vi).toBe('"Xin chào," tôi nói.');
      expect(segments[1].content.en).toBe('"How are you?"');
      expect(segments[1].content.vi).toBe('"Bạn khỏe không?"');
    });
  });

  // ===================================
  // Paragraph Break Handling
  // ===================================
  describe('Paragraph Breaks', () => {
    it('should mark first sentence of paragraph as isNewPara', () => {
      const md = `First paragraph sentence one.

Second paragraph sentence.`;
      const segments = parseMarkdownToSegments(md, 'en');
      expect(segments).toHaveLength(2);
      expect(segments[0].metadata.isNewPara).toBe(true);
      expect(segments[1].metadata.isNewPara).toBe(true);
    });

    it('should NOT mark subsequent sentences in same paragraph as isNewPara', () => {
      const md = 'First sentence. Second sentence. Third sentence.';
      const segments = parseMarkdownToSegments(md, 'en');
      expect(segments).toHaveLength(3);
      expect(segments[0].metadata.isNewPara).toBe(true);
      expect(segments[1].metadata.isNewPara).toBe(false);
      expect(segments[2].metadata.isNewPara).toBe(false);
    });
  });

  // ===================================
  // Footnote Removal
  // ===================================
  describe('Footnote Removal', () => {
    it('should remove footnotes from monolingual text', () => {
      const md = 'This is a test[1]. Another sentence[23].';
      const segments = parseMarkdownToSegments(md, 'en');
      expect(segments[0].content.en).toBe('This is a test.');
      expect(segments[1].content.en).toBe('Another sentence.');
    });

    it('should remove footnotes from bilingual text', () => {
      const md = 'Test[1]. / Thử nghiệm[2].';
      const segments = parseMarkdownToSegments(md, 'en-vi');
      expect(segments[0].content.en).toBe('Test.');
      expect(segments[0].content.vi).toBe('Thử nghiệm.');
    });
  });
  
  // ===================================
  // Edge Cases
  // ===================================
  describe('Edge Cases', () => {
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
        expect(segments).toHaveLength(2);
        expect(segments[0].content.en).toContain('👋');
        expect(segments[1].content.en).toContain('😊');
    });

    it('should skip chapter headings in content', () => {
      const md = `This is content.
## Chapter 1
More content.`;
      const segments = parseMarkdownToSegments(md, 'en');
      expect(segments).toHaveLength(2);
      expect(segments[0].content.en).toBe('This is content.');
      expect(segments[1].content.en).toBe('More content.');
    });
  });

  // ===================================
  // Other Languages
  // ===================================
  describe('Other Languages', () => {
    it('should handle Chinese', () => {
      const md = '这是一个测试。这是第二句。';
      const segments = parseMarkdownToSegments(md, 'zh');
      expect(segments).toHaveLength(2);
      expect(segments[0].content.zh).toBe('这是一个测试。');
      expect(segments[1].content.zh).toBe('这是第二句。');
    });

    it('should handle Japanese', () => {
      const md = 'This is a test. / これはテストです。';
      const segments = parseMarkdownToSegments(md, 'en-ja');
      expect(segments).toHaveLength(1);
      expect(segments[0].content.ja).toBe('これはテストです。');
    });

    it('should handle Korean', () => {
      const md = 'Test. / 이것은 테스트입니다.';
      const segments = parseMarkdownToSegments(md, 'en-ko');
      expect(segments).toHaveLength(1);
      expect(segments[0].content.ko).toBe('이것은 테스트입니다.');
    });
    
    it('should handle Arabic', () => {
      const md = 'Hello. / مرحبا.';
      const segments = parseMarkdownToSegments(md, 'en-ar');
      expect(segments).toHaveLength(1);
      expect(segments[0].content.ar).toBe('مرحبا.');
    });
  });
  
  // ===================================
  // Complex Real-World Examples
  // ===================================
  describe('Complex Real-World Examples', () => {
    it('should handle Alex curiosity story - paragraph 1', () => {
      const md = `Ten-year-old Alex loved questions. Not just any questions, but the big, impossible-to-answer kind. He wasn't interested in what time dinner was; he wanted to know why the sky was blue. / Cậu bé Alex mười tuổi rất thích những câu hỏi. Không chỉ là bất kỳ câu hỏi nào, mà là những câu hỏi lớn, không thể trả lời được. Cậu không quan tâm đến mấy giờ ăn tối; cậu muốn biết tại sao bầu trời lại có màu xanh. He would pepper his parents, teachers, and anyone who would listen with his endless inquiries. / Cậu liên tục hỏi bố mẹ, thầy cô và bất cứ ai chịu lắng nghe với những câu hỏi vô tận của mình.`;
      
      const segments = parseMarkdownToSegments(md, 'en-vi');
      
      expect(segments.length).toBe(4);
      
      const firstEn = segments.find(s => s.content.en?.includes('Ten-year-old Alex'));
      expect(firstEn).toBeDefined();
      expect(firstEn?.content.vi).toContain('Cậu bé Alex');
      
      const lastEn = segments.find(s => s.content.en?.includes('pepper his parents'));
      expect(lastEn).toBeDefined();
    });

    it('should handle Alex curiosity story - with questions', () => {
        const md = `"Why do birds sing?" he'd ask. "Where does the wind go when it stops blowing?" / "Tại sao chim hót?" cậu hỏi. "Gió đi đâu khi nó ngừng thổi?" Sometimes, he got answers, but more often, he received shrugs or, "Because that's just how it is." / Đôi khi, cậu nhận được câu trả lời, nhưng thường xuyên hơn, cậu nhận được những cái nhún vai hoặc, "Vì nó là như vậy thôi."`;
        const segments = parseMarkdownToSegments(md, 'en-vi');
        expect(segments).toHaveLength(3);
    });
  });

});


// ===================================
// BOOK PARSER TESTS
// ===================================
describe('Book Markdown Parser', () => {
  
  describe('Title Extraction', () => {
    it('should extract title from H1', () => {
      const md = `# My Book Title

## Chapter 1
Content here.`;
      const { title, chapters } = parseBookMarkdown(md, 'en');
      expect(title.en).toBe('My Book Title');
      expect(chapters).toHaveLength(1);
    });

    it('should handle bilingual title', () => {
      const md = `# English Title / Tiêu đề Tiếng Việt

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

  describe('Chapter Structure', () => {
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
      expect(chapters[0].stats.totalSegments).toBe(2);
      expect(chapters[0].stats.totalWords).toBeGreaterThan(0);
      expect(chapters[0].stats.estimatedReadingTime).toBeGreaterThan(0);
    });

    it('should treat content without chapter headings as a single chapter', () => {
        const markdown = `# My Book
This is content. This is more content.`;
        const { chapters } = parseBookMarkdown(markdown, 'en');
        expect(chapters).toHaveLength(1);
        expect(chapters[0].title.en).toBe('Chapter 1');
        expect(chapters[0].segments.length).toBe(2);
    });

    it('should parse bilingual chapter titles', () => {
      const md = `# Book

## Chapter 1 / Chương 1
Content. / Nội dung.`;
      const { chapters } = parseBookMarkdown(md, 'en-vi');
      expect(chapters[0].title).toEqual({
        en: 'Chapter 1',
        vi: 'Chương 1'
      });
    });
  });
  
  describe('Malformed Markdown', () => {
    it('should handle nested headings as regular content', () => {
      const md = `## Chapter 1
### Subsection
Content here.`;
      const { chapters } = parseBookMarkdown(md, 'en');
      expect(chapters).toHaveLength(1);
      // It should be part of the segment content
      expect(chapters[0].segments[0].content.en).toBe('### Subsection');
    });
  });
});

// ===================================
// GET ITEM SEGMENTS HELPER
// ===================================
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
      aspectRatio: '3:4',
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
      isBilingual: false,
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
