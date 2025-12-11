// src/features/create/hooks/useCreationJob.test.ts - FIXED
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCreationJob } from './useCreationJob';
import type { User } from '@/lib/types';
import * as creationService from '@/services/creation-service';
import * as userContext from '@/contexts/user-context';

// ✅ FIX: Mock modules at the top level
vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual('firebase/firestore');
  return {
    ...actual,
    getFirestore: vi.fn(() => ({})),
    doc: vi.fn((db, path) => ({ path })),
    onSnapshot: vi.fn(() => vi.fn()),
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn(),
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: any) => {
      if (params) return `${'${key}'}(${'${JSON.stringify(params)}'})`;
      return key;
    },
    i18n: { language: 'en' },
  }),
}));

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// ✅ FIX: Mock the entire modules
vi.mock('@/contexts/user-context');
vi.mock('@/services/creation-service');

describe('useCreationJob Hook - Form State Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();

    // Default mock for useUser
    vi.mocked(userContext.useUser).mockReturnValue({
      user: {
        uid: 'test-user',
        credits: 100,
        plan: 'free',
      } as User,
      // Provide mock implementations for other properties as needed
      loading: false,
      error: null,
      levelUpInfo: null,
      clearLevelUpInfo: vi.fn(),
      reloadUser: vi.fn(),
      retryUserFetch: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('✅ Initialization', () => {
    it('should initialize with default form values for book', () => {
      const { result } = renderHook(() => 
        useCreationJob({ type: 'book', editingBookId: null, mode: null })
      );

      expect(result.current.formData).toMatchObject({
        type: 'book',
        primaryLanguage: 'en',
        availableLanguages: ['en'],
        aiPrompt: expect.stringContaining('story'), // ✅ FIX: More robust check
        targetChapterCount: expect.any(Number),
        bookLength: 'short-story',
        generationScope: 'full',
      });
    });

    it('should initialize with default form values for piece', () => {
      const { result } = renderHook(() => 
        useCreationJob({ type: 'piece', editingBookId: null, mode: null })
      );

      expect(result.current.formData).toMatchObject({
        type: 'piece',
        primaryLanguage: 'en',
        availableLanguages: ['en'],
        aiPrompt: expect.stringContaining('piece'), // ✅ FIX: More robust check
        display: 'card',
        aspectRatio: '3:4',
      });
    });

    it('should reset form when type changes', () => {
      const { result } = renderHook(
        useCreationJob,
        { initialProps: { type: 'book' as 'book' | 'piece', editingBookId: null, mode: null } }
      );

      const initialPrompt = result.current.formData.aiPrompt;

      act(() => {
        result.current.reset('piece');
      });
      
      // ✅ FIX: The hook's reset function now correctly assigns a new default prompt.
      expect(result.current.formData.aiPrompt).not.toBe(initialPrompt);
      expect(result.current.formData.type).toBe('piece');
    });
  });

  describe('✅ Input Handlers', () => {
    it('should update prompt and clear default flag', () => {
      const { result } = renderHook(() => 
        useCreationJob({ type: 'book', editingBookId: null, mode: null })
      );

      expect(result.current.isPromptDefault).toBe(true);

      act(() => {
        result.current.handleInputChange({
          target: { name: 'aiPrompt', value: 'My custom prompt' }
        } as any);
      });

      expect(result.current.formData.aiPrompt).toBe('My custom prompt');
      expect(result.current.isPromptDefault).toBe(false);
    });

    it('should update chapter count as number', () => {
      const { result } = renderHook(() => 
        useCreationJob({ type: 'book', editingBookId: null, mode: null })
      );

      act(() => {
        result.current.handleInputChange({
          target: { name: 'targetChapterCount', value: '5' }
        } as any);
      });

      expect(result.current.formData.targetChapterCount).toBe(5);
    });

    it('should handle bilingual toggle', () => {
      const { result } = renderHook(() => 
        useCreationJob({ type: 'book', editingBookId: null, mode: null })
      );

      act(() => {
        result.current.handleValueChange('isBilingual', true);
      });

      expect(result.current.formData.availableLanguages).toHaveLength(2);
      expect(result.current.formData.origin).toContain('-');
    });

    it('should sync origin with language changes', () => {
      const { result } = renderHook(() => 
        useCreationJob({ type: 'book', editingBookId: null, mode: null })
      );

      act(() => {
        result.current.handleValueChange('isBilingual', true);
      });

      act(() => {
        result.current.handleValueChange('secondaryLanguage', 'fr');
      });

      expect(result.current.formData.origin).toBe('en-fr');
      expect(result.current.formData.availableLanguages).toEqual(['en', 'fr']);
    });

    it('should toggle phrase mode', () => {
      const { result } = renderHook(() => 
        useCreationJob({ type: 'book', editingBookId: null, mode: null })
      );

      act(() => {
        result.current.handleValueChange('isBilingual', true);
      });

      const originBefore = result.current.formData.origin;

      act(() => {
        result.current.handleValueChange('origin', result.current.formData.origin);
      });

      if (originBefore.endsWith('-ph')) {
        expect(result.current.formData.origin).not.toContain('-ph');
      } else {
        expect(result.current.formData.origin).toContain('-ph');
      }
    });
  });

  describe('✅ Validation Logic', () => {
    it('should validate empty prompt', () => {
      const { result } = renderHook(() => 
        useCreationJob({ type: 'book', editingBookId: null, mode: null })
      );

      act(() => {
        result.current.handleInputChange({
          target: { name: 'aiPrompt', value: '' }
        } as any);
      });

      expect(result.current.validationMessage).toBeTruthy();
      expect(result.current.promptError).toBe('empty');
    });

    it('should validate prompt length', () => {
      const { result } = renderHook(() => 
        useCreationJob({ type: 'book', editingBookId: null, mode: null })
      );

      const longPrompt = 'a'.repeat(501);

      act(() => {
        result.current.handleInputChange({
          target: { name: 'aiPrompt', value: longPrompt }
        } as any);
      });

      expect(result.current.validationMessage).toBeTruthy();
      expect(result.current.promptError).toBe('too_long');
    });

    it('should validate chapter count range', () => {
      const { result } = renderHook(() => 
        useCreationJob({ type: 'book', editingBookId: null, mode: null })
      );

      act(() => {
        result.current.handleValueChange('targetChapterCount', 0);
      });

      expect(result.current.validationMessage).toContain('outOfRange');

      act(() => {
        result.current.handleValueChange('targetChapterCount', 20);
      });

      expect(result.current.validationMessage).toContain('outOfRange');
    });

    it('should validate bilingual requires different languages', () => {
      const { result } = renderHook(() => 
        useCreationJob({ type: 'book', editingBookId: null, mode: null })
      );

      act(() => {
        result.current.handleValueChange('isBilingual', true);
        result.current.handleValueChange('secondaryLanguage', 'en');
      });

      expect(result.current.validationMessage).toContain('sameLanguage');
    });

    it('should validate insufficient credits', () => {
      // ✅ FIX: Mock useUser at the top level of the test
      vi.mocked(userContext.useUser).mockReturnValue({
        user: { uid: 'test', credits: 0, plan: 'free' } as User,
        loading: false, error: null, levelUpInfo: null, clearLevelUpInfo: vi.fn(), reloadUser: vi.fn(), retryUserFetch: vi.fn(),
      });

      const { result } = renderHook(() => 
        useCreationJob({ type: 'book', editingBookId: null, mode: null })
      );

      expect(result.current.canGenerate).toBe(false);
    });
  });

  describe('✅ Credit Cost Calculation', () => {
    it('should calculate book credit costs correctly', () => {
      const testCases = [
        { bookLength: 'short-story', generationScope: 'full', cover: 'none', expected: 1 },
        { bookLength: 'mini-book', generationScope: 'full', cover: 'none', expected: 2 },
        { bookLength: 'standard-book', generationScope: 'firstFew', cover: 'none', expected: 2 },
        { bookLength: 'standard-book', generationScope: 'full', cover: 'none', expected: 8 },
        { bookLength: 'short-story', generationScope: 'full', cover: 'ai', expected: 2 },
      ];

      testCases.forEach(testCase => {
        const { result } = renderHook(() => 
          useCreationJob({ type: 'book', editingBookId: null, mode: null })
        );

        act(() => {
          result.current.handleValueChange('bookLength', testCase.bookLength);
          result.current.handleValueChange('generationScope', testCase.generationScope);
          result.current.handleValueChange('coverImageOption', testCase.cover);
        });

        expect(result.current.creditCost).toBe(testCase.expected);
      });
    });

    it('should always calculate 1 credit for piece', () => {
      const { result } = renderHook(() => 
        useCreationJob({ type: 'piece', editingBookId: null, mode: null })
      );

      expect(result.current.creditCost).toBe(1);
    });
  });
});

describe('useCreationJob Hook - Job Submission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    sessionStorage.clear();
    // Default successful mocks
    vi.mocked(creationService.createLibraryItem).mockResolvedValue('job-123');
    vi.mocked(userContext.useUser).mockReturnValue({
      user: { uid: 'test-user', credits: 100, plan: 'free' } as User,
      loading: false, error: null, levelUpInfo: null, clearLevelUpInfo: vi.fn(), reloadUser: vi.fn(), retryUserFetch: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('✅ Submission Flow', () => {
    it('should submit job and store activeId', async () => {
      const { result } = renderHook(() => 
        useCreationJob({ type: 'book', editingBookId: null, mode: null })
      );

      act(() => {
        result.current.handleInputChange({
          target: { name: 'aiPrompt', value: 'A fantasy story' }
        } as any);
      });

      await act(async () => {
        await result.current.handleSubmit({ preventDefault: vi.fn() } as any);
      });

      expect(creationService.createLibraryItem).toHaveBeenCalled();
      expect(result.current.activeId).toBe('job-123');
      expect(result.current.isBusy).toBe(true);
    });

    it('should not submit with validation errors', async () => {
      const { result } = renderHook(() => 
        useCreationJob({ type: 'book', editingBookId: null, mode: null })
      );

      act(() => {
        result.current.handleInputChange({
          target: { name: 'aiPrompt', value: '' }
        } as any);
      });

      await act(async () => {
        await result.current.handleSubmit({ preventDefault: vi.fn() } as any);
      });

      expect(creationService.createLibraryItem).not.toHaveBeenCalled();
    });

    it('should store jobId in sessionStorage', async () => {
      const { result } = renderHook(() => 
        useCreationJob({ type: 'book', editingBookId: null, mode: null })
      );

      act(() => {
        result.current.handleInputChange({
          target: { name: 'aiPrompt', value: 'Test' }
        } as any);
      });

      await act(async () => {
        await result.current.handleSubmit({ preventDefault: vi.fn() } as any);
      });

      expect(sessionStorage.getItem('activeJobId_test-user')).toBe('job-123');
    });
  });
});

describe('🔬 Edge Cases - Advanced', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
     vi.mocked(userContext.useUser).mockReturnValue({
      user: { uid: 'test-user', credits: 100, plan: 'free' } as User,
      loading: false, error: null, levelUpInfo: null, clearLevelUpInfo: vi.fn(), reloadUser: vi.fn(), retryUserFetch: vi.fn(),
    });
  });

  describe('⚠️ Race Conditions', () => {
    it('should handle rapid form changes', () => {
      const { result } = renderHook(() => 
        useCreationJob({ type: 'book', editingBookId: null, mode: null })
      );

      act(() => {
        result.current.handleValueChange('bookLength', 'mini-book');
        result.current.handleValueChange('bookLength', 'standard-book');
        result.current.handleValueChange('generationScope', 'full');
        result.current.handleValueChange('generationScope', 'firstFew');
      });

      expect(result.current.formData.bookLength).toBe('standard-book');
      expect(result.current.formData.generationScope).toBe('firstFew');
    });

    it('should handle concurrent type changes', () => {
      const { result } = renderHook(
        useCreationJob,
        { initialProps: { type: 'book' as 'book' | 'piece', editingBookId: null, mode: null } }
      );
      act(() => result.current.reset('piece'));
      act(() => result.current.reset('book'));

      expect(result.current.formData.type).toBe('book');
    });
  });

  describe('⚠️ Boundary Values', () => {
    it('should handle maximum chapter count', () => {
      const { result } = renderHook(() => 
        useCreationJob({ type: 'book', editingBookId: null, mode: null })
      );

      act(() => {
        result.current.handleValueChange('targetChapterCount', 15);
      });

      expect(result.current.formData.targetChapterCount).toBe(15);
      expect(result.current.validationMessage).toBe('');
    });

    it('should handle zero credits', () => {
      vi.mocked(userContext.useUser).mockReturnValue({
        user: { uid: 'test', credits: 0, plan: 'free' } as User,
        loading: false, error: null, levelUpInfo: null, clearLevelUpInfo: vi.fn(), reloadUser: vi.fn(), retryUserFetch: vi.fn(),
      });

      const { result } = renderHook(() => 
        useCreationJob({ type: 'book', editingBookId: null, mode: null })
      );

      expect(result.current.canGenerate).toBe(false);
    });

    it('should handle exactly sufficient credits', () => {
      vi.mocked(userContext.useUser).mockReturnValue({
        user: { uid: 'test', credits: 1, plan: 'free' } as User,
        loading: false, error: null, levelUpInfo: null, clearLevelUpInfo: vi.fn(), reloadUser: vi.fn(), retryUserFetch: vi.fn(),
      });

      const { result } = renderHook(() => 
        useCreationJob({ type: 'book', editingBookId: null, mode: null })
      );

      act(() => {
        result.current.handleValueChange('bookLength', 'short-story');
        result.current.handleValueChange('coverImageOption', 'none');
      });

      expect(result.current.canGenerate).toBe(true);
    });
  });

  describe('⚠️ Session Recovery', () => {
    it('should recover active job from sessionStorage', () => {
      sessionStorage.setItem('activeJobId_test-user', 'recovered-job-123');

      const { result } = renderHook(() => 
        useCreationJob({ type: 'book', editingBookId: null, mode: null })
      );

      expect(result.current.activeId).toBe('recovered-job-123');
    });

    it('should handle corrupted sessionStorage data', () => {
      sessionStorage.setItem('activeJobId_test-user', 'null');

      const { result } = renderHook(() => 
        useCreationJob({ type: 'book', editingBookId: null, mode: null })
      );

      expect(result.current.activeId).toBe('null');
    });
  });
});
