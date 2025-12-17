// src/services/__tests__/markdown-parser.test.ts

import { describe, it, expect } from 'vitest';
import { 
  segmentize, 
} from '../shared/SegmentParser'; // Updated import path
import type { Book, Piece, MultilingualContent } from '@/lib/types';

describe('SegmentParser - Unified Architecture', () => {

  // ==========================================
  // 1. Core Segment Parsing
  // ==========================================
  describe('✅ Core Segment Parsing with segmentize', () => {
    it('should split by H1 headings and paragraphs into structured segments', () => {
      const md = '# Chapter 1 {Chương 1}\n\nFirst paragraph. {Đoạn đầu tiên.}';
      const segments = segmentize(md, 'en-vi');
      
      expect(segments).toHaveLength(2);
      
      // Test Heading
      expect(segments[0].type).toBe('heading1');
      expect(segments[0].content).toEqual(['# ', { en: 'Chapter 1', vi: 'Chương 1' }]);
      
      // Test Paragraph
      expect(segments[1].type).toBeUndefined();
      expect(segments[1].content).toEqual(['', { en: 'First paragraph.', vi: 'Đoạn đầu tiên.' }]);
    });
    
    it('should handle monolingual content correctly', () => {
        const md = '# Monolingual Title\n\nJust one language here.';
        const segments = segmentize(md, 'en');

        expect(segments).toHaveLength(2);
        expect(segments[0]).toMatchObject({
            type: 'heading1',
            content: ['# ', { en: 'Monolingual Title' }]
        });
        expect(segments[1]).toMatchObject({
            type: undefined,
            content: ['', { en: 'Just one language here.' }]
        });
    });

    it('should preserve markdown within text content inside the language block', () => {
        const md = 'This is **bold** and *italic*. {Đây là **đậm** và *nghiêng*.}';
        const segments = segmentize(md, 'en-vi');
        expect(segments).toHaveLength(1);
        expect(segments[0].content[1]).toEqual({
          en: 'This is **bold** and *italic*.',
          vi: 'Đây là **đậm** và *nghiêng*.'
        });
    });

    it('should handle paragraphs with multiple lines and keep newlines in suffix', () => {
        const md = 'Line one.\nLine two.';
        const segments = segmentize(md, 'en');
        // This will now be treated as a single line since there are no {} and it's parsed as one block
        expect(segments).toHaveLength(1);
        expect(segments[0].content[0]).toEqual({ en: 'Line one.\nLine two.' });
    });
  });

});
