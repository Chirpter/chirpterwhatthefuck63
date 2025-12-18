// src/services/shared/segment-parser.ts
// ✅ REFACTORED to handle phrase mode correctly

import type { Segment, LanguageBlock, ContentUnit } from '@/lib/types';
import { generateLocalUniqueId } from '@/lib/utils';

// Helper: Clean text (remove footnotes, trim)
function cleanText(text: string): string {
  if (!text) return '';
  return text.replace(/\[\d+\]/g, '').trim();
}

interface TextComponents {
  prefix: string;
  content: string;
  suffix: string;
}

class PrefixSuffixExtractor {
  static extract(text: string): TextComponents {
    const prefixMatch = text.match(/^(#{1,6}\s*|>\s*|[-*+]\s*|\d+\.\s+)/);
    const prefix = prefixMatch ? prefixMatch[0] : '';
    const contentWithoutPrefix = text.substring(prefix.length);

    const suffixMatch = contentWithoutPrefix.match(/([.!?…,;:"')\]}\n\s]+)$/);
    const suffix = suffixMatch ? suffixMatch[0] : '';
    const coreContent = contentWithoutPrefix.substring(0, contentWithoutPrefix.length - suffix.length);

    return {
      prefix: prefix,
      content: coreContent.trim(),
      suffix: suffix,
    };
  }
}

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

interface ParsingStrategy {
  parse(markdown: string, primary: string, secondary?: string): Segment[];
}

class MonoStrategy implements ParsingStrategy {
  parse(markdown: string, primary: string): Segment[] {
    const segments: Segment[] = [];
    const lines = markdown.split(/\r?\n/);

    for (const line of lines) {
      if (!line.trim()) continue;

      const sentences = SentenceSplitter.split(line, primary);

      for (const sentence of sentences) {
        const cleanedSentence = cleanText(sentence);
        if (!cleanedSentence) continue;

        const { prefix, content, suffix } = PrefixSuffixExtractor.extract(sentence);

        segments.push({
          id: generateLocalUniqueId(),
          order: segments.length,
          content: [
            prefix,
            { [primary]: content },
            suffix
          ]
        });
      }
    }
    return segments;
  }
}

class BilingualSentenceStrategy implements ParsingStrategy {
    parse(markdown: string, primary: string, secondary: string): Segment[] {
      const segments: Segment[] = [];
      const lines = markdown.split(/\r?\n/);
  
      for (const line of lines) {
        if (!line.trim()) continue;
        
        const { prefix, content, suffix } = PrefixSuffixExtractor.extract(line);
        
        const match = content.match(/^(.*?)\s*\{(.*)\}\s*$/);
        
        if (match) {
          const primaryText = cleanText(match[1]);
          const secondaryText = cleanText(match[2]);
          
          if (primaryText || secondaryText) {
            segments.push({
              id: generateLocalUniqueId(),
              order: segments.length,
              content: [prefix, { [primary]: primaryText, [secondary]: secondaryText }, suffix]
            });
          }
        } else if (content) {
            segments.push({
                id: generateLocalUniqueId(),
                order: segments.length,
                content: [prefix, { [primary]: content, [secondary]: '' }, suffix]
            });
        }
      }
      return segments;
    }
}
  
class BilingualPhraseStrategy implements ParsingStrategy {
    parse(markdown: string, primary: string, secondary: string): Segment[] {
      const segments: Segment[] = [];
      const lines = markdown.split(/\r?\n/);
  
      for (const line of lines) {
        if (!line.trim()) continue;
  
        const { prefix, content, suffix } = PrefixSuffixExtractor.extract(line);
        
        const match = content.match(/^(.*?)\s*\{(.*)\}\s*$/);
        if (!match) {
          if (content) {
             segments.push({
                id: generateLocalUniqueId(),
                order: segments.length,
                content: [prefix, [{ [primary]: content, [secondary]: '' }], suffix]
             });
          }
          continue;
        }

        const primaryBlock = match[1];
        const secondaryBlock = match[2];

        const primaryPhrases = this.splitIntoPhrases(primaryBlock);
        const secondaryPhrases = this.splitIntoPhrases(secondaryBlock);

        const phrasePairs: LanguageBlock[] = [];
        const maxPhrases = Math.max(primaryPhrases.length, secondaryPhrases.length);
  
        for (let i = 0; i < maxPhrases; i++) {
          const primaryPhrase = primaryPhrases[i] || '';
          const secondaryPhrase = secondaryPhrases[i] || '';
          if(primaryPhrase || secondaryPhrase) {
              phrasePairs.push({
                  [primary]: primaryPhrase,
                  [secondary]: secondaryPhrase
              });
          }
        }

        if (phrasePairs.length > 0) {
            segments.push({
                id: generateLocalUniqueId(),
                order: segments.length,
                // ✅ FIX: The content is now prefix, an ARRAY of phrase pairs, and suffix
                content: [prefix, phrasePairs, suffix]
            });
        }
      }
  
      return segments;
    }

    private splitIntoPhrases(text: string): string[] {
        return text.split(/[,;—]/).map(p => p.trim()).filter(p => p.length > 0);
    }
}


export class SegmentParser {
  static parse(markdown: string, origin: string): Segment[] {
    const { primary, secondary, isPhrase, isBilingual } = OriginService.parse(origin);

    let strategy: ParsingStrategy;

    if (!isBilingual) {
      strategy = new MonoStrategy();
    } else if (isPhrase) {
      strategy = new BilingualPhraseStrategy();
    } else {
      strategy = new BilingualSentenceStrategy();
    }

    return strategy.parse(markdown, primary, secondary!);
  }
}

// We no longer need the OriginService here if it's imported separately.
// Assuming it's in its own file now.
import { OriginService } from './origin-service';
