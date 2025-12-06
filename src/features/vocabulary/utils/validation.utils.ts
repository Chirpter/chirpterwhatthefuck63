
// src/features/vocabulary/utils/validation.utils.ts

import { VOCABULARY_CONSTANTS } from '@/lib/constants';
import { FOLDER_CONSTANTS } from '../constants';

export interface ValidationResult {
  isValid: boolean;
  error: string | null;
}

const RESERVED_FOLDER_NAMES = [
    FOLDER_CONSTANTS.UNORGANIZED,
    FOLDER_CONSTANTS.NEW_FOLDER_OPTION,
    FOLDER_CONSTANTS.ALL_FOLDERS,
] as const;


/**
 * Validates folder name according to app rules
 * - Must not be empty
 * - Max 50 characters
 * - No dangerous file system characters
 * - Not a reserved name
 * - Must be unique (case-insensitive)
 */
export function validateFolderName(
  name: string,
  existingFolders: string[]
): ValidationResult {
  const trimmed = name.trim();
  
  if (!trimmed) {
    return { isValid: false, error: 'Folder name is required' };
  }
  
  if (trimmed.length > 50) {
    return { isValid: false, error: 'Folder name too long (max 50 characters)' };
  }
  
  // Allow Unicode (for international names) but prevent dangerous file system characters
  // Blocked: < > : " / \ | ? * and control characters
  if (/[<>:"\/\\|?*\x00-\x1F]/.test(trimmed)) {
    return { isValid: false, error: 'Invalid characters in folder name' };
  }
  
  if (RESERVED_FOLDER_NAMES.includes(trimmed.toLowerCase() as any)) {
    return { isValid: false, error: 'This folder name is reserved' };
  }
  
  if (existingFolders.some(f => f.toLowerCase() === trimmed.toLowerCase())) {
    return { isValid: false, error: 'Folder already exists' };
  }
  
  return { isValid: true, error: null };
}

/**
 * Validates vocabulary item fields (client-side, matches service layer)
 * Validates:
 * - Required fields (term, meaning)
 * - No HTML tags
 * - No special characters that could cause issues
 * - Length constraints
 */
export function validateVocabFields(data: {
  term: string;
  meaning: string;
  example?: string;
}): ValidationResult {
  const { term, meaning, example } = data;
  
  // Required fields
  if (!term?.trim()) {
    return { isValid: false, error: 'Term is required' };
  }
  
  if (!meaning?.trim()) {
    return { isValid: false, error: 'Meaning is required' };
  }
  
  // HTML check - prevents XSS and formatting issues
  const hasHTML = /<[^>]*>/g;
  if (hasHTML.test(term) || hasHTML.test(meaning) || (example && hasHTML.test(example))) {
    return { isValid: false, error: 'HTML tags are not allowed' };
  }
  
  // Special characters that could cause parsing issues
  const hasSpecialChars = /[<>()\[\]{}]/;
  if (hasSpecialChars.test(term) || hasSpecialChars.test(meaning) || (example && hasSpecialChars.test(example))) {
    return { isValid: false, error: 'Special characters like < > ( ) [ ] { } are not allowed' };
  }
  
  // Length checks (from VOCABULARY_CONSTANTS)
  if (term.length > VOCABULARY_CONSTANTS.VALIDATION.MAX_TERM_LENGTH) {
    return { isValid: false, error: `Term exceeds maximum length (${VOCABULARY_CONSTANTS.VALIDATION.MAX_TERM_LENGTH} characters)` };
  }
  
  if (meaning.length > VOCABULARY_CONSTANTS.VALIDATION.MAX_MEANING_LENGTH) {
    return { isValid: false, error: `Meaning exceeds maximum length (${VOCABULARY_CONSTANTS.VALIDATION.MAX_MEANING_LENGTH} characters)` };
  }
  
  if (example && example.length > VOCABULARY_CONSTANTS.VALIDATION.MAX_EXAMPLE_LENGTH) {
    return { isValid: false, error: `Example exceeds maximum length (${VOCABULARY_CONSTANTS.VALIDATION.MAX_EXAMPLE_LENGTH} characters)` };
  }
  
  return { isValid: true, error: null };
}
