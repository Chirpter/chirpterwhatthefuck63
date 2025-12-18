// src/services/shared/SegmentParser.ts
// ✅ ALL-IN-ONE FILE - No separate strategy files needed

import type { Segment } from '@/lib/types';
import { generateLocalUniqueId } from '@/lib/utils';

/**
 * Origin format parser
 * Extracted inline to avoid circular dependency
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

    return {
      primary,
      secondary,
      isPhrase,
      isBilingual: !!secondary
    };
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

/**
 * Helper: Extract markdown prefix from line
 */
function extractPrefix(line: string): { prefix: string; content: string } {
  const prefixRegex = /^(#+\s*|>\s*|[-*+]\s+)/;
  const match = line.match(prefixRegex);
  const prefix = match ? match[0] : '';
  const content = line.substring(prefix.length);
  return { prefix, content };
}

// ============================================================================
// STRATEGY INTERFACE
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
    const lines = markdown.split(/\r?\n/).filter(line => line.trim() !== '');

    for (const line of lines) {
      const { prefix, content } = extractPrefix(line);

      // Split into sentences (simple regex)
      const sentences = content.match(/[^.!?]+[.!?]*/g) || [content];

      for (const sentence of sentences) {
        const cleaned = cleanText(sentence);
        if (cleaned) {
          segments.push({
            id: generateLocalUniqueId(),
            order: segments.length,
            content: [prefix, { [primary]: cleaned }, '']
          });
        }
      }
    }

    return segments;
  }
}

// ============================================================================
// STRATEGY 2: BILINGUAL SENTENCE MODE
// ============================================================================

class BilingualSentenceStrategy implements ParsingStrategy {
  parse(markdown: string, primary: string, secondary?: string): Segment[] {
    if (!secondary) throw new Error('Secondary language required for bilingual mode');

    const segments: Segment[] = [];
    const lines = markdown.split(/\r?\n/).filter(line => line.trim() !== '');

    // Regex to match: Primary text {Secondary text}
    const bilingualRegex = /(.*?)\s*\{(.*?)\}/g;

    for (const line of lines) {
      const { prefix, content } = extractPrefix(line);

      let match;
      while ((match = bilingualRegex.exec(content)) !== null) {
        const primaryText = cleanText(match[1]);
        const secondaryText = cleanText(match[2]);

        if (primaryText || secondaryText) {
          segments.push({
            id: generateLocalUniqueId(),
            order: segments.length,
            content: [
              prefix,
              {
                [primary]: primaryText,
                [secondary]: secondaryText
              },
              ''
            ]
          });
        }
      }
    }

    return segments;
  }
}

// ============================================================================
// STRATEGY 3: BILINGUAL PHRASE MODE
// ============================================================================

class BilingualPhraseStrategy implements ParsingStrategy {
  parse(markdown: string, primary: string, secondary?: string): Segment[] {
    if (!secondary) throw new Error('Secondary language required for bilingual phrase mode');

    // Step 1: Parse as sentences first
    const sentenceStrategy = new BilingualSentenceStrategy();
    const sentenceSegments = sentenceStrategy.parse(markdown, primary, secondary);

    // Step 2: Break sentences into phrases
    const phraseSegments: Segment[] = [];

    for (const segment of sentenceSegments) {
      const langBlock = segment.content[1];
      if (typeof langBlock === 'string') continue;

      const primaryText = langBlock[primary] || '';
      const secondaryText = langBlock[secondary] || '';

      // Split by common phrase delimiters: comma, semicolon, dash
      const primaryPhrases = this.splitIntoPhrases(primaryText);
      const secondaryPhrases = this.splitIntoPhrases(secondaryText);

      // Match phrases (assume same count for now)
      const maxPhrases = Math.max(primaryPhrases.length, secondaryPhrases.length);

      for (let i = 0; i < maxPhrases; i++) {
        const primaryPhrase = primaryPhrases[i] || '';
        const secondaryPhrase = secondaryPhrases[i] || '';

        if (primaryPhrase || secondaryPhrase) {
          phraseSegments.push({
            id: generateLocalUniqueId(),
            order: phraseSegments.length,
            content: [
              segment.content[0] as string, // Keep prefix from sentence
              {
                [primary]: cleanText(primaryPhrase),
                [secondary]: cleanText(secondaryPhrase)
              },
              ''
            ]
          });
        }
      }
    }

    return phraseSegments;
  }

  private splitIntoPhrases(text: string): string[] {
    // Split by: comma, semicolon, em-dash, or multiple spaces
    return text
      .split(/[,;—]|\s{2,}/)
      .map(p => p.trim())
      .filter(p => p.length > 0);
  }
}

// ============================================================================
// MAIN PARSER CLASS
// ============================================================================

/**
 * Main Segment Parser - Routes to appropriate strategy
 * 
 * This is the ONLY export you need to use
 */
export class SegmentParser {
  /**
   * Parse markdown into segments based on origin
   * 
   * @param markdown - Raw markdown string from AI
   * @param origin - Language format (e.g., "en", "en-vi", "en-vi-ph")
   * @returns Array of structured segments
   */
  static parse(markdown: string, origin: string): Segment[] {
    // Validate origin first
    OriginParser.validate(origin);

    // Parse origin to get components
    const { primary, secondary, isPhrase, isBilingual } = OriginParser.parse(origin);

    // Select strategy
    let strategy: ParsingStrategy;

    if (!isBilingual) {
      // Monolingual mode
      strategy = new MonoStrategy();
    } else if (isPhrase) {
      // Bilingual phrase mode
      strategy = new BilingualPhraseStrategy();
    } else {
      // Bilingual sentence mode
      strategy = new BilingualSentenceStrategy();
    }

    // Execute strategy
    return strategy.parse(markdown, primary, secondary);
  }
}

// ============================================================================
// BACKWARD COMPATIBILITY
// ============================================================================

/**
 * @deprecated Use SegmentParser.parse() instead
 * This is kept for backward compatibility
 */
export function segmentize(markdown: string, origin: string): Segment[] {
  console.warn('[SegmentParser] segmentize() is deprecated. Use SegmentParser.parse() instead.');
  return SegmentParser.parse(markdown, origin);
}