// src/services/__tests__/markdown-parser.test.ts - UPDATED với {translation} syntax

import { describe, it, expect } from 'vitest';
import { 
  parseMarkdownToSegments, 
  parseBookMarkdown,
  getItemSegments 
} from '../MarkdownParser';
import type { Book, Piece, MultilingualContent } from '@/lib/types';

describe('MarkdownParser - Sentence-Based với {translation} Syntax', () => {
  
  describe('✅ Monolingual Parsing (en)', () => {
    it('should parse a single sentence as one segment', () => {
      const md = 'Hello world.';
      const segments = parseMarkdownToSegments(md, 'en');
      
      expect(segments).toHaveLength(1);
      expect(segments[0].content).toEqual({ en: 'Hello world.' });
    });

    it('should split multiple sentences on the same line into separate segments', () => {
      const markdown = 'First sentence. Second sentence. Third one!';
      const segments = parseMarkdownToSegments(markdown, 'en');

      expect(segments).toHaveLength(3);
      expect(segments[0].content).toEqual({ en: 'First sentence.' });
      expect(segments[1].content).toEqual({ en: 'Second sentence.' });
      expect(segments[2].content).toEqual({ en: 'Third one!' });
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
    
    it('should split after an ellipsis if followed by a new sentence', () => {
      const md = 'She paused... Then she spoke.';
      const segments = parseMarkdownToSegments(md, 'en');
      
      expect(segments).toHaveLength(2);
      expect(segments[0].content).toEqual({ en: 'She paused...' });
      expect(segments[1].content).toEqual({ en: 'Then she spoke.' });
    });

    it('should handle quoted dialogue correctly', () => {
      const md = '"Hello," she said. "How are you?" he asked.';
      const segments = parseMarkdownToSegments(md, 'en');
      
      expect(segments).toHaveLength(2);
      expect(segments[0].content).toEqual({ en: '"Hello," she said.' });
      expect(segments[1].content).toEqual({ en: '"How are you?" he asked.' });
    });

    it('should handle complex sentences with semicolons', () => {
        const md = 'This is a complex sentence; it has multiple clauses.';
        const segments = parseMarkdownToSegments(md, 'en');
        expect(segments).toHaveLength(1);
        expect(segments[0].content).toEqual({ en: 'This is a complex sentence; it has multiple clauses.' });
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

    it('should parse multiple bilingual sentences on the same line', () => {
      const markdown = 'First sentence. {Câu đầu tiên.} Second sentence. {Câu thứ hai.}';
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

    it('should handle AI-generated continuous format', () => {
      const markdown = 'Hello, how are you?{Xin chào bạn ổn không?}I\'m fine.{Tôi ổn.}';
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

    it('should handle missing translation gracefully', () => {
      const markdown = 'English only.{}';
      const segments = parseMarkdownToSegments(markdown, 'en-vi');
      
      expect(segments).toHaveLength(1);
      expect(segments[0].content).toEqual({
          en: 'English only.',
          vi: ''
      });
    });

    it('should handle multiple sentences on separate lines', () => {
      const markdown = 'First line. {Dòng đầu.}\nSecond line. {Dòng hai.}';
      const segments = parseMarkdownToSegments(markdown, 'en-vi');
      expect(segments).toHaveLength(2);
      expect(segments[0].content).toEqual({ en: 'First line.', vi: 'Dòng đầu.' });
      expect(segments[1].content).toEqual({ en: 'Second line.', vi: 'Dòng hai.' });
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
      const md = `First line. Second line.
Third line.`;
      const segments = parseMarkdownToSegments(md, 'en');
      
      expect(segments).toHaveLength(3);
      expect(segments[0].metadata.isNewPara).toBe(true);
      expect(segments[1].metadata.isNewPara).toBe(false);
      expect(segments[2].metadata.isNewPara).toBe(false);
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

    it('should handle emoji', () => {
      const md = 'Hello 👋 world! Nice 😊.';
      const segments = parseMarkdownToSegments(md, 'en');
      
      expect(segments).toHaveLength(2);
      expect(segments[0].content).toEqual({ en: 'Hello 👋 world!' });
      expect(segments[1].content).toEqual({ en: 'Nice 😊.' });
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
  });

  describe('✅ Other Languages', () => {
    it('should handle Chinese', () => {
      const md = '这是一个测试。这是第二句。';
      const segments = parseMarkdownToSegments(md, 'zh');
      
      expect(segments).toHaveLength(2);
      expect(segments[0].content).toEqual({ zh: '这是一个测试。'});
      expect(segments[1].content).toEqual({ zh: '这是第二句。' });
    });

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

    it('should handle bilingual Arabic', () => {
        const md = 'Good morning. {صباح الخير.}';
        const segments = parseMarkdownToSegments(md, 'en-ar');
        expect(segments).toHaveLength(1);
        expect(segments[0].content.ar).toBe('صباح الخير.');
    });
  });

  describe('✅ Complex Real-World Examples', () => {
    it('should handle mixed mono and bilingual content', () => {
      const md = `The first pair. {Cặp đầu tiên.} A monolingual sentence here. The second pair. {Cặp thứ hai.}`;
      const segments = parseMarkdownToSegments(md, 'en-vi');

      expect(segments).toHaveLength(3);
      expect(segments[0].content).toEqual({ en: 'The first pair.', vi: 'Cặp đầu tiên.' });
      expect(segments[1].content).toEqual({ en: 'A monolingual sentence here.' });
      expect(segments[2].content).toEqual({ en: 'The second pair.', vi: 'Cặp thứ hai.' });
    });

    it('should handle Alex curiosity story - with questions', () => {
      const md = `Why was the sky blue? {Tại sao bầu trời lại màu xanh?} How did birds fly? {Làm thế nào chim có thể bay?} These were the questions that filled his days. {Đây là những câu hỏi lấp đầy những ngày của cậu.}`;
      const segments = parseMarkdownToSegments(md, 'en-vi');
      
      expect(segments).toHaveLength(3);
      expect(segments[0].content).toEqual({ en: 'Why was the sky blue?', vi: 'Tại sao bầu trời lại màu xanh?' });
      expect(segments[1].content).toEqual({ en: 'How did birds fly?', vi: 'Làm thế nào chim có thể bay?' });
      expect(segments[2].content).toEqual({ en: 'These were the questions that filled his days.', vi: 'Đây là những câu hỏi lấp đầy những ngày của cậu.' });
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
        const md = `## C1\ntext1\n## C2\ntext2`;
        const { chapters } = parseBookMarkdown(md, 'en');
        expect(chapters[0].title.en).toBe('C1');
        expect(chapters[1].title.en).toBe('C2');
    });

    it('should calculate chapter stats', () => {
      const md = `# Book

## Chapter 1
This is a test. {Đây là kiểm tra.} It has two sentences. {Nó có hai câu.}`;
      
      const { chapters } = parseBookMarkdown(md, 'en-vi');
      
      expect(chapters[0].stats.totalSegments).toBe(2);
      expect(chapters[0].stats.totalWords).toBe(9); // "This is a test" + "It has two sentences"
      expect(chapters[0].stats.estimatedReadingTime).toBe(1);
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

    it('should parse bilingual chapter titles', () => {
        const md = `## Chapter 1 {Chương 1}`;
        const { chapters } = parseBookMarkdown(md, 'en-vi');
        expect(chapters[0].title).toEqual({ en: 'Chapter 1', vi: 'Chương 1' });
    });
  });

  describe('✅ Malformed Markdown', () => {
    it('should handle nested headings as regular content', () => {
      const md = `## Chapter 1
This is text.
### A sub-heading
More text.`;
      const { chapters } = parseBookMarkdown(md, 'en');
      
      expect(chapters).toHaveLength(1);
      expect(chapters[0].segments).toHaveLength(3); // Should parse the '###' line as text
      expect(chapters[0].segments[1].content.en).toBe('### A sub-heading');
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
      display: 'card',
      isBilingual: true,
      unit: 'sentence',
      generatedContent: [
        {
          id: 's1',
          order: 0,
          type: 'text',
          content: { en: 'Test.', vi: 'Kiểm tra.' },
          metadata: { isNewPara: true }
        }
      ],
    };
    
    const segments = getItemSegments(piece);
    
    expect(segments).toHaveLength(1);
    expect((segments[0].content as MultilingualContent).en).toBe('Test.');
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
      unit: 'sentence',
      isBilingual: false,
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
              content: { en: 'Content.' },
              metadata: { isNewPara: true }
            }
          ],
          stats: { totalSegments: 1, totalWords: 1, estimatedReadingTime: 1 },
          metadata: {}
        }
      ],
    };
    
    const segments = getItemSegments(book, 0);
    
    expect(segments).toHaveLength(1);
    expect((segments[0].content as MultilingualContent).en).toBe('Content.');
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
      display: 'book',
      chapters: [],
      unit: 'sentence',
      isBilingual: false
    };
    expect(getItemSegments(book, 10)).toHaveLength(0);
  });

  it('should return empty for null item', () => {
    expect(getItemSegments(null)).toHaveLength(0);
  });
});
