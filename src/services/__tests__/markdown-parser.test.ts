// src/services/__tests__/markdown-parser.test.ts

import { describe, it, expect } from 'vitest';
import { 
  parseMarkdownToSegments, 
  parseBookMarkdown,
  getItemSegments,
  splitSentenceIntoPhrases
} from '../MarkdownParser';
import type { Book, Piece, MultilingualContent } from '@/lib/types';

describe('MarkdownParser - Unified Architecture', () => {

  // ==========================================
  // 1. MONOLINGUAL (origin: "en", unit: "sentence")
  // ==========================================
  describe('✅ Monolingual - Sentence Mode', () => {
    it('should split multiple sentences into separate sentence segments', () => {
      const md = 'First sentence. Second sentence!';
      const segments = parseMarkdownToSegments(md, 'en', 'sentence');
      
      expect(segments).toHaveLength(2);
      expect(segments[0]).toMatchObject({ type: 'start_para', content: { en: 'First sentence.' } });
      expect(segments[1]).toMatchObject({ type: 'text', content: { en: 'Second sentence!' } });
    });

    it('should NOT split on abbreviations like Dr. or St.', () => {
      const md = 'Dr. Smith went to St. Louis.';
      const segments = parseMarkdownToSegments(md, 'en', 'sentence');
      
      expect(segments).toHaveLength(1);
      expect(segments[0].content).toEqual({ en: 'Dr. Smith went to St. Louis.' });
    });

    it('should treat multiple lines as a single paragraph if no blank line exists', () => {
        const md = 'Line one.\nLine two.';
        const segments = parseMarkdownToSegments(md, 'en', 'sentence');
        
        expect(segments).toHaveLength(2);
        expect(segments[0].type).toBe('start_para');
        expect(segments[1].type).toBe('text');
    });

    it('should create new paragraphs on blank lines', () => {
        const md = 'Paragraph one.\n\nParagraph two.';
        const segments = parseMarkdownToSegments(md, 'en', 'sentence');
        
        expect(segments).toHaveLength(2);
        expect(segments[0].type).toBe('start_para');
        expect(segments[1].type).toBe('start_para');
    });
  });

  // ==========================================
  // 2. BILINGUAL SENTENCE (origin: "en-vi", unit: "sentence")
  // ==========================================
  describe('✅ Bilingual - Sentence Mode', () => {
    it('should parse bilingual sentence pairs correctly', () => {
      const md = 'Hello world. {Xin chào thế giới.}';
      const segments = parseMarkdownToSegments(md, 'en-vi', 'sentence');
      
      expect(segments).toHaveLength(1);
      expect(segments[0].content).toEqual({ en: 'Hello world.', vi: 'Xin chào thế giới.' });
      expect(segments[0].content.en).toBeTypeOf('string');
    });

    it('should handle multiple pairs on the same line', () => {
      const md = 'First sentence. {Câu một.} Second sentence. {Câu hai.}';
      const segments = parseMarkdownToSegments(md, 'en-vi', 'sentence');
      
      expect(segments).toHaveLength(2);
      expect(segments[0].content).toEqual({ en: 'First sentence.', vi: 'Câu một.' });
      expect(segments[1].content).toEqual({ en: 'Second sentence.', vi: 'Câu hai.' });
    });
  });

  // ==========================================
  // 3. BILINGUAL PHRASE (origin: "en-vi-ph", unit: "phrase")
  // ==========================================
  describe('✅ Bilingual - Phrase Mode', () => {
    it('should create one segment per sentence, with content as an array of phrases', () => {
      const md = 'The cat, small and fluffy, sat on the mat. {Con mèo, nhỏ và xù, đã ngồi trên tấm thảm.}';
      const segments = parseMarkdownToSegments(md, 'en-vi-ph', 'phrase');
      
      // Still only ONE segment for the whole sentence
      expect(segments).toHaveLength(1);
      expect(segments[0].type).toBe('start_para');

      // The content for each language is now an ARRAY
      expect(segments[0].content.en).toBeInstanceOf(Array);
      expect(segments[0].content.vi).toBeInstanceOf(Array);

      expect(segments[0].content).toEqual({
        en: ['The cat,', 'small and fluffy,', 'sat on the mat.'],
        vi: ['Con mèo,', 'nhỏ và xù,', 'đã ngồi trên tấm thảm.']
      });
    });

    it('should handle multiple sentences correctly in phrase mode', () => {
        const md = 'First, a comma. {Đầu tiên, một dấu phẩy.} Second; a semicolon. {Thứ hai; một dấu chấm phẩy.}';
        const segments = parseMarkdownToSegments(md, 'en-vi-ph', 'phrase');

        expect(segments).toHaveLength(2);

        // First sentence segment
        expect(segments[0].content).toEqual({
            en: ['First,', 'a comma.'],
            vi: ['Đầu tiên,', 'một dấu phẩy.']
        });

        // Second sentence segment
        expect(segments[1].content).toEqual({
            en: ['Second;', 'a semicolon.'],
            vi: ['Thứ hai;', 'một dấu chấm phẩy.']
        });
    });
  });

  // ==========================================
  // 4. FULL BOOK PARSING
  // ==========================================
  describe('✅ Full Book Parsing', () => {
    it('should correctly parse a book with a title and chapters', () => {
      const md = `# My Book {Sách Của Tôi}\n\n## Chapter 1 {Chương 1}\nSentence one. {Câu một.}`;
      const { title, chapters, unit } = parseBookMarkdown(md, 'en-vi');

      expect(title).toEqual({ en: 'My Book', vi: 'Sách Của Tôi' });
      expect(unit).toBe('sentence');
      expect(chapters).toHaveLength(1);
      expect(chapters[0].title).toEqual({ en: 'Chapter 1', vi: 'Chương 1' });
      expect(chapters[0].segments[0].content).toEqual({ en: 'Sentence one.', vi: 'Câu một.' });
    });

    it('should correctly identify unit as "phrase" from origin', () => {
        const md = `# My Book\n\n## Chapter 1\nSentence one, with a phrase. {Câu một, với một cụm từ.}`;
        const { unit, chapters } = parseBookMarkdown(md, 'en-vi-ph');

        expect(unit).toBe('phrase');
        // Check if content is array
        expect(chapters[0].segments[0].content.en).toBeInstanceOf(Array);
    });
  });

  // ==========================================
  // 5. HELPER: splitSentenceIntoPhrases
  // ==========================================
  describe('✅ Helper: splitSentenceIntoPhrases', () => {
    it('should split by comma', () => {
      const sentence = "One, two, three.";
      expect(splitSentenceIntoPhrases(sentence)).toEqual(["One,", "two,", "three."]);
    });
    
    it('should split by semicolon', () => {
      const sentence = "One; two; three.";
      expect(splitSentenceIntoPhrases(sentence)).toEqual(["One;", "two;", "three."]);
    });

    it('should NOT split by dash', () => {
      const sentence = "This is a well-behaved-dog.";
      expect(splitSentenceIntoPhrases(sentence)).toEqual(["This is a well-behaved-dog."]);
    });

    it('should handle a mix of delimiters', () => {
        const sentence = "One, two; three, four.";
        expect(splitSentenceIntoPhrases(sentence)).toEqual(["One,", "two;", "three,", "four."]);
    });

    it('should return a single-element array if no delimiters are present', () => {
        const sentence = "This is one phrase.";
        expect(splitSentenceIntoPhrases(sentence)).toEqual(["This is one phrase."]);
    });
  });

});
