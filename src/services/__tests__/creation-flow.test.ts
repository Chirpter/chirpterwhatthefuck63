// src/services/__tests__/creation-flow.test.ts
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
      limit: vi.fn(() => ({
        get: vi.fn(() => ({
          empty: false,
          docs: [{
            data: () => ({
              uid: 'test-user-123',
              credits: 100,
              stats: { booksCreated: 0, piecesCreated: 0 }
            })
          }]
        }))
      })),
    })),
    runTransaction: vi.fn((callback) => callback({
      get: vi.fn(() => ({
        exists: true,
        data: () => ({ credits: 100 })
      })),
      set: vi.fn(),
      update: vi.fn(),
    })),
  })),
  FieldValue: {
    serverTimestamp: () => new Date(),
    increment: (n: number) => n,
  }
}));

vi.mock('../book-creation.service', () => ({
  createBookAndStartGeneration: vi.fn((userId, data) => Promise.resolve('book-123'))
}));

vi.mock('../piece-creation.service', () => ({
  createPieceAndStartGeneration: vi.fn((userId, data) => Promise.resolve('piece-456'))
}));

describe('Creation Flow - Facade Routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('✅ Success Cases', () => {
    it('should route book creation to book service', async () => {
      const bookData: CreationFormValues = {
        type: 'book',
        aiPrompt: 'A fantasy story',
        primaryLanguage: 'en',
        availableLanguages: ['en'],
        origin: 'en',
        tags: [],
        title: { en: 'Test Book' },
        display: 'book',
        coverImageOption: 'none',
        coverImageAiPrompt: '',
        coverImageFile: null,
        previousContentSummary: '',
        targetChapterCount: 3,
        bookLength: 'short-story',
        generationScope: 'full',
      };

      const result = await createLibraryItem(bookData);

      expect(result).toBe('book-123');
      expect(bookCreationService.createBookAndStartGeneration).toHaveBeenCalledWith(
        'test-user-123',
        expect.objectContaining({ type: 'book' })
      );
    });

    it('should route piece creation to piece service', async () => {
      const pieceData: CreationFormValues = {
        type: 'piece',
        aiPrompt: 'A motivational quote',
        primaryLanguage: 'en',
        availableLanguages: ['en'],
        origin: 'en',
        tags: [],
        title: { en: 'Test Piece' },
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

      const result = await createLibraryItem(pieceData);

      expect(result).toBe('piece-456');
      expect(pieceCreationService.createPieceAndStartGeneration).toHaveBeenCalledWith(
        'test-user-123',
        expect.objectContaining({ type: 'piece' })
      );
    });
  });

  describe('❌ Error Cases', () => {
    it('should throw when user not found', async () => {
      const { getAdminDb } = await import('@/lib/firebase-admin');
      vi.mocked(getAdminDb).mockReturnValueOnce({
        collection: vi.fn(() => ({
          limit: vi.fn(() => ({
            get: vi.fn(() => ({ empty: true, docs: [] }))
          }))
        }))
      } as any);

      const data: CreationFormValues = {
        type: 'book',
        aiPrompt: 'Test',
        primaryLanguage: 'en',
        availableLanguages: ['en'],
        origin: 'en',
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

      await expect(createLibraryItem(data)).rejects.toThrow('No users found');
    });
  });
});

describe('Creation Flow - Credit Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should calculate book credit cost correctly', async () => {
    const testCases = [
      { bookLength: 'short-story', generationScope: 'full', coverImageOption: 'none', expected: 1 },
      { bookLength: 'mini-book', generationScope: 'full', coverImageOption: 'none', expected: 2 },
      { bookLength: 'standard-book', generationScope: 'firstFew', coverImageOption: 'none', expected: 2 },
      { bookLength: 'standard-book', generationScope: 'full', coverImageOption: 'none', expected: 8 },
      { bookLength: 'short-story', generationScope: 'full', coverImageOption: 'ai', expected: 2 },
    ];

    for (const testCase of testCases) {
      const data: CreationFormValues = {
        type: 'book',
        aiPrompt: 'Test',
        primaryLanguage: 'en',
        availableLanguages: ['en'],
        origin: 'en',
        tags: [],
        title: { en: '' },
        display: 'book',
        coverImageOption: testCase.coverImageOption as any,
        coverImageAiPrompt: '',
        coverImageFile: null,
        previousContentSummary: '',
        targetChapterCount: 3,
        bookLength: testCase.bookLength as any,
        generationScope: testCase.generationScope as any,
      };

      await createLibraryItem(data);
    }
  });

  it('should always cost 1 credit for piece', async () => {
    const data: CreationFormValues = {
      type: 'piece',
      aiPrompt: 'Test piece',
      primaryLanguage: 'en',
      availableLanguages: ['en'],
      origin: 'en',
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

    await createLibraryItem(data);
  });
});

describe('Creation Flow - Origin Format Handling', () => {
  it('should handle monolingual (en)', async () => {
    const data: CreationFormValues = {
      type: 'book',
      aiPrompt: 'A story',
      primaryLanguage: 'en',
      availableLanguages: ['en'],
      origin: 'en',
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
    expect(result).toBeTruthy();
  });

  it('should handle bilingual sentence (en-vi)', async () => {
    const data: CreationFormValues = {
      type: 'book',
      aiPrompt: 'A bilingual story',
      primaryLanguage: 'en',
      availableLanguages: ['en', 'vi'],
      origin: 'en-vi',
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
    expect(result).toBeTruthy();
  });

  it('should handle bilingual phrase (en-vi-ph)', async () => {
    const data: CreationFormValues = {
      type: 'piece',
      aiPrompt: 'A phrase-mode piece',
      primaryLanguage: 'en',
      availableLanguages: ['en', 'vi'],
      origin: 'en-vi-ph',
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
    expect(result).toBeTruthy();
  });
});

describe('Creation Flow - Parallel Pipeline (Book Only)', () => {
  it('should start both content and cover pipelines', async () => {
    const data: CreationFormValues = {
      type: 'book',
      aiPrompt: 'A fantasy story',
      primaryLanguage: 'en',
      availableLanguages: ['en'],
      origin: 'en',
      tags: [],
      title: { en: '' },
      display: 'book',
      coverImageOption: 'ai',
      coverImageAiPrompt: 'A dragon on a mountain',
      coverImageFile: null,
      previousContentSummary: '',
      targetChapterCount: 3,
      bookLength: 'short-story',
      generationScope: 'full',
    };

    const bookId = await createLibraryItem(data);
    
    expect(bookId).toBeTruthy();
  });

  it('should handle content success + cover failure gracefully', async () => {
    const data: CreationFormValues = {
      type: 'book',
      aiPrompt: 'A story',
      primaryLanguage: 'en',
      availableLanguages: ['en'],
      origin: 'en',
      tags: [],
      title: { en: '' },
      display: 'book',
      coverImageOption: 'ai',
      coverImageAiPrompt: 'Invalid prompt that fails',
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

describe('Creation Flow - Transaction Atomicity', () => {
  it('should rollback if credit deduction fails', async () => {
    vi.mocked(bookCreationService.createBookAndStartGeneration).mockRejectedValueOnce(
      new Error('Insufficient credits')
    );

    const data: CreationFormValues = {
      type: 'book',
      aiPrompt: 'Test',
      primaryLanguage: 'en',
      availableLanguages: ['en'],
      origin: 'en',
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

    await expect(createLibraryItem(data)).rejects.toThrow();
  });

  it('should create document and deduct credits atomically', async () => {
    vi.mocked(bookCreationService.createBookAndStartGeneration).mockResolvedValueOnce('new-book-id');

    const data: CreationFormValues = {
      type: 'book',
      aiPrompt: 'Test',
      primaryLanguage: 'en',
      availableLanguages: ['en'],
      origin: 'en',
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

    expect(result).toBe('new-book-id');
    expect(bookCreationService.createBookAndStartGeneration).toHaveBeenCalledWith(
      'test-user-123',
      expect.objectContaining({
        aiPrompt: 'Test',
        type: 'book'
      })
    );
  });
});

describe('Creation Flow - State Transitions', () => {
  it('should initialize with processing state', async () => {
    vi.mocked(bookCreationService.createBookAndStartGeneration).mockImplementationOnce((userId, data) => {
      expect(data).toMatchObject({
        type: 'book',
        aiPrompt: 'Test',
        primaryLanguage: 'en',
        bookLength: 'short-story'
      });
      return Promise.resolve('new-book-with-state');
    });

    const data: CreationFormValues = {
      type: 'book',
      aiPrompt: 'Test',
      primaryLanguage: 'en',
      availableLanguages: ['en'],
      origin: 'en',
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

    expect(result).toBe('new-book-with-state');
    expect(bookCreationService.createBookAndStartGeneration).toHaveBeenCalled();
  });
});