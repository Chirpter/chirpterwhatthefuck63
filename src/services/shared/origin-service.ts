// src/services/shared/origin-service.ts

import type { ContentUnit } from '@/lib/types';

/**
 * Origin Service - Single source of truth for origin calculation
 * 
 * Origin format: {primary}[-{secondary}][-ph]
 * Examples:
 * - "en"         → Monolingual English
 * - "en-vi"      → Bilingual English-Vietnamese (sentence mode)
 * - "en-vi-ph"   → Bilingual English-Vietnamese (phrase mode)
 */
export class OriginService {
  /**
   * Calculate origin from user selections
   * This is the ONLY place origin should be calculated
   */
  static calculate(languages: string[], unit: ContentUnit): string {
    if (!languages || languages.length === 0) {
      throw new Error('At least one language must be provided');
    }

    const [primary, secondary] = languages;
    let origin = primary;

    // Add secondary language if bilingual
    if (secondary && secondary !== primary) {
      origin += `-${secondary}`;
    }

    // Add phrase flag if needed
    if (unit === 'phrase' && secondary) {
      origin += '-ph';
    }

    return origin;
  }

  /**
   * Parse origin string into components
   */
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

  /**
   * Validate origin format
   */
  static validate(origin: string): void {
    if (!origin || origin.trim() === '') {
      throw new Error('Origin cannot be empty');
    }

    const parts = origin.split('-');
    if (parts.length > 3) {
      throw new Error(`Invalid origin format: ${origin}`);
    }

    // Check for invalid format flag
    const formatFlags = parts.filter(p => !this.isLanguageCode(p));
    if (formatFlags.length > 1 || (formatFlags.length === 1 && formatFlags[0] !== 'ph')) {
      throw new Error(`Invalid format flag in origin: ${origin}`);
    }
  }

  /**
   * Check if string is a valid language code (simple check)
   */
  private static isLanguageCode(str: string): boolean {
    return /^[a-z]{2}$/.test(str);
  }

  /**
   * Get languages array from origin
   */
  static getLanguages(origin: string): string[] {
    const { primary, secondary } = this.parse(origin);
    return secondary ? [primary, secondary] : [primary];
  }

  /**
   * Get unit from origin
   */
  static getUnit(origin: string): ContentUnit {
    const { isPhrase } = this.parse(origin);
    return isPhrase ? 'phrase' : 'sentence';
  }
}