
import type { PresetCategory } from './types';

export interface NavLink {
  href: string;
  labelKey: string;
  iconName: string;
}

export const NAV_LINKS: NavLink[] = [
  { href: "/library/book", labelKey: "library", iconName: "Library" },
  { href: "/create", labelKey: "createContent", iconName: "PlusSquare" },
  { href: "/shop", labelKey: "shop", iconName: "Store" },
  { href: "/explore", labelKey: "explore", iconName: "Search" },
  { href: "/learning", labelKey: "learningTools", iconName: "BrainCircuit" },
];


export const APP_NAME = "Chirpter";

export const UI_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'zh', label: '中文 (简体)' },
];

export const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'vi', label: 'Vietnamese' },
  { value: 'zh', label: 'Chinese (Simplified)' },
];

export const STATUS_FILTERS = [
  { value: 'all', labelKey: 'statusFilters.all' },
  { value: 'draft', labelKey: 'statusFilters.draft' },
  { value: 'published', labelKey: 'statusFilters.published' },
  { value: 'archived', labelKey: 'statusFilters.archived' },
];

export const BOOK_TAG_SUGGESTIONS = ['fantasy', 'sci-fi', 'mystery', 'romance', 'self-help', 'adventure', 'horror'];
export const PIECE_TAG_SUGGESTIONS = ['haiku', 'quote', 'love letter', 'riddle', 'aphorism', 'ielts speaking'];

export const BOOK_LENGTH_OPTIONS = [
  { value: 'short-story', labelKey: 'bookLength.short-story', descriptionKey: 'bookLength.short-storyDescription', defaultChapters: 3, minChapters: 1, disabled: false },
  { value: 'mini-book', labelKey: 'bookLength.mini-book', descriptionKey: 'bookLength.mini-bookDescription', defaultChapters: 5, minChapters: 1, disabled: false },
  { value: 'standard-book', labelKey: 'bookLength.standard-book', descriptionKey: 'bookLength.standard-bookDescription', defaultChapters: 10, minChapters: 4, disabled: false },
  { value: 'long-book', labelKey: 'bookLength.long-book', descriptionKey: 'bookLength.long-bookDescription', defaultChapters: 12, minChapters: 4, disabled: true },
] as const;

export const VOCABULARY_CONSTANTS = {
  CACHE: {
    FOLDER_TTL: 30000,
    MAX_SIZE: 100,
  },
  VALIDATION: {
    MAX_TERM_LENGTH: 200,
    MAX_MEANING_LENGTH: 500,
    MAX_EXAMPLE_LENGTH: 1000,
    MIN_SEARCH_QUERY_LENGTH: 2,
    MAX_FOLDER_NAME_LENGTH: 50,
  },
  PAGINATION: {
    DEFAULT_PAGE_SIZE: 20,
  },
  SEARCH: {
    DEBOUNCE_MS: 300,
    MIN_QUERY_LENGTH: 2,
    STOP_WORDS: new Set(['the', 'a', 'an', 'and', 'or', 'but', 'is', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']),
  },
  FOLDER: {
    MAX_ITEMS_PER_FOLDER: 200,
  },
} as const;


export const AVG_TTS_SEGMENTS_PER_CHAPTER_HEURISTIC = 20;

export const MAX_PROMPT_LENGTH = 500;
export const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
export const MAX_IMAGE_SIZE_MB = 2;

// --- SRS State Thresholds (in days) ---
export const LEARNING_THRESHOLD_DAYS = 7;
export const MASTERED_THRESHOLD_DAYS = 30;

// --- NEW POINT-BASED SRS CONSTANTS ---
export const POINT_THRESHOLDS = {
  NEW: 0,
  LEARNING: 700,
  SHORT_TERM: 1400,
  LONG_TERM: 3000,
};

export const POINT_VALUES = {
  new: { remembered: 200, forgot: -100 },
  learning: { remembered: 250, forgot: -250 },
  'short-term': { remembered: 300, forgot: -350 },
  'long-term': { remembered: 0, forgot: 0 }, // No change for mastered words
};

export const STREAK_BONUSES = [
  0,    // Streak 1 (index 0) - No bonus
  200,  // Streak 2
  300,  // Streak 3
  400,  // Streak 4
  500,  // Streak 5+
];

export const DAILY_DECAY_POINTS = -200;
