// src/services/shared/segment-parser-simple-suffix.ts
// ✅ SIMPLE APPROACH - Trust AI's {} logic, just handle external punctuation

import type { Segment } from '@/lib/types';
import { generateLocalUniqueId } from '@/lib/utils';

/**
 * Origin format parser
 */
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
    const parts = origin.split('-');
    if (parts.length > 3) {
      throw new Error(`Invalid origin format: ${origin}`);
    }
  }
}

/**
 * Helper: Clean text (remove footnotes, trim)
 */
function cleanText(text: string): string {
  if (!text) return '';
  return text.replace(/\[\d+\]/g, '').trim();
}

// ============================================================================
// 🆕 SIMPLE PREFIX/SUFFIX EXTRACTION
// ============================================================================

interface TextComponents {
  prefix: string;      // # ## ### > - * + 1. 2. \n\n etc.
  content: string;     // Main text content (everything between prefix and suffix)
  suffix: string;      // . ! ? , ; ... " ' ) \n etc.
}

class PrefixSuffixExtractor {
  /**
   * ✅ SIMPLE LOGIC - Just extract what's OUTSIDE the core content
   * Don't touch anything INSIDE {} - AI already handled it
   */
  static extract(text: string): TextComponents {
    let remaining = text;

    // 1. Extract PREFIX (markdown + leading symbols)
    const prefix = this.extractPrefix(remaining);
    remaining = remaining.substring(prefix.length);

    // 2. Extract SUFFIX (trailing punctuation + newlines)
    const suffix = this.extractSuffix(remaining);
    remaining = remaining.substring(0, remaining.length - suffix.length);

    return {
      prefix: prefix,
      content: remaining.trim(),
      suffix: suffix
    };
  }

  /**
   * Extract prefix: # ## ### > - * + 1. 2. \n\n
   * These are EXTERNAL formatting that should be shared across languages
   */
  private static extractPrefix(text: string): string {
    // Pattern: markdown symbols + optional whitespace
    const match = text.match(/^(#{1,6}\s+|>\s+|[-*+]\s+|\d+\.\s+|\n+)/);
    return match ? match[0] : '';
  }

  /**
   * ✅ KEY: Extract TRAILING punctuation/symbols that are OUTSIDE core content
   * These should be shared across languages (e.g., paragraph breaks)
   */
  private static extractSuffix(text: string): string {
    // Pattern: trailing punctuation, quotes, newlines
    // Only match if they're at the END (not inside the content)
    const match = text.match(/([.!?…,;:"')\]}\n]+)$/);
    return match ? match[0] : '';
  }
}

// ============================================================================
// ADVANCED SENTENCE SPLITTER (unchanged - still needed for monolingual)
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

      // ✅ Extract prefix/suffix from LINE level
      const { prefix, content, suffix } = PrefixSuffixExtractor.extract(line);

      // Split content into sentences
      const sentences = SentenceSplitter.split(content, primary);

      for (let i = 0; i < sentences.length; i++) {
        const sentence = cleanText(sentences[i]);
        if (!sentence) continue;

        // ✅ Use prefix only for first sentence, suffix only for last
        segments.push({
          id: generateLocalUniqueId(),
          order: segments.length,
          content: [
            i === 0 ? prefix : '',                    // Prefix on first sentence only
            { [primary]: sentence },
            i === sentences.length - 1 ? suffix : ''  // Suffix on last sentence only
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

      // ✅ Extract prefix/suffix BEFORE looking at {}
      const { prefix, content, suffix } = PrefixSuffixExtractor.extract(line);

      // ✅ TRUST AI - Extract pairs from content (AI already put punctuation inside {})
      const pairs = this.extractBilingualPairs(content);

      for (let i = 0; i < pairs.length; i++) {
        const primaryText = cleanText(pairs[i].primary);
        const secondaryText = cleanText(pairs[i].secondary);

        if (!primaryText && !secondaryText) continue;

        // ✅ Use prefix only for first pair, suffix only for last
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
   * ✅ SIMPLE extraction - Trust that AI put everything correctly inside {}
   * Just split by {} pattern
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

      // ✅ Extract prefix/suffix at LINE level
      const { prefix, content, suffix } = PrefixSuffixExtractor.extract(line);

      // Extract phrase pairs
      const pairs = this.extractPhrasePairs(content);

      for (let i = 0; i < pairs.length; i++) {
        const primaryText = cleanText(pairs[i].primary);
        const secondaryText = cleanText(pairs[i].secondary);

        if (!primaryText && !secondaryText) continue;

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
   * Extract phrase pairs - similar to sentence but respects phrase delimiters
   */
  private extractPhrasePairs(text: string): Array<{ primary: string; secondary: string }> {
    const pairs: Array<{ primary: string; secondary: string }> = [];

    // Find translation block
    const match = text.match(/^(.*?)\s*\{(.*?)\}\s*$/);
    
    if (!match) {
      return [{ primary: text, secondary: '' }];
    }

    const primaryBlock = match[1];
    const secondaryBlock = match[2];

    // Split both blocks into phrases
    const primaryPhrases = this.splitIntoPhrases(primaryBlock);
    const secondaryPhrases = this.splitIntoPhrases(secondaryBlock);

    const maxPhrases = Math.max(primaryPhrases.length, secondaryPhrases.length);

    for (let i = 0; i < maxPhrases; i++) {
      pairs.push({
        primary: primaryPhrases[i] || '',
        secondary: secondaryPhrases[i] || ''
      });
    }

    return pairs;
  }

  private splitIntoPhrases(text: string): string[] {
    return text
      .split(/[,;—]/)
      .map(p => p.trim())
      .filter(p => p.length > 0);
  }
}

// ============================================================================
// MAIN PARSER CLASS
// ============================================================================

export class SegmentParser {
  /**
   * Parse markdown into segments based on origin
   */
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

// ============================================================================
// TEST CASES - Verify prefix/suffix handling
// ============================================================================

export const __tests__ = {
  testPrefixSuffix() {
    console.log('🧪 Testing Prefix/Suffix Extraction...\n');

    const cases = [
      {
        name: 'Markdown header',
        input: '# Chapter 1: The Beginning',
        expected: { prefix: '# ', content: 'Chapter 1: The Beginning', suffix: '' }
      },
      {
        name: 'Trailing period',
        input: 'The cat sat.',
        expected: { prefix: '', content: 'The cat sat.', suffix: '' }
      },
      {
        name: 'Header with trailing period',
        input: '# Chapter 1.',
        expected: { prefix: '# ', content: 'Chapter 1', suffix: '.' }
      },
      {
        name: 'Double newline (paragraph break)',
        input: 'Some text\n\n',
        expected: { prefix: '', content: 'Some text', suffix: '\n\n' }
      },
      {
        name: 'Quote with period',
        input: '"Hello," he said.',
        expected: { prefix: '', content: '"Hello," he said', suffix: '.' }
      },
    ];

    cases.forEach(({ name, input, expected }) => {
      const result = PrefixSuffixExtractor.extract(input);
      const pass = 
        result.prefix === expected.prefix &&
        result.content === expected.content &&
        result.suffix === expected.suffix;
      
      console.log(`${pass ? '✅' : '❌'} ${name}`);
      if (!pass) {
        console.log('  Expected:', expected);
        console.log('  Got:', result);
      }
    });

    console.log('\n');
  },

  testBilingualWithExternalPunctuation() {
    console.log('🧪 Testing Bilingual with External Punctuation...\n');

    const input = `# Chapter 1 {Chương 1}

The cat sat {Con mèo ngồi}.

"Hello," he said {anh ấy nói}!`;

    const segments = SegmentParser.parse(input, 'en-vi');

    console.log('Parsed segments:', JSON.stringify(segments, null, 2));
    console.log('\n✅ Check if:');
    console.log('  - First segment has prefix: "# "');
    console.log('  - Second segment has suffix: "."');
    console.log('  - Third segment has suffix: "!"');
  },

  runAll() {
    this.testPrefixSuffix();
    this.testBilingualWithExternalPunctuation();
    console.log('✅ All tests complete!');
  }
};
