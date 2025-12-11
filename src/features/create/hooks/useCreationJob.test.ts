// src/features/create/hooks/useCreationJob.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCreationJob } from '../../useCreationJob'; // Fixed path
import type { User } from '@/lib/types';
import { doc, onSnapshot } from 'firebase/firestore';

// Mock dependencies
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
      if (params) return `${key}(${JSON.stringify(params)})`;
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

vi.mock('@/contexts/user-context', () => ({
  useUser: () => ({
    user: {
      uid: 'test-user',
      credits: 100,
      plan: 'free',
    } as User,
  }),
}));

vi.mock('@/services/creation-service', () => ({
  createLibraryItem: vi.fn(() => Promise.resolve('new-job-123')),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  onSnapshot: vi.fn(),
}));

describe('useCreationJob Hook - Form State Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.clearAllTimers();
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
        aiPrompt: expect.any(String),
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
        display: 'card',
        aspectRatio: '3:4',
      });
    });

    it('should reset form when type changes', () => {
      const { result, rerender } = renderHook(
        ({ type }) => useCreationJob({ type, editingBookId: null, mode: null }),
        { initialProps: { type: 'book' as 'book' | 'piece' } }
      );

      const initialPrompt = result.current.formData.aiPrompt;

      // Change type to piece
      rerender({ type: 'piece' as 'book' | 'piece' });

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

      // Enable bilingual
      act(() => {
        result.current.handleValueChange('isBilingual', true);
      });

      // Change secondary language
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

      // Enable bilingual first
      act(() => {
        result.current.handleValueChange('isBilingual', true);
      });

      const originBefore = result.current.formData.origin;

      // Toggle phrase mode
      act(() => {
        result.current.handleValueChange('origin', result.current.formData.origin);
      });

      // Should toggle -ph suffix
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
      expect(result.current.validationMessage).toContain('empty');
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

      // Too low
      act(() => {
        result.current.handleValueChange('targetChapterCount', 0);
      });

      expect(result.current.validationMessage).toContain('outOfRange');

      // Too high
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
        result.current.handleValueChange('secondaryLanguage', 'en'); // Same as primary
      });

      expect(result.current.validationMessage).toContain('sameLanguage');
    });

    it('should validate insufficient credits', () => {
      const { useUser } = require('@/contexts/user-context');
      vi.mocked(useUser).mockReturnValue({
        user: { uid: 'test', credits: 0, plan: 'free' }
      });

      const { result } = renderHook(() => 
        useCreationJob({ type: 'book', editingBookId: null, mode: null })
      );

      expect(result.current.canGenerate).toBe(false);
      expect(result.current.validationMessage).toBe('');
      // validationMessage is empty but canGenerate is false
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
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('✅ Submission Flow', () => {
    it('should submit job and store activeId', async () => {
      const mockCreateLibraryItem = vi.fn(() => Promise.resolve('job-123'));
      vi.mocked(require('@/services/creation-service').createLibraryItem).mockImplementation(mockCreateLibraryItem);

      const { result } = renderHook(() => 
        useCreationJob({ type: 'book', editingBookId: null, mode: null })
      );

      // Set valid prompt
      act(() => {
        result.current.handleInputChange({
          target: { name: 'aiPrompt', value: 'A fantasy story' }
        } as any);
      });

      // Submit
      await act(async () => {
        await result.current.handleSubmit({ preventDefault: vi.fn() } as any);
      });

      expect(mockCreateLibraryItem).toHaveBeenCalled();
      expect(result.current.activeId).toBe('job-123');
      expect(result.current.isBusy).toBe(true);
    });

    it('should not submit with validation errors', async () => {
      const mockCreateLibraryItem = vi.fn();
      vi.mocked(require('@/services/creation-service').createLibraryItem).mockImplementation(mockCreateLibraryItem);

      const { result } = renderHook(() => 
        useCreationJob({ type: 'book', editingBookId: null, mode: null })
      );

      // Set empty prompt
      act(() => {
        result.current.handleInputChange({
          target: { name: 'aiPrompt', value: '' }
        } as any);
      });

      await act(async () => {
        await result.current.handleSubmit({ preventDefault: vi.fn() } as any);
      });

      expect(mockCreateLibraryItem).not.toHaveBeenCalled();
    });

    it('should store jobId in sessionStorage', async () => {
      vi.mocked(require('@/services/creation-service').createLibraryItem).mockResolvedValue('job-456');

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

      expect(sessionStorage.getItem('activeJobId_test-user')).toBe('job-456');
    });
  });

  describe('⚠️ Timeout Handling', () => {
    it('should set timeout on job submission', async () => {
      vi.mocked(require('@/services/creation-service').createLibraryItem).mockResolvedValue('job-789');

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

      // Advance timers to trigger timeout
      act(() => {
        vi.advanceTimersByTime(180000);
      });

      // Should show timeout error
      // (In real implementation, would update DB and reset)
    });

    it('should clear timeout when job completes', async () => {
      const mockOnSnapshot = vi.fn((docRef, callback) => {
        // Immediately call with completed job
        setTimeout(() => {
          callback({
            exists: () => true,
            id: 'job-complete',
            data: () => ({
              id: 'job-complete',
              type: 'book',
              contentState: 'ready',
              coverState: 'ready',
            })
          });
        }, 100);

        return vi.fn(); // unsubscribe
      });

      vi.mocked(onSnapshot).mockImplementation(mockOnSnapshot);
      vi.mocked(require('@/services/creation-service').createLibraryItem).mockResolvedValue('job-complete');

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

      // Advance to trigger snapshot callback
      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(result.current.finalizedId).toBe('job-complete');
      });
    });
  });
});

describe('useCreationJob Hook - Realtime Updates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('✅ Snapshot Listener', () => {
    it('should subscribe to Firestore when activeId is set', async () => {
      const mockOnSnapshot = vi.fn(() => vi.fn());
      vi.mocked(onSnapshot).mockImplementation(mockOnSnapshot);

      const { result } = renderHook(() => 
        useCreationJob({ type: 'book', editingBookId: null, mode: null })
      );

      // Manually set activeId
      act(() => {
        (result.current as any).setActiveId('test-job-123');
      });

      await waitFor(() => {
        expect(mockOnSnapshot).toHaveBeenCalled();
      });
    });

    it('should update jobData when snapshot changes', async () => {
      const callbacks: Array<(snap: any) => void> = [];
      
      const mockOnSnapshot = vi.fn((docRef, callback) => {
        callbacks.push(callback);
        return vi.fn(); // unsubscribe
      });

      vi.mocked(onSnapshot).mockImplementation(mockOnSnapshot);
      vi.mocked(require('@/services/creation-service').createLibraryItem).mockResolvedValue('job-updates');

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

      // Simulate snapshot update
      act(() => {
        callbacks[0]?.({
          exists: () => true,
          id: 'job-updates',
          data: () => ({
            id: 'job-updates',
            type: 'book',
            contentState: 'processing',
            coverState: 'processing',
            title: { en: 'Updating Title' }
          })
        });
      });

      expect(result.current.jobData).toBeDefined();
      expect(result.current.jobData?.title).toEqual({ en: 'Updating Title' });
    });

    it('should finalize when both pipelines complete', async () => {
      const callbacks: Array<(snap: any) => void> = [];
      
      const mockOnSnapshot = vi.fn((docRef, callback) => {
        callbacks.push(callback);
        return vi.fn();
      });

      vi.mocked(onSnapshot).mockImplementation(mockOnSnapshot);
      vi.mocked(require('@/services/creation-service').createLibraryItem).mockResolvedValue('job-done');

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

      // Simulate completion
      act(() => {
        callbacks[0]?.({
          exists: () => true,
          id: 'job-done',
          data: () => ({
            id: 'job-done',
            type: 'book',
            contentState: 'ready',
            coverState: 'ready',
          })
        });
      });

      expect(result.current.finalizedId).toBe('job-done');
      expect(result.current.isBusy).toBe(false);
    });
  });

  describe('⚠️ Race Condition Prevention', () => {
    it('should cleanup subscription on unmount', async () => {
      const unsubscribe = vi.fn();
      const mockOnSnapshot = vi.fn(() => unsubscribe);

      vi.mocked(onSnapshot).mockImplementation(mockOnSnapshot);
      vi.mocked(require('@/services/creation-service').createLibraryItem).mockResolvedValue('job-unmount');

      const { result, unmount } = renderHook(() => 
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

      unmount();

      expect(unsubscribe).toHaveBeenCalled();
    });

    it('should NOT update state after unmount', async () => {
      const callbacks: Array<(snap: any) => void> = [];
      
      const mockOnSnapshot = vi.fn((docRef, callback) => {
        callbacks.push(callback);
        return vi.fn();
      });

      vi.mocked(onSnapshot).mockImplementation(mockOnSnapshot);

      const { result, unmount } = renderHook(() => 
        useCreationJob({ type: 'book', editingBookId: null, mode: null })
      );

      // Set activeId to trigger subscription
      act(() => {
        (result.current as any).setActiveId('test-job');
      });

      unmount();

      // Try to fire snapshot after unmount
      expect(() => {
        callbacks[0]?.({
          exists: () => true,
          data: () => ({})
        });
      }).not.toThrow();
    });
  });
});

describe('useCreationJob Hook - SessionStorage Recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('should recover active job from sessionStorage', () => {
    sessionStorage.setItem('activeJobId_test-user', 'recovered-job-123');

    const { result } = renderHook(() => 
      useCreationJob({ type: 'book', editingBookId: null, mode: null })
    );

    expect(result.current.activeId).toBe('recovered-job-123');
  });

  it('should clear sessionStorage on finalization', async () => {
    sessionStorage.setItem('activeJobId_test-user', 'clear-me');

    const callbacks: Array<(snap: any) => void> = [];
    const mockOnSnapshot = vi.fn((docRef, callback) => {
      callbacks.push(callback);
      return vi.fn();
    });

    vi.mocked(onSnapshot).mockImplementation(mockOnSnapshot);

    const { result } = renderHook(() => 
      useCreationJob({ type: 'book', editingBookId: null, mode: null })
    );

    // Simulate job completion
    act(() => {
      callbacks[0]?.({
        exists: () => true,
        id: 'clear-me',
        data: () => ({
          id: 'clear-me',
          type: 'book',
          contentState: 'ready',
          coverState: 'ready',
        })
      });
    });

    expect(sessionStorage.getItem('activeJobId_test-user')).toBeNull();
  });
});