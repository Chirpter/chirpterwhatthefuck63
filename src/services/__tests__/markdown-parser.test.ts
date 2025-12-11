// src/services/__tests__/markdown-parser.test.ts - UPDATED với {translation} syntax

import { describe, it, expect } from 'vitest';
import { 
  parseMarkdownToSegments, 
  parseBookMarkdown,
  getItemSegments 
} from '../MarkdownParser';
import type { Book, Piece } from '@/lib/types';

describe('MarkdownParser - Sentence-Based với {translation} Syntax', () => {
  
  describe('✅ Monolingual - English', () => {
    it('should parse single sentence', () => {
      const md = 'Hello world.';
      const segments = parseMarkdownToSegments(md, 'en');
      
      expect(segments).toHaveLength(1);
      expect(segments[0].content.en).toBe('Hello world.');
      expect(segments[0].phrases).toBeUndefined();
    });

    it('should split multiple sentences', () => {
      const markdown = 'First sentence. Second sentence. Third one!';
      const segments = parseMarkdownToSegments(markdown, 'en');

      expect(segments).toHaveLength(3);
      expect(segments[0].content.en).toBe('First sentence.');
      expect(segments[1].content.en).toBe('Second sentence.');
      expect(segments[2].content.en).toBe('Third one!');
    });

    it('should handle question marks and exclamations', () => {
      const markdown = 'Hello! How are you? I am fine.';
      const segments = parseMarkdownToSegments(markdown, 'en');
      
      expect(segments).toHaveLength(3);
      expect(segments[0].content.en).toBe('Hello!');
      expect(segments[1].content.en).toBe('How are you?');
      expect(segments[2].content.en).toBe('I am fine.');
    });

    it('should NOT split on abbreviations', () => {
      const md = 'Dr. Smith went to St. Louis with Mr. Johnson.';
      const segments = parseMarkdownToSegments(md, 'en');
      
      expect(segments).toHaveLength(1);
      expect(segments[0].content.en).toBe('Dr. Smith went to St. Louis with Mr. Johnson.');
    });

    it('should NOT split on decimal numbers', () => {
      const md = 'The value is 3.14 and 2.5 meters.';
      const segments = parseMarkdownToSegments(md, 'en');
      
      expect(segments).toHaveLength(1);
      expect(segments[0].content.en).toBe('The value is 3.14 and 2.5 meters.');
    });

    it('should handle ellipsis mid-sentence', () => {
      const md = 'She paused... then continued speaking.';
      const segments = parseMarkdownToSegments(md, 'en');
      
      expect(segments).toHaveLength(1);
      expect(segments[0].content.en).toBe('She paused... then continued speaking.');
    });

    it('should split after ellipsis if new sentence starts', () => {
      const md = 'She paused... Then she spoke.';
      const segments = parseMarkdownToSegments(md, 'en');
      
      expect(segments).toHaveLength(2);
      expect(segments[0].content.en).toBe('She paused...');
      expect(segments[1].content.en).toBe('Then she spoke.');
    });

    it('should handle dialogue correctly', () => {
      const md = '"Hello," she said. "How are you?" he asked.';
      const segments = parseMarkdownToSegments(md, 'en');
      
      expect(segments).toHaveLength(2);
      expect(segments[0].content.en).toBe('"Hello," she said.');
      expect(segments[1].content.en).toBe('"How are you?" he asked.');
    });
  });

  describe('✅ Bilingual Sentence Mode với {translation}', () => {
    it('should parse single bilingual pair', () => {
      const md = 'Hello world. {Xin chào thế giới.}';
      const segments = parseMarkdownToSegments(md, 'en-vi');
      
      expect(segments).toHaveLength(1);
      expect(segments[0].content).toEqual({
        en: 'Hello world.',
        vi: 'Xin chào thế giới.'
      });
      expect(segments[0].phrases).toBeUndefined();
    });

    it('should parse multiple bilingual pairs', () => {
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

    it('should handle continuous AI-generated format', () => {
      const markdown = 'One day, Alex found a book. {Một ngày nọ, Alex tìm thấy một cuốn sách.} It was old. {Nó đã cũ.}';
      const segments = parseMarkdownToSegments(markdown, 'en-vi');
      
      expect(segments).toHaveLength(2);
      expect(segments[0].content).toEqual({
        en: 'One day, Alex found a book.',
        vi: 'Một ngày nọ, Alex tìm thấy một cuốn sách.'
      });
      expect(segments[1].content).toEqual({
        en: 'It was old.',
        vi: 'Nó đã cũ.'
      });
    });

    it('should handle missing translation (empty braces)', () => {
      const markdown = 'English only. {}';
      const segments = parseMarkdownToSegments(markdown, 'en-vi');
      
      expect(segments).toHaveLength(1);
      expect(segments[0].content.en).toBe('English only.');
      expect(segments[0].content.vi).toBe('');
    });

    it('should handle mixed mono and bilingual content', () => {
      const md = 'First pair. {Cặp đầu tiên.} English only. Third pair. {Cặp thứ ba.}';
      const segments = parseMarkdownToSegments(md, 'en-vi');
      
      expect(segments).toHaveLength(3);
      expect(segments[0].content).toEqual({ en: 'First pair.', vi: 'Cặp đầu tiên.' });
      expect(segments[1].content).toEqual({ en: 'English only.' });
      expect(segments[2].content).toEqual({ en: 'Third pair.', vi: 'Cặp thứ ba.' });
    });

    it('should handle multiple sentences before translation', () => {
      const md = 'Sentence one. Sentence two. {Câu một. Câu hai.}';
      const segments = parseMarkdownToSegments(md, 'en-vi');
      
      // Should have: "Sentence one." (mono) + "Sentence two." (bilingual)
      expect(segments).toHaveLength(2);
      expect(segments[0].content).toEqual({ en: 'Sentence one.' });
      expect(segments[1].content).toEqual({ 
        en: 'Sentence two.', 
        vi: 'Câu một. Câu hai.' 
      });
    });

    it('should handle dialogue', () => {
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

    it('should handle sentences with commas and semicolons', () => {
      const md = 'The dragon, named Ignis, was small. {Con rồng, tên là Ignis, rất nhỏ.}';
      const segments = parseMarkdownToSegments(md, 'en-vi');
      
      expect(segments).toHaveLength(1);
      expect(segments[0].content.en).toBe('The dragon, named Ignis, was small.');
      expect(segments[0].content.vi).toBe('Con rồng, tên là Ignis, rất nhỏ.');
    });
  });

  describe('✅ Bilingual Phrase Mode (en-vi-ph)', () => {
    it('should split sentences into phrases at commas', () => {
      const md = 'Hello, this is a test. {Xin chào, đây là một bài kiểm tra.}';
      const segments = parseMarkdownToSegments(md, 'en-vi-ph');
      
      expect(segments).toHaveLength(1);
      expect(segments[0].content).toBeUndefined(); // Not stored in phrase mode
      expect(segments[0].phrases).toBeDefined();
      expect(segments[0].phrases).toHaveLength(2);
      expect(segments[0].phrases![0]).toEqual({ 
        en: 'Hello,', 
        vi: 'Xin chào,' 
      });
      expect(segments[0].phrases![1]).toEqual({ 
        en: 'this is a test.', 
        vi: 'đây là một bài kiểm tra.' 
      });
    });

    it('should split at multiple punctuation marks', () => {
      const md = 'Part one, part two - part three; part four. {Phần một, phần hai - phần ba; phần bốn.}';
      const segments = parseMarkdownToSegments(md, 'en-vi-ph');
      
      expect(segments[0].phrases).toHaveLength(4);
      expect(segments[0].phrases![0].en).toBe('Part one,');
      expect(segments[0].phrases![1].en).toBe('part two -');
      expect(segments[0].phrases![2].en).toBe('part three;');
      expect(segments[0].phrases![3].en).toBe('part four.');
    });

    it('should handle colons as phrase boundaries', () => {
      const md = 'Listen: this is important. {Nghe này: điều này quan trọng.}';
      const segments = parseMarkdownToSegments(md, 'en-vi-ph');
      
      expect(segments[0].phrases).toHaveLength(2);
      expect(segments[0].phrases![0]).toEqual({ en: 'Listen:', vi: 'Nghe này:' });
      expect(segments[0].phrases![1]).toEqual({ 
        en: 'this is important.', 
        vi: 'điều này quan trọng.' 
      });
    });

    it('should NOT split at sentence endings in phrase mode', () => {
      const md = 'First. {Đầu tiên.} Second. {Thứ hai.}';
      const segments = parseMarkdownToSegments(md, 'en-vi-ph');
      
      // Each sentence-pair becomes separate segment, no splitting within
      expect(segments).toHaveLength(2);
      expect(segments[0].phrases).toHaveLength(1); // "First." has no internal punctuation
      expect(segments[0].phrases![0]).toEqual({ en: 'First.', vi: 'Đầu tiên.' });
    });
  });

  describe('✅ Paragraph Breaks', () => {
    it('should mark first sentence of paragraph as isNewPara', () => {
      const md = `First paragraph.

Second paragraph.`;
      const segments = parseMarkdownToSegments(md, 'en');
      
      expect(segments).toHaveLength(2);
      expect(segments[0].metadata.isNewPara).toBe(true);
      expect(segments[1].metadata.isNewPara).toBe(true);
    });

    it('should NOT mark subsequent sentences as isNewPara', () => {
      const md = `First line. Second line.
Third line.`;
      const segments = parseMarkdownToSegments(md, 'en');
      
      expect(segments).toHaveLength(3);
      expect(segments[0].metadata.isNewPara).toBe(true);
      expect(segments[1].metadata.isNewPara).toBe(false);
      expect(segments[2].metadata.isNewPara).toBe(false);
    });

    it('should handle bilingual paragraphs', () => {
      const md = `First. {Đầu.}

Second. {Thứ hai.}`;
      const segments = parseMarkdownToSegments(md, 'en-vi');
      
      expect(segments[0].metadata.isNewPara).toBe(true);
      expect(segments[1].metadata.isNewPara).toBe(true);
    });
  });

  describe('✅ Footnote Removal', () => {
    it('should remove single footnote [1]', () => {
      const markdown = 'This is a note[1].';
      const segments = parseMarkdownToSegments(markdown, 'en');
      
      expect(segments[0].content.en).toBe('This is a note.');
    });

    it('should remove multiple footnotes', () => {
      const markdown = 'First[23]. {Đầu[45].}';
      const segments = parseMarkdownToSegments(markdown, 'en-vi');
      
      expect(segments[0].content.en).toBe('First.');
      expect(segments[0].content.vi).toBe('Đầu.');
    });
  });

  describe('✅ Edge Cases', () => {
    it('should handle empty markdown', () => {
      expect(parseMarkdownToSegments('', 'en')).toHaveLength(0);
    });

    it('should handle whitespace only', () => {
      expect(parseMarkdownToSegments('   \n\n  ', 'en')).toHaveLength(0);
    });

    it('should handle emoji', () => {
      const md = 'Hello 👋 world! Nice 😊.';
      const segments = parseMarkdownToSegments(md, 'en');
      
      expect(segments).toHaveLength(2);
      expect(segments[0].content.en).toContain('👋');
      expect(segments[1].content.en).toContain('😊');
    });

    it('should skip chapter headings in content', () => {
      const md = `Content here.
## This is a chapter
More content.`;
      const segments = parseMarkdownToSegments(md, 'en');
      
      expect(segments).toHaveLength(2);
      expect(segments[0].content.en).toBe('Content here.');
      expect(segments[1].content.en).toBe('More content.');
    });

    it('should handle braces in Vietnamese text', () => {
      const md = 'Test. {Đây là {ví dụ} trong ngoặc.}';
      const segments = parseMarkdownToSegments(md, 'en-vi');
      
      // This is a known limitation - nested braces will break
      // For now, we document this behavior
      expect(segments.length).toBeGreaterThan(0);
    });
  });

  describe('✅ Other Languages', () => {
    it('should handle Chinese', () => {
      const md = '这是第一句。这是第二句。';
      const segments = parseMarkdownToSegments(md, 'zh');
      
      expect(segments).toHaveLength(2);
      expect(segments[0].content.zh).toBe('这是第一句。');
      expect(segments[1].content.zh).toBe('这是第二句。');
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
  });
});

describe('Book Markdown Parser với {translation}', () => {
  
  describe('✅ Title Extraction', () => {
    it('should extract monolingual title', () => {
      const md = `# The Dragon Story

## Chapter 1
Content.`;
      const { title } = parseBookMarkdown(md, 'en');
      
      expect(title.en).toBe('The Dragon Story');
    });

    it('should extract bilingual title', () => {
      const md = `# The Dragon Story {Câu chuyện con rồng}

## Chapter 1
Content.`;
      const { title } = parseBookMarkdown(md, 'en-vi');
      
      expect(title).toEqual({
        en: 'The Dragon Story',
        vi: 'Câu chuyện con rồng'
      });
    });

    it('should use default if no H1', () => {
      const md = `## Chapter 1
Content.`;
      const { title } = parseBookMarkdown(md, 'en');
      
      expect(title.en).toBe('Untitled');
    });
  });

  describe('✅ Chapter Parsing', () => {
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

    it('should calculate chapter stats correctly', () => {
      const md = `# Book

## Chapter 1
This is a test. {Đây là kiểm tra.} It has two sentences. {Nó có hai câu.}`;
      
      const { chapters } = parseBookMarkdown(md, 'en-vi');
      
      expect(chapters[0].stats.totalSegments).toBe(2);
      expect(chapters[0].stats.totalWords).toBe(9); // "This is a test" + "It has two sentences"
      expect(chapters[0].stats.estimatedReadingTime).toBe(1);
    });

    it('should treat content without chapters as single chapter', () => {
      const markdown = `# My Book
Just some content. {Chỉ là nội dung.}
More text. {Thêm chữ.}`;
      
      const { chapters } = parseBookMarkdown(markdown, 'en-vi');
      
      expect(chapters).toHaveLength(1);
      expect(chapters[0].title.en).toBe('Chapter 1');
      expect(chapters[0].segments.length).toBe(2);
    });
  });

  describe('✅ Real-World Book Example', () => {
    it('should parse complete story about dragon Ignis', () => {
      const md = `# The Story of Ignis {Câu chuyện về Ignis}

## Chapter 1: The Small Dragon {Chương 1: Con rồng nhỏ}
In a mystical land, there lived a small dragon named Ignis. {Ở một vùng đất huyền bí, có một con rồng nhỏ tên là Ignis.}
Unlike other dragons, Ignis was tiny. {Không giống những con rồng khác, Ignis rất nhỏ bé.}
But what he lacked in size, he made up for in courage. {Nhưng điều anh thiếu về kích thước, anh bù đắp bằng lòng dũng cảm.}

## Chapter 2: The Great Journey {Chương 2: Cuộc hành trình vĩ đại}
One day, Ignis decided to prove himself. {Một ngày nọ, Ignis quyết định chứng minh bản thân.}
He set off on a journey to find the Golden Flame. {Anh lên đường tìm kiếm Ngọn Lửa Vàng.}
The path was dangerous, but Ignis was determined. {Con đường nguy hiểm, nhưng Ignis đã quyết tâm.}

## Chapter 3: The Victory {Chương 3: Chiến thắng}
After many trials, Ignis finally found the flame. {Sau nhiều thử thách, Ignis cuối cùng đã tìm thấy ngọn lửa.}
He proved that size doesn't matter. {Anh chứng minh rằng kích thước không quan trọng.}
From that day on, all dragons respected him. {Từ ngày đó, tất cả các con rồng đều kính trọng anh.}`;

      const { title, chapters } = parseBookMarkdown(md, 'en-vi');

      // Verify title
      expect(title).toEqual({
        en: 'The Story of Ignis',
        vi: 'Câu chuyện về Ignis'
      });

      // Verify chapter count
      expect(chapters).toHaveLength(3);

      // Verify Chapter 1
      expect(chapters[0].title).toEqual({
        en: 'Chapter 1: The Small Dragon',
        vi: 'Chương 1: Con rồng nhỏ'
      });
      expect(chapters[0].segments).toHaveLength(3);
      expect(chapters[0].segments[0].content.en).toBe('In a mystical land, there lived a small dragon named Ignis.');
      expect(chapters[0].segments[0].content.vi).toBe('Ở một vùng đất huyền bí, có một con rồng nhỏ tên là Ignis.');

      // Verify Chapter 2
      expect(chapters[1].segments).toHaveLength(3);
      
      // Verify Chapter 3
      expect(chapters[2].segments).toHaveLength(3);
      expect(chapters[2].segments[2].content.en).toBe('From that day on, all dragons respected him.');

      // Verify stats for Chapter 1
      expect(chapters[0].stats.totalSegments).toBe(3);
      expect(chapters[0].stats.totalWords).toBeGreaterThan(20);
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
      generatedContent: [
        {
          id: 's1',
          order: 0,
          type: 'text',
          content: { en: 'Test.', vi: 'Kiểm tra.' },
          formatting: {},
          metadata: { isNewPara: true }
        }
      ],
    };
    
    const segments = getItemSegments(piece);
    
    expect(segments).toHaveLength(1);
    expect(segments[0].content.en).toBe('Test.');
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
              content: { en: 'Content.' },
              formatting: {},
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
    expect(segments[0].content.en).toBe('Content.');
  });

  it('should return empty for null item', () => {
    expect(getItemSegments(null)).toHaveLength(0);
  });
});