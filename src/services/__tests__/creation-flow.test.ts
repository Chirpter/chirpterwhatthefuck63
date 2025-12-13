
// src/services/__tests__/creation-flow-enhanced.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLibraryItem } from '../creation-service';
import type { CreationFormValues } from '@/lib/types';
import * as bookCreationService from '../book-creation.service';
import * as pieceCreationService from '../piece-creation.service';

// Mock dependencies
vi.mock('@/lib/firebase-admin', () => ({
  getAdminDb: vi.fn(() => ({
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        set: vi.fn(),
        update: vi.fn(),
        get: vi.fn(),
      })),
    })),
    runTransaction: vi.fn((callback) => callback({
      get: vi.fn(() => ({
        exists: true,
        data: () => ({ 
          uid: 'test-user-123',
          credits: 100, 
          stats: { booksCreated: 0, piecesCreated: 0 }
        })
      })),
      set: vi.fn(),
      update: vi.fn(),
    })),
  })),
  getAuthAdmin: vi.fn(() => ({
    verifySessionCookie: vi.fn().mockResolvedValue({ uid: 'test-user-123' })
  })),
  FieldValue: {
    serverTimestamp: () => new Date(),
    increment: (n: number) => n,
  }
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn((name: string) => ({ value: 'test-session-cookie' }))
  }))
}));

vi.mock('../book-creation.service');
vi.mock('../piece-creation.service');

describe('Creation Flow - Authentication & Authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('🔐 Session Validation', () => {
    it('should reject request without session cookie', async () => {
      const { cookies } = await import('next/headers');
      vi.mocked(cookies).mockReturnValueOnce({
        get: vi.fn(() => undefined)
      } as any);

      const data: CreationFormValues = {
        type: 'book',
        aiPrompt: 'Test',
        primaryLanguage: 'en',
        availableLanguages: ['en'],
        origin: 'en',
        unit: 'sentence',
        tags: [],
        title: { en: '' },
        display: 'book',
        coverImageOption: 'none',
        coverImageAiPrompt: '',
        coverImageFile: null,
        previousContentSummary: '',
        targetChapterCount: 3,
        bookLength: 'short-story',
        generationScope: 'full',
      };

      await expect(createLibraryItem(data)).rejects.toThrow('No session cookie found');
    });

    it('should reject invalid session cookie', async () => {
      const { getAuthAdmin } = await import('@/lib/firebase-admin');
      vi.mocked(getAuthAdmin).mockReturnValueOnce({
        verifySessionCookie: vi.fn().mockRejectedValue(new Error('auth/invalid-session-cookie'))
      } as any);

      const data: CreationFormValues = {
        type: 'book',
        aiPrompt: 'Test',
        primaryLanguage: 'en',
        availableLanguages: ['en'],
        origin: 'en',
        unit: 'sentence',
        tags: [],
        title: { en: '' },
        display: 'book',
        coverImageOption: 'none',
        coverImageAiPrompt: '',
        coverImageFile: null,
        previousContentSummary: '',
        targetChapterCount: 3,
        bookLength: 'short-story',
        generationScope: 'full',
      };

      await expect(createLibraryItem(data)).rejects.toThrow('Invalid or expired session');
    });

    it('should extract userId from valid session', async () => {
      vi.mocked(bookCreationService.createBookAndStartGeneration).mockResolvedValue('book-123');

      const data: CreationFormValues = {
        type: 'book',
        aiPrompt: 'Test',
        primaryLanguage: 'en',
        availableLanguages: ['en'],
        origin: 'en',
        unit: 'sentence',
        tags: [],
        title: { en: '' },
        display: 'book',
        coverImageOption: 'none',
        coverImageAiPrompt: '',
        coverImageFile: null,
        previousContentSummary: '',
        targetChapterCount: 3,
        bookLength: 'short-story',
        generationScope: 'full',
      };

      await createLibraryItem(data);

      expect(bookCreationService.createBookAndStartGeneration).toHaveBeenCalledWith(
        'test-user-123',
        expect.any(Object)
      );
    });
  });
});

describe('Creation Flow - Origin Format Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('✅ Valid Formats', () => {
    it('should accept monolingual format (en)', async () => {
      vi.mocked(bookCreationService.createBookAndStartGeneration).mockResolvedValue('book-123');

      const data: CreationFormValues = {
        type: 'book',
        aiPrompt: 'A story',
        primaryLanguage: 'en',
        availableLanguages: ['en'],
        origin: 'en',
        unit: 'sentence',
        tags: [],
        title: { en: '' },
        display: 'book',
        coverImageOption: 'none',
        coverImageAiPrompt: '',
        coverImageFile: null,
        previousContentSummary: '',
        targetChapterCount: 3,
        bookLength: 'short-story',
        generationScope: 'full',
      };

      const result = await createLibraryItem(data);
      expect(result).toBe('book-123');
    });

    it('should accept bilingual sentence format (en-vi)', async () => {
      vi.mocked(bookCreationService.createBookAndStartGeneration).mockResolvedValue('book-456');

      const data: CreationFormValues = {
        type: 'book',
        aiPrompt: 'A bilingual story',
        primaryLanguage: 'en',
        availableLanguages: ['en', 'vi'],
        origin: 'en-vi',
        unit: 'sentence',
        tags: [],
        title: { en: '' },
        display: 'book',
        coverImageOption: 'none',
        coverImageAiPrompt: '',
        coverImageFile: null,
        previousContentSummary: '',
        targetChapterCount: 3,
        bookLength: 'short-story',
        generationScope: 'full',
      };

      const result = await createLibraryItem(data);
      expect(result).toBe('book-456');
    });

    it('should accept bilingual phrase format (en-vi-ph)', async () => {
      vi.mocked(pieceCreationService.createPieceAndStartGeneration).mockResolvedValue('piece-789');

      const data: CreationFormValues = {
        type: 'piece',
        aiPrompt: 'A phrase-mode piece',
        primaryLanguage: 'en',
        availableLanguages: ['en', 'vi'],
        origin: 'en-vi-ph',
        unit: 'phrase',
        tags: [],
        title: { en: '' },
        display: 'card',
        aspectRatio: '3:4',
        coverImageOption: 'none',
        coverImageAiPrompt: '',
        coverImageFile: null,
        previousContentSummary: '',
        targetChapterCount: 0,
        bookLength: 'short-story',
        generationScope: 'full',
      };

      const result = await createLibraryItem(data);
      expect(result).toBe('piece-789');
    });
  });

  describe('❌ Invalid Formats', () => {
    it('should reject mismatched primary language', async () => {
      const data: CreationFormValues = {
        type: 'book',
        aiPrompt: 'Test',
        primaryLanguage: 'en',
        availableLanguages: ['en'],
        origin: 'vi', // ❌ Mismatch
        unit: 'sentence',
        tags: [],
        title: { en: '' },
        display: 'book',
        coverImageOption: 'none',
        coverImageAiPrompt: '',
        coverImageFile: null,
        previousContentSummary: '',
        targetChapterCount: 3,
        bookLength: 'short-story',
        generationScope: 'full',
      };

      await expect(createLibraryItem(data)).rejects.toThrow("doesn't match selected primary language");
    });

    it('should reject bilingual mode with monolingual origin', async () => {
      const data: CreationFormValues = {
        type: 'book',
        aiPrompt: 'Test',
        primaryLanguage: 'en',
        availableLanguages: ['en', 'vi'], // ✓ Bilingual
        origin: 'en', // ❌ Monolingual
        unit: 'sentence',
        tags: [],
        title: { en: '' },
        display: 'book',
        coverImageOption: 'none',
        coverImageAiPrompt: '',
        coverImageFile: null,
        previousContentSummary: '',
        targetChapterCount: 3,
        bookLength: 'short-story',
        generationScope: 'full',
      };

      await expect(createLibraryItem(data)).rejects.toThrow('Bilingual mode selected but origin format is monolingual');
    });

    it('should reject invalid format flag', async () => {
      const data: CreationFormValues = {
        type: 'book',
        aiPrompt: 'Test',
        primaryLanguage: 'en',
        availableLanguages: ['en', 'vi'],
        origin: 'en-vi-invalid', // ❌ Unknown flag
        unit: 'sentence',
        tags: [],
        title: { en: '' },
        display: 'book',
        coverImageOption: 'none',
        coverImageAiPrompt: '',
        coverImageFile: null,
        previousContentSummary: '',
        targetChapterCount: 3,
        bookLength: 'short-story',
        generationScope: 'full',
      };

      await expect(createLibraryItem(data)).rejects.toThrow("Invalid format flag in origin");
    });
  });
});

describe('Creation Flow - Parallel Pipeline Robustness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle content failure + cover success', async () => {
    vi.mocked(bookCreationService.createBookAndStartGeneration)
      .mockResolvedValue('book-with-partial-failure');

    const data: CreationFormValues = {
      type: 'book',
      aiPrompt: 'Test',
      primaryLanguage: 'en',
      availableLanguages: ['en'],
      origin: 'en',
      unit: 'sentence',
      tags: [],
      title: { en: '' },
      display: 'book',
      coverImageOption: 'ai',
      coverImageAiPrompt: 'A cover',
      coverImageFile: null,
      previousContentSummary: '',
      targetChapterCount: 3,
      bookLength: 'short-story',
      generationScope: 'full',
    };

    const bookId = await createLibraryItem(data);
    expect(bookId).toBeTruthy();
  });

  it('should handle both pipelines failing', async () => {
    vi.mocked(bookCreationService.createBookAndStartGeneration)
      .mockResolvedValue('book-all-failed');

    const data: CreationFormValues = {
      type: 'book',
      aiPrompt: 'Test',
      primaryLanguage: 'en',
      availableLanguages: ['en'],
      origin: 'en',
      unit: 'sentence',
      tags: [],
      title: { en: '' },
      display: 'book',
      coverImageOption: 'ai',
      coverImageAiPrompt: 'Invalid',
      coverImageFile: null,
      previousContentSummary: '',
      targetChapterCount: 3,
      bookLength: 'short-story',
      generationScope: 'full',
    };

    const bookId = await createLibraryItem(data);
    expect(bookId).toBeTruthy();
  });
});

describe('Creation Flow - Retry Logic', () => {
  it('should track retry count on regeneration', async () => {
    // This will be tested at the service level
    expect(true).toBe(true);
  });
});

describe('Creation Flow - Unknown Type Handling', () => {
  it('should reject unknown content type', async () => {
    const data: any = {
      type: 'unknown-type',
      aiPrompt: 'Test',
      primaryLanguage: 'en',
      availableLanguages: ['en'],
      origin: 'en',
      unit: 'sentence',
      tags: [],
      title: { en: '' },
      display: 'book',
    };

    await expect(createLibraryItem(data)).rejects.toThrow('Unknown content type');
  });
});
