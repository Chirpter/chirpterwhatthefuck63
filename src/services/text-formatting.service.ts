
// src/services/text-formatting.service.ts

/**
 * @fileoverview Service for applying simple markdown-like auto-formatting to HTML content.
 */

interface FormatPattern {
  regex: RegExp;
  replacement: (match: string, content: string) => string;
}

// Order matters: process more specific patterns first.
const FORMATTING_PATTERNS: FormatPattern[] = [
  // Bold: **text** or __text__
  {
    regex: /(\*\*|__)(.*?)\1/g,
    replacement: (match, content) => `<strong>${content}</strong>`,
  },
  // Italic: *text* or _text_
  {
    regex: /(\*|_)(.*?)\1/g,
    replacement: (match, content) => `<em>${content}</em>`,
  },
  // Strikethrough: ~~text~~
  {
    regex: /~~(.*?)~~/g,
    replacement: (match, content) => `<s>${content}</s>`,
  },
];

/**
 * Applies a set of markdown-like formatting rules to an HTML string.
 * It's designed to work on the raw HTML from a contentEditable div.
 * This is a simplified implementation and does not handle nested or complex cases perfectly.
 * @param rawHTML The raw HTML string from the editor.
 * @returns The HTML string with formatting applied.
 */
export function applyAutoFormatting(rawHTML: string): string {
  if (!rawHTML) return '';

  // A simple way to avoid applying formats inside already formatted tags.
  // We can expand this logic later if needed. For now, we apply it globally.
  let processedHTML = rawHTML;

  FORMATTING_PATTERNS.forEach(pattern => {
    processedHTML = processedHTML.replace(pattern.regex, (match, delimiter, content) => {
        // Avoid re-applying formats inside existing tags
        // This is a very basic check
        if (match.includes('<') || match.includes('>')) {
            return match;
        }
        return pattern.replacement(match, content);
    });
  });

  return processedHTML;
}
