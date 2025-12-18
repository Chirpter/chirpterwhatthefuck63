// src/services/shared/segment-parser.ts
// ✅ CORRECTED VERSION - Based on agreed logic

import type { Segment } from '@/lib/types';
import { generateLocalUniqueId } from '@/lib/utils';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function cleanText(text: string): string {
  if (!text) return '';
  return text.replace(/\[\d+\]/g, '').trim();
}

// ============================================================================
// PREFIX/SUFFIX EXTRACTOR - CORRECT LOGIC
// ============================================================================

interface TextComponents {
  prefix: string;
  content: string;
  suffix: string;
}

class PrefixSuffixExtractor {
  /**
   * ✅ Extract prefix, content, and suffix
   */
  static extract(text: string): TextComponents {
    // 1. Extract prefix
    const prefix = this.extractPrefix(text);
    let remaining = text.substring(prefix.length);

    // 2. Extract suffix
    const suffix = this.extractSuffix(remaining);
    remaining = remaining.substring(0, remaining.length - suffix.length);

    return {
      prefix,
      content: remaining.trim(),
      suffix
    };
  }

  /**
   * ✅ Extract prefix: markdown symbols at START
   */
  private static extractPrefix(text: string): string {
    const match = text.match(/^(#{1,6}\s+|>\s+|[-*+]\s+|\d+\.\s+|\n+)/);
    return match ? match[0] : '';
  }

  /**
   * ✅ Extract suffix: punctuation AFTER } with NO space
   * Key: {} belongs to lang2, suffix is what comes AFTER }
   */
  private static extractSuffix(text: string): string {
    // Pattern: } followed IMMEDIATELY by punctuation (no space)
    const match = text.match(/\}([.!?…,;:"'\])\n]+)$/);
    
    if (match) {
      return match[1]; // Return only the punctuation part
    }
    
    // If no {} in text, check for trailing punctuation normally
    if (!text.includes('}')) {
      const normalMatch = text.match(/([.!?…,;:"'\])\n]+)$/);
      return normalMatch ? normalMatch[0] : '';
    }
    
    return '';
  }
}

// ============================================================================
// SENTENCE SPLITTER
// ============================================================================

class SentenceSplitter {
  static split(text: string, lang?: string): string[] {
    if (!text || text.length < 2) return text ? [text] : [];
    const detectedLang = lang || this.detectLanguage(text);

    switch (detectedLang) {
      case 'zh':
      case 'ja':
        return this.splitCJK(text);
      case 'ar':
        return this.splitArabic(text);
      case 'ko':
        return this.splitKorean(text);
      default:
        return this.splitLatin(text);
    }
  }

  private static splitLatin(text: string): string[] {
    const sentences: string[] = [];
    let current = '';
    const tokens = text.split(/([.!?]+)/);

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (!token) continue;

      if (/^[.!?]+$/.test(token)) {
        current += token;
        const nextToken = tokens[i + 1]?.trim();
        
        if (
          i === tokens.length - 1 ||
          !nextToken ||
          /^[A-Z"'"]/.test(nextToken) ||
          token.length > 1
        ) {
          if (!this.isAbbreviation(current)) {
            sentences.push(current.trim());
            current = '';
          }
        }
      } else {
        current += token;
      }
    }

    if (current.trim()) sentences.push(current.trim());
    return sentences.filter(s => s.length > 0);
  }

  private static splitCJK(text: string): string[] {
    return text.split(/([。！？]+)/).reduce((acc: string[], token, i, arr) => {
      if (i % 2 === 0) {
        const sent = token + (arr[i + 1] || '');
        if (sent.trim()) acc.push(sent.trim());
      }
      return acc;
    }, []);
  }

  private static splitKorean(text: string): string[] {
    return text.split(/([.!?]+\s+)/).reduce((acc: string[], token, i, arr) => {
      if (i % 2 === 0) {
        const sent = token + (arr[i + 1] || '');
        if (sent.trim()) acc.push(sent.trim());
      }
      return acc;
    }, []);
  }

  private static splitArabic(text: string): string[] {
    return text.split(/([.؟!]+)/).reduce((acc: string[], token, i, arr) => {
      if (i % 2 === 0) {
        const sent = token + (arr[i + 1] || '');
        if (sent.trim()) acc.push(sent.trim());
      }
      return acc;
    }, []);
  }

  private static isAbbreviation(text: string): boolean {
    const abbrevs = [
      'Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.', 'Sr.', 'Jr.',
      'Ph.D.', 'M.D.', 'U.S.', 'U.K.', 'U.S.A.',
      'etc.', 'vs.', 'e.g.', 'i.e.', 'St.', 'Ave.', 'Blvd.', 'Rd.',
    ];
    const trimmed = text.trim();
    return abbrevs.some(abbr => 
      trimmed.endsWith(abbr) || trimmed.endsWith(abbr.toLowerCase())
    );
  }

  private static detectLanguage(text: string): string {
    if (/[\u4e00-\u9fff]/.test(text)) return 'zh';
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'ja';
    if (/[\uac00-\ud7af]/.test(text)) return 'ko';
    if (/[\u0600-\u06ff]/.test(text)) return 'ar';
    return 'en';
  }
}

// ============================================================================
// PARSING STRATEGIES
// ============================================================================

interface ParsingStrategy {
  parse(markdown: string, primary: string, secondary?: string): Segment[];
}

// ============================================================================
// STRATEGY 1: MONOLINGUAL
// ============================================================================

class MonoStrategy implements ParsingStrategy {
  parse(markdown: string, primary: string): Segment[] {
    const segments: Segment[] = [];
    const lines = markdown.split(/\r?\n/);

    for (const line of lines) {
      if (!line.trim()) continue;

      // Extract prefix/suffix at LINE level
      const { prefix, content, suffix } = PrefixSuffixExtractor.extract(line);

      // Split content into sentences
      const sentences = SentenceSplitter.split(content, primary);

      for (let i = 0; i < sentences.length; i++) {
        const sentence = cleanText(sentences[i]);
        if (!sentence) continue;

        // ✅ Prefix only on first sentence, suffix only on last
        segments.push({
          id: generateLocalUniqueId(),
          order: segments.length,
          content: [
            i === 0 ? prefix : '',
            { [primary]: sentence },
            i === sentences.length - 1 ? suffix : ''
          ]
        });
      }
    }

    return segments;
  }
}

// ============================================================================
// STRATEGY 2: BILINGUAL SENTENCE
// ============================================================================

class BilingualSentenceStrategy implements ParsingStrategy {
  parse(markdown: string, primary: string, secondary?: string): Segment[] {
    if (!secondary) throw new Error('Secondary language required');

    const segments: Segment[] = [];
    const lines = markdown.split(/\r?\n/);

    for (const line of lines) {
      if (!line.trim()) continue;

      // Extract prefix/suffix at LINE level
      const { prefix, content, suffix } = PrefixSuffixExtractor.extract(line);

      // ✅ Extract bilingual pairs: A {X} B {Y} C {Z}
      const pairs = this.extractBilingualPairs(content);

      for (let i = 0; i < pairs.length; i++) {
        const primaryText = cleanText(pairs[i].primary);
        const secondaryText = cleanText(pairs[i].secondary);

        if (!primaryText && !secondaryText) continue;

        // ✅ Prefix only on first pair, suffix only on last
        segments.push({
          id: generateLocalUniqueId(),
          order: segments.length,
          content: [
            i === 0 ? prefix : '',
            {
              [primary]: primaryText,
              [secondary]: secondaryText
            },
            i === pairs.length - 1 ? suffix : ''
          ]
        });
      }
    }

    return segments;
  }

  /**
   * ✅ Extract bilingual sentence pairs: A {X} B {Y}
   * Pattern: Text before {} is primary, text inside {} is secondary
   */
  private extractBilingualPairs(text: string): Array<{ primary: string; secondary: string }> {
    const pairs: Array<{ primary: string; secondary: string }> = [];
    
    // Find all {...} blocks
    const braceRegex = /\{([^{}]*)\}/g;
    const translations: string[] = [];
    let match;
    
    while ((match = braceRegex.exec(text)) !== null) {
      translations.push(match[1]);
    }

    // Remove all {...} to get primary texts
    const primaryTexts = text
      .replace(/\{[^{}]*\}/g, '|||')
      .split('|||')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    // Pair them up
    const maxLength = Math.max(primaryTexts.length, translations.length);
    
    for (let i = 0; i < maxLength; i++) {
      pairs.push({
        primary: primaryTexts[i] || '',
        secondary: translations[i] || ''
      });
    }

    return pairs;
  }
}

// ============================================================================
// STRATEGY 3: BILINGUAL PHRASE
// ============================================================================

class BilingualPhraseStrategy implements ParsingStrategy {
  parse(markdown: string, primary: string, secondary?: string): Segment[] {
    if (!secondary) throw new Error('Secondary language required');

    const segments: Segment[] = [];
    const lines = markdown.split(/\r?\n/);

    for (const line of lines) {
      if (!line.trim()) continue;

      // Extract prefix/suffix at LINE level
      const { prefix, content, suffix } = PrefixSuffixExtractor.extract(line);

      // ✅ Extract phrase pairs from the line
      const result = this.extractPhrasePairs(content, primary, secondary);

      if (!result) continue;

      // ✅ ONE segment per line with phrase arrays
      segments.push({
        id: generateLocalUniqueId(),
        order: segments.length,
        content: [
          prefix,
          result, // { en: ["A", "B"], vi: ["X", "Y"] }
          suffix
        ]
      });
    }

    return segments;
  }

  /**
   * ✅ Extract phrase pairs and return as language arrays
   * Input: "A, B, C {X, Y, Z}"
   * Output: { en: ["A", "B", "C"], vi: ["X", "Y", "Z"] }
   */
  private extractPhrasePairs(
    text: string, 
    primary: string, 
    secondary: string
  ): Record<string, string[]> | null {
    // Match pattern: "primary text {secondary text}"
    const match = text.match(/^(.*?)\s*\{(.*?)\}\s*$/);
    
    if (!match) {
      // No {} found, treat entire text as primary only
      const phrases = this.splitIntoPhrases(text);
      if (phrases.length === 0) return null;
      
      return {
        [primary]: phrases,
        [secondary]: []
      };
    }

    const primaryBlock = match[1];
    const secondaryBlock = match[2];

    const primaryPhrases = this.splitIntoPhrases(primaryBlock);
    const secondaryPhrases = this.splitIntoPhrases(secondaryBlock);

    if (primaryPhrases.length === 0 && secondaryPhrases.length === 0) {
      return null;
    }

    return {
      [primary]: primaryPhrases,
      [secondary]: secondaryPhrases
    };
  }

  /**
   * Split text into phrases by delimiters: , ; —
   */
  private splitIntoPhrases(text: string): string[] {
    return text
      .split(/[,;—]/)
      .map(p => cleanText(p))
      .filter(p => p.length > 0);
  }
}

// ============================================================================
// MAIN PARSER
// ============================================================================

class OriginParser {
  static parse(origin: string): {
    primary: string;
    secondary?: string;
    isPhrase: boolean;
    isBilingual: boolean;
  } {
    const parts = origin.split('-');
    const [primary, ...rest] = parts;
    const isPhrase = rest.includes('ph');
    const secondary = rest.find(part => part !== 'ph');
    return { primary, secondary, isPhrase, isBilingual: !!secondary };
  }

  static validate(origin: string): void {
    if (!origin || origin.trim() === '') {
      throw new Error('Origin cannot be empty');
    }
  }
}

export class SegmentParser {
  static parse(markdown: string, origin: string): Segment[] {
    OriginParser.validate(origin);

    const { primary, secondary, isPhrase, isBilingual } = OriginParser.parse(origin);

    let strategy: ParsingStrategy;

    if (!isBilingual) {
      strategy = new MonoStrategy();
    } else if (isPhrase) {
      strategy = new BilingualPhraseStrategy();
    } else {
      strategy = new BilingualSentenceStrategy();
    }

    return strategy.parse(markdown, primary, secondary);
  }
}
