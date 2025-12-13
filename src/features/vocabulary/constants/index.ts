// src/features/vocabulary/constants/index.ts
// ============================================================================
// CENTRALIZED CONSTANTS FOR VOCABULARY FEATURE
// All magic strings and configuration values should be defined here
// ============================================================================

/**
 * Folder-related constants
 * Used across the vocabulary feature for folder management
 */
export const FOLDER_CONSTANTS = {
    UNORGANIZED: 'unorganized',
    NEW_FOLDER_OPTION: 'new',
    ALL_FOLDERS: 'all',
  } as const;
  
  export type FolderConstant = typeof FOLDER_CONSTANTS[keyof typeof FOLDER_CONSTANTS];
  
  /**
   * Vocabulary scope types
   * - global: All vocabulary items for the user
   * - local: Context-specific vocabulary (e.g., from videos, reading)
   */
  export enum VocabScope {
    GLOBAL = 'global',
    LOCAL = 'local',
  }
  
  /**
   * Learning contexts where vocabulary can be created
   * Used to track the source/origin of vocabulary items
   */
  export enum VocabContext {
    MANUAL = 'manual',
    VOCAB_VIDEOS = 'vocab-videos',
    READING = 'reading',
    CONVERSATION = 'conversation',
  }
  
  /**
   * Source types for vocabulary items
   * Determines where the vocabulary was encountered
   */
  export enum SourceType {
    BOOK = 'book',
    ARTICLE = 'article',
    VIDEO = 'video',
    MANUAL = 'manual',
  }
  
  /**
   * SRS (Spaced Repetition System) states
   * Tracks the learning progress of vocabulary items
   */
  export enum SrsState {
    NEW = 'new',
    LEARNING = 'learning',
    SHORT_TERM = 'short-term',
    LONG_TERM = 'long-term',
  }
  
  /**
   * Validation constants for vocabulary fields
   */
  export const VOCABULARY_CONSTANTS = {
    VALIDATION: {
      MAX_TERM_LENGTH: 100,
      MAX_MEANING_LENGTH: 500,
      MAX_EXAMPLE_LENGTH: 500,
      MAX_FOLDER_NAME_LENGTH: 50,
      MIN_SEARCH_QUERY_LENGTH: 2,
    },
    SEARCH: {
      DEBOUNCE_MS: 300,
    }
  } as const;
  
  /**
   * UI-related constants
   */
  export const VOCAB_UI = {
    DEFAULT_PAGE_SIZE: 25,
    SCROLL_DEBOUNCE_MS: 300,
  } as const;
  
  /**
   * Reserved folder names that cannot be used by users
   */
  export const RESERVED_FOLDER_NAMES = [
    FOLDER_CONSTANTS.UNORGANIZED,
    FOLDER_CONSTANTS.NEW_FOLDER_OPTION,
    FOLDER_CONSTANTS.ALL_FOLDERS,
  ] as const;
  
  /**
   * Helper type guards
   */
  export function isUnorganizedFolder(folder: string | undefined): boolean {
    return !folder || folder.trim() === '' || folder === FOLDER_CONSTANTS.UNORGANIZED;
  }
  
  export function isReservedFolderName(name: string): boolean {
    return RESERVED_FOLDER_NAMES.includes(name.toLowerCase() as any);
  }
  