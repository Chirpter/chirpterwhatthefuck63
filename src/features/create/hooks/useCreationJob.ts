// src/services/shared/segment-parser.ts
// ✅ MINIMAL FIX: Chỉ thêm fallback, KHÔNG validate

import type { Segment } from '@/lib/types';
import { generateLocalUniqueId } from '@/lib/utils';

function cleanText(text: string): string {
  if (!text) return '';
  return text.replace(/\[\d+\]/g, '').trim();
}

// ============================================================================
// ORIGIN PARSER
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

// ============================================================================
// SENTENCE SPLITTER (for Monolingual)
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
// PREFIX/SUFFIX EXTRACTOR (for Monolingual & Phrase)
// ============================================================================

interface TextComponents {
  prefix: string;
  content: string;
  suffix: string;
}

class PrefixSuffixExtractor {
  static extract(text: string): TextComponents {
    const prefix = this.extractPrefix(text);
    let remaining = text.substring(prefix.length);
    const suffix = this.extractSuffix(remaining);
    remaining = remaining.substring(0, remaining.length - suffix.length);

    return {
      prefix,
      content: remaining.trim(),
      suffix
    };
  }

  private static extractPrefix(text: string): string {
    const match = text.match(/^(\n*#{1,6}\s+|\n*>\s+|\n*[-*+]\s+|\n*\d+\.\s+|\n+)/);
    return match ? match[0] : '';
  }

  private static extractSuffix(text: string): string {
    const match = text.match(/\}([.!?…,;:"'\])\n]?)$/);
    if (match) {
      const captured = match[1];
      if (captured.endsWith('\n\n')) {
        return captured.slice(0, -1);
      }
      return captured;
    }
    
    if (!text.includes('}')) {
      const normalMatch = text.match(/([.!?…,;:"'\])\n]?)$/);
      if (normalMatch) {
        const captured = normalMatch[0];
        if (captured.endsWith('\n\n')) {
          return captured.slice(0, -1);
        }
        return captured;
      }
    }
    
    return '';
  }
}

// ============================================================================
// SEQUENTIAL BILINGUAL PARSER
// ============================================================================

interface SegmentPart {
  prefix: string;
  lang1: string;
  lang2: string;
  suffix: string;
}

class SequentialBilingualParser {
  static parse(text: string): SegmentPart[] {
    const segments: SegmentPart[] = [];
    let i = 0;
    const len = text.length;

    while (i < len) {
      const part: SegmentPart = {
        prefix: '',
        lang1: '',
        lang2: '',
        suffix: ''
      };

      // Extract prefix
      const prefixResult = this.extractPrefix(text, i);
      part.prefix = prefixResult.prefix;
      i = prefixResult.nextIndex;

      // Read lang1 until {
      while (i < len && text[i] !== '{') {
        part.lang1 += text[i];
        i++;
      }

      if (i >= len) {
        if (part.lang1.trim()) {
          segments.push(part);
        }
        break;
      }

      // Skip {
      i++;

      // Read lang2 until }
      while (i < len && text[i] !== '}') {
        part.lang2 += text[i];
        i++;
      }

      if (i >= len) {
        segments.push(part);
        break;
      }

      // Skip }
      i++;

      // Extract suffix
      const suffixResult = this.extractSuffix(text, i);
      part.suffix = suffixResult.suffix;
      i = suffixResult.nextIndex;

      segments.push(part);
    }

    return segments;
  }

  private static extractPrefix(text: string, startIndex: number): {
    prefix: string;
    nextIndex: number;
  } {
    let prefix = '';
    let i = startIndex;
    const len = text.length;

    while (i < len && text[i] === '\n') {
      prefix += text[i];
      i++;
    }

    const remaining = text.substring(i);
    const match = remaining.match(/^(#{1,6}\s+|>\s+|[-*+]\s+|\d+\.\s+)/);
    
    if (match) {
      prefix += match[0];
      i += match[0].length;
    }

    return { prefix, nextIndex: i };
  }

  private static extractSuffix(text: string, startIndex: number): {
    suffix: string;
    nextIndex: number;
  } {
    let suffix = '';
    let i = startIndex;
    const len = text.length;
    let newlineCount = 0;

    while (i < len && /[.!?…,;:"'\])\n]/.test(text[i])) {
      if (text[i] === '\n') {
        newlineCount++;
        if (newlineCount === 1) {
          suffix += text[i];
          i++;
        } else {
          break;
        }
      } else {
        suffix += text[i];
        i++;
      }
    }

    return { suffix, nextIndex: i };
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

      const { prefix, content, suffix } = PrefixSuffixExtractor.extract(line);
      const sentences = SentenceSplitter.split(content, primary);

      for (let i = 0; i < sentences.length; i++) {
        const sentence = cleanText(sentences[i]);
        if (!sentence) continue;

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

    const parts = SequentialBilingualParser.parse(markdown);
    const segments: Segment[] = [];

    for (const part of parts) {
      segments.push({
        id: generateLocalUniqueId(),
        order: segments.length,
        content: [
          part.prefix,
          {
            [primary]: cleanText(part.lang1),
            [secondary]: cleanText(part.lang2)
          },
          part.suffix
        ]
      });
    }

    return segments;
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

      const { prefix, content, suffix } = PrefixSuffixExtractor.extract(line);
      const result = this.extractPhrasePairs(content, primary, secondary);

      if (!result) continue;

      segments.push({
        id: generateLocalUniqueId(),
        order: segments.length,
        content: [prefix, result, suffix]
      });
    }

    return segments;
  }

  private extractPhrasePairs(
    text: string, 
    primary: string, 
    secondary: string
  ): Record<string, string[]> | null {
    const match = text.match(/^(.*?)\s*\{(.*?)\}\s*$/);
    
    if (!match) {
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

    const segments = strategy.parse(markdown, primary, secondary);
    
    // ✅ ONLY CHANGE: Fallback if parser completely fails
    if (segments.length === 0) {
      console.warn('[Parser] No segments parsed, falling back to raw markdown');
      return [{
        id: generateLocalUniqueId(),
        order: 0,
        content: [{ [primary]: markdown }]
      }];
    }
    
    return segments;
  }
}