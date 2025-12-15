// src/lib/types.ts

import { BOOK_LENGTH_OPTIONS } from "./constants";
import { z } from 'zod';

// Custom error class for better error handling in vocab-videos service
export class ApiServiceError extends Error {
  constructor(
    message: string,
    public code: 'RATE_LIMIT' | 'AUTH' | 'NETWORK' | 'UNKNOWN' | 'FIRESTORE' | 'PERMISSION' | 'UNAVAILABLE' | 'VALIDATION' = 'UNKNOWN',
    public originalError?: any
  ) {
    super(message);
    this.name = 'ApiServiceError';
  }
}

/**
 * @typedef {Object.<string, string | string[]>} MultilingualContent
 * @description A flexible object to hold content in multiple languages.
 * The key is the BCP-47 language code (e.g., 'en', 'vi').
 * The value can be a single string (for a sentence) or an array of strings (for phrases).
 */
export type MultilingualContent = {
  [languageCode: string]: string | string[];
};


// --- UNIFIED STRUCTURE FOR ALL TEXTUAL CONTENT ---

export type ContentUnit = 'sentence' | 'phrase';

/**
 * @interface Segment
 * @description The fundamental building block of all content. Represents a structured element.
 * ✅ REFACTORED: The 'type' property has been removed as it was redundant.
 * Paragraphs are now handled by the renderer based on segment order and content.
 */
export interface Segment {
  id: string;
  order: number;
  content: MultilingualContent;
}


export interface ChapterStats {
  totalSegments: number;
  totalWords: number;
  estimatedReadingTime: number; // Added field for estimated reading time
}

export type ChapterTitle = MultilingualContent;


/**
 * @interface Chapter
 * @description A collection of Segments, representing a chapter in a book.
 */
export interface Chapter {
  id: string;
  order: number;
  title: ChapterTitle;
  segments: Segment[]; // Uses the updated Segment type
  stats: ChapterStats;
  metadata?: {
    primaryLanguage: string;
  };
}


export interface ChapterOutlineItem {
  id: string;
  title: MultilingualContent;
  isGenerated: boolean;
  metadata: {};
}

export type UserPlan = 'free' | 'pro';
export type UserRole = 'user' | 'admin';

export interface UserStats {
  booksCreated: number;
  piecesCreated?: number; // New
  vocabSaved?: number; // New
  flashcardsMastered?: number; // New
  coversGeneratedByAI?: number; // New
  bilingualBooksCreated?: number;
  vocabAddedToPlaylist?: number;
  level?: number;
  [key: string]: number | undefined; // Index signature to allow dynamic access
}

export interface UserAchievement {
  id: string; 
  unlockedAt: string; // ISO String date when the requirements were met
  lastClaimedLevel: number; // The last tier level the user claimed a reward for
}

export interface User {
  uid: string;
  email: string | null;
  username?: string; // The unique, once-settable user ID
  displayName: string | null;
  photoURL: string | null;
  coverPhotoURL?: string; // For the profile background
  isAnonymous: boolean;
  plan: UserPlan;
  credits: number;
  level: number;
  lastLoginDate: string;
  stats?: UserStats;
  achievements?: UserAchievement[];
  purchasedBookIds?: string[];
  ownedBookmarkIds?: string[];
}

export type JobStatus = 'pending' | 'processing' | 'ready' | 'error' | 'ignored';
export type OverallStatus = 'processing' | 'draft' | 'published' | 'archived';
export type CoverJobType = 'none' | 'upload' | 'ai';

export type BilingualViewMode = 'primary' | 'secondary' | 'bilingual';
export type PresentationMode = 'mono' | 'bilingual-sentence' | 'bilingual-phrase';
export type BilingualFormat = 'sentence' | 'phrase';

export interface Cover {
  type: CoverJobType;
  url?: string;
  filename?: string;
  storageProvider?: 'firebase';
  createdAt?: any;
  inputPrompt?: string; 
}

export type BookmarkType = string;

// UPDATED STRUCTURE per integration guide
export interface BookmarkState {
  mainVisual: {
    type?: "image"; // Optional since it's the only type for now
    value: string; // This is now a URL
  };
  sound?: string; // URL to sound file
  customCss?: string; // A string of CSS rules
}

// UPDATED STRUCTURE per integration guide
export interface SystemBookmark {
  id: BookmarkType;
  name: string;
  description?: string;
  initialState: Partial<BookmarkState>;
  completedState?: Partial<BookmarkState>;
}

export interface BookmarkMetadata {
  id: BookmarkType;
  price: number;
  unlockType: 'purchase' | 'task' | 'free' | 'pro';
  releaseDate?: string;
  endDate?: string;
  status: 'published' | 'unpublished' | 'maintenance';
}

export type CombinedBookmark = SystemBookmark & Partial<BookmarkMetadata>;


export interface BaseDocument {
    createdAt?: any;
    updatedAt?: any;
    completedAt?: any;
}

interface BaseLibraryItem extends BaseDocument {
  id: string;
  userId: string;
  title: MultilingualContent;
  origin: string;
  langs: string[];
  status: OverallStatus;
  progress?: number;
  isGlobal?: boolean;
  price?: number;
  originId?: string;
  prompt?: string;
  presentationStyle: string;
  tags?: string[];
  labels?: string[]; // Added for consistency with Firestore data model
  unit: ContentUnit;
}

export type BookLengthOptionValue = typeof BOOK_LENGTH_OPTIONS[number]['value'];

/**
 * @interface Book
 * @description Represents a full book, composed of multiple chapters.
 */
export interface Book extends BaseLibraryItem {
  type: 'book';
  presentationStyle: 'book'; // OVERRIDE for clarity
  author?: string;
  contentState: JobStatus;
  contentError?: string;
  contentRetries?: number;
  chapters: Chapter[];
  coverState: JobStatus;
  coverError?: string;
  cover?: Cover;
  imageHint?: string;
  coverRetries?: number;
  outline?: ChapterOutlineItem[];
  length?: BookLengthOptionValue;
  selectedBookmark?: BookmarkType;
}

export interface EditorSettings {
  textAlign: 'text-left' | 'text-center' | 'text-right' | 'text-justify';
  verticalAlign: 'justify-start' | 'justify-center' | 'justify-end';
  background: string;
}

/**
 * @interface Piece
 * @description Represents a shorter, single-part work like an article, poem, or dialogue.
 */
export interface Piece extends BaseLibraryItem {
  type: 'piece';
  presentationStyle: 'doc' | 'card'; // OVERRIDE for clarity
  generatedContent: Segment[];
  contentState: JobStatus;
  contentError?: string;
  contentRetryCount?: number;
  aspectRatio?: '1:1' | '3:4' | '4:3';
  contextData?: {
    startTime?: number;
    endTime?: number;
  };
  isBilingual?: boolean;
}

export interface CreationFormValues {
  primaryLanguage: string;
  availableLanguages: string[];
  aiPrompt: string;
  title: MultilingualContent;
  presentationStyle: 'doc' | 'card' | 'book';
  aspectRatio?: '1:1' | '3:4' | '4:3' | undefined;
  origin: string;
  unit: ContentUnit;
  // Book specific fields
  coverImageOption: 'none' | 'upload' | 'ai';
  coverImageAiPrompt: string;
  coverImageFile: File | null;
  previousContentSummary: string;
  targetChapterCount: number;
  bookLength: BookLengthOptionValue;
  generationScope: 'full' | 'firstFew';
}

export type PieceFormValues = Omit<CreationFormValues, 'coverImageOption' | 'coverImageAiPrompt' | 'coverImageFile' | 'previousContentSummary' | 'targetChapterCount' | 'bookLength' | 'generationScope'>;

export type SrsState = 'new' | 'learning' | 'short-term' | 'long-term';
export type VocabContext = 'reader' | 'vocab-videos' | 'manual';

export interface VocabularyItem extends BaseDocument {
  id: string;
  userId: string;
  term: string;
  meaning: string;
  partOfSpeech?: string;
  termLanguage: string;
  meaningLanguage: string;
  sourceType?: 'book' | 'piece' | 'manual';
  sourceId?: string;
  sourceTitle?: MultilingualContent;
  example?: string;
  exampleLanguage?: string;
  chapterId?: string;
  segmentId?: string; // Links back to a SentencePair ID
  sourceDeleted?: boolean;
  folder?: string;
  context?: VocabContext;
  // --- SRS Fields ---
  srsState: SrsState;
  memoryStrength: number; // Represents the number of days the user is predicted to remember the word.
  streak: number; // The number of consecutive times the user has remembered the word correctly.
  attempts: number; // The total number of times the word has been reviewed.
  lastReviewed: any; // Firestore Timestamp of the last interaction.
  dueDate: any; // Firestore Timestamp for the next scheduled review.
  translation?: string;
  searchTerms?: string[];
  contextData?: { // Context-specific data, e.g., from Vocab in Clips
    startTime?: number;
    endTime?: number;
  };
}

export type LibraryItem = Book | Piece;

export interface PlaylistItem {
  type: 'book' | 'vocab';
  id: string;
  title: string;
  data: Partial<Book> | {}; // Partial<Book> for books, {} for vocab folders
  primaryLanguage: string;
  availableLanguages: string[];
  originLanguages?: string; // New field for AudioEngine
  origin?: string; // Added for consistency
}


export interface SpeechPlayableSegment {
  text: string;
  lang: string;
  originalSegmentId: string;
  type?: 'book' | 'vocab-term' | 'vocab-meaning' | 'vocab-example' | 'silence';
  vocabItem?: VocabularyItem;
}

export type RepeatMode = 'off' | 'item';
export type PlaylistRepeatMode = 'off' | 'all';

export interface AudioProgressState {
  chapterIndex: number;
  segmentIndex: number;
  savedTotalSegmentsInChapter?: number;
  timestamp: string;
}

export interface BookProgress {
  bookId: string;
  audio?: AudioProgressState;
}

export interface Page {
  pageIndex: number;
  items: Segment[];
  estimatedHeight: number;
}

export interface VocabularyFilters {
  folder: string;
  searchTerm: string;
  srsState?: SrsState;
  sortBy: 'createdAt' | 'term' | 'memoryStrength';
  sortOrder: 'asc' | 'desc';
  scope?: 'global' | 'local'; // New filter for context
  context?: VocabContext;      // New filter for context
}

export interface PaginationState {
  cursor: VocabularyItem | null;
  hasLoadedInitial: boolean;
  totalLoaded: number;
  hasMore: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Represents a single video snippet result from a search.
 * This is the central data structure for both the "Vocab in Videos"
 * and "Shadowing" learning features.
 */
export interface FoundClip {
  id: string; // Unique identifier for the clip
  videoId: string; // The YouTube video ID
  text: string; // The transcribed text of this specific clip
  start: number; // Start time of the clip in seconds
  end: number; // End time of the clip in seconds
  context: string; // The full sentence or surrounding text for better context
}

// --- Zod Schemas for Genkit Flows ---
export const GeneratePieceInputSchema = z.object({
  userPrompt: z.string().describe('The specific details provided by the user for the work. Can be empty if a genre is provided.'),
  origin: z.string().describe('The language format string, e.g., "en", "en-vi", or "en-vi-ph".'),
});
export type GeneratePieceInput = z.infer<typeof GeneratePieceInputSchema>;

export const GenerateChapterInputSchema = z.object({
  prompt: z.string().describe('The prompt for the chapter content.'),
});
export type GenerateChapterInput = z.infer<typeof GenerateChapterInputSchema>;

export const GenerateBookContentInputSchema = z.object({
  prompt: z.string().describe('A prompt describing the book content to generate, or what should happen in the new chapters.'),
  origin: z.string().describe('The language format string, e.g., "en", "en-vi", or "en-vi-ph".'),
  previousContentSummary: z.string().optional().describe('A summary of existing book content if generating additional chapters.'),
  chaptersToGenerate: z.number().describe('The number of chapter objects the AI should generate content for.'),
  totalChapterOutlineCount: z.number().optional().describe('The total number of chapters the full book outline should have.'),
  bookLength: z.enum(['short-story', 'mini-book', 'standard-book', 'long-book']).optional().describe('The desired overall length/type of the book.'),
  generationScope: z.enum(['full', 'firstFew']).optional().default('full').describe('Whether to generate the full book or just the first few chapters with an outline.'),
});
export type GenerateBookContentInput = z.infer<typeof GenerateBookContentInputSchema>;

export const GenerateCoverImageInputSchema = z.object({
  prompt: z.string().describe('The prompt to generate an image from.'),
  bookId: z.string().describe('The ID of the book in the library to associate this cover with.'),
});
export type GenerateCoverImageInput = z.infer<typeof GenerateCoverImageInputSchema>;

export const TranslateTextInputSchema = z.object({
  text: z.string().describe('The text to translate.'),
  targetLanguage: z.string().describe('The language to translate the text into (e.g., "English", "Vietnamese").'),
  sourceLanguage: z.string().optional().describe('The source language of the text (e.g., "English", "Vietnamese"). If not provided, the model will attempt to auto-detect.'),
});
export type TranslateTextInput = z.infer<typeof TranslateTextInputSchema>;

export type Tier = {
    name: string;
    goal: number;
    color: string;
    trophyColor: string;
    tasks: TierTask[];
    isComingSoon?: boolean;
};
  
export type TierTask = 
| { type: 'ref'; id: string; goal: number }
| { type: 'inline'; name: string; current: number; goal: number; imageUrl?: string };

// This type was moved here from `piece-creation.service.ts` to be shared
// between both creation services. It represents the input for a Genkit prompt.
export const UnifiedContentGenPromptInputSchema = z.object({
    userPrompt: z.string(),
    systemPrompt: z.string(),
});
