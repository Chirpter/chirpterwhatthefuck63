// src/services/__tests__/markdown-parser.test.ts

import { describe, it, expect } from 'vitest';
import { 
  parseMarkdownToSegments, 
  splitSentenceIntoPhrases
} from '../shared/SegmentParser'; // Updated import path
import type { Book, Piece, MultilingualContent } from '@/lib/types';

describe('SegmentParser - Unified Architecture', () => {

  // ==========================================
  // 1. Core Segment Parsing
  // ==========================================
  describe('✅ Core Segment Parsing', () => {
    it('should split by H1 headings and paragraphs', () => {
      const md = '# Chapter 1\n\nFirst paragraph.\n\n# Chapter 2\nSecond paragraph.';
      const segments = parseMarkdownToSegments(md, 'en');
      
      expect(segments).toHaveLength(4); // h1, p, h1, p
      
      expect(segments[0]).toMatchObject({ type: 'heading1', content: { en: 'Chapter 1' } });
      expect(segments[1]).toMatchObject({ type: 'start_para', content: { en: 'First paragraph.' } });
      expect(segments[2]).toMatchObject({ type: 'heading1', content: { en: 'Chapter 2' } });
      expect(segments[3]).toMatchObject({ type: 'start_para', content: { en: 'Second paragraph.' } });
    });
    
    it('should correctly handle bilingual headings', () => {
        const md = '# Chapter 1 {Chương 1}';
        const segments = parseMarkdownToSegments(md, 'en-vi');
        expect(segments).toHaveLength(1);
        expect(segments[0]).toMatchObject({
            type: 'heading1',
            content: { en: 'Chapter 1', vi: 'Chương 1' }
        });
    });

    it('should preserve markdown within text content', () => {
        const md = 'This is **bold** and *italic*.';
        const segments = parseMarkdownToSegments(md, 'en');
        expect(segments).toHaveLength(1);
        expect(segments[0].content.en).toBe('This is **bold** and *italic*.');
        expect(segments[0].type).toBe('start_para');
    });

    it('should handle paragraphs with multiple lines', () => {
        const md = 'Line one.\nLine two.';
        const segments = parseMarkdownToSegments(md, 'en');
        expect(segments).toHaveLength(1);
        expect(segments[0].content.en).toBe('Line one.\nLine two.');
    });
  });

  // ==========================================
  // 2. HELPER: splitSentenceIntoPhrases (Assuming it's now part of a client-side utility)
  // This logic is no longer part of the server-side SegmentParser, but we test it for completeness
  // as it would be used by a client-side renderer.
  // ==========================================
  describe('✅ Client-side Utility: splitSentenceIntoPhrases', () => {
    it('should split by comma', () => {
      const sentence = "One, two, three.";
      expect(splitSentenceIntoPhrases(sentence)).toEqual(["One,", "two,", "three."]);
    });
    
    it('should split by semicolon', () => {
      const sentence = "One; two; three.";
      expect(splitSentenceIntoPhrases(sentence)).toEqual(["One;", "two;", "three."]);
    });

    it('should handle a mix of delimiters', () => {
        const sentence = "One, two; three, four.";
        expect(splitSentenceIntoPhrases(sentence)).toEqual(["One,", "two;", "three,", "four."]);
    });
  });
});
