// AudioEngine.test.ts - COMPLETE VERSION
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { audioEngine, type AudioEngineState } from './AudioEngine';
import type { Book, PlaylistItem, VocabularyItem } from '@/lib/types';
import * as ttsService from '@/services/tts-service';
import * as vocabService from '@/services/vocabulary-service';

// ============================================
// MOCKS
// ============================================

vi.mock('@/services/tts-service', () => ({
  speak: vi.fn(),
  cancel: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  getSystemVoices: vi.fn().mockReturnValue([
    { name: 'Google US English', lang: 'en-US', voiceURI: 'Google US English' },
    { name: 'Google Vietnamese', lang: 'vi-VN', voiceURI: 'Google Vietnamese' },
  ]),
}));

vi.mock('@/services/vocabulary-service', () => ({
  getVocabularyItemsByFolder: vi.fn().mockResolvedValue([]),
}));

// ============================================
// TEST DATA
// ============================================

const mockBook1: Book = {
  id: 'book1',
  type: 'book',
  userId: 'user1',
  title: { en: 'Test Book 1' },
  status: 'draft',
  presentationStyle: 'book',
  availableLanguages: ['en'],
  primaryLanguage: 'en',
  contentStatus: 'ready',
  coverStatus: 'ready',
  chapters: [
    {
      id: 'ch1',
      order: 0,
      title: { en: 'Chapter 1' },
      segments: [
        { 
          id: 's1', 
          type: 'text', 
          order: 0, 
          content: { primary: 'First sentence.' }, 
          metadata: { isParagraphStart: true, wordCount: { primary: 2 }, primaryLanguage: 'en' }, 
          formatting: {} 
        },
        { 
          id: 's2', 
          type: 'text', 
          order: 1, 
          content: { primary: 'Second sentence.' }, 
          metadata: { isParagraphStart: false, wordCount: { primary: 2 }, primaryLanguage: 'en' }, 
          formatting: {} 
        },
      ],
      stats: { totalSegments: 2, totalWords: 4, estimatedReadingTime: 1 },
      metadata: { primaryLanguage: 'en' }
    },
    {
      id: 'ch2',
      order: 1,
      title: { en: 'Chapter 2' },
      segments: [
        { 
          id: 's3', 
          type: 'text', 
          order: 0, 
          content: { primary: 'Chapter two sentence.' }, 
          metadata: { isParagraphStart: true, wordCount: { primary: 3 }, primaryLanguage: 'en' }, 
          formatting: {} 
        },
      ],
      stats: { totalSegments: 1, totalWords: 3, estimatedReadingTime: 1 },
      metadata: { primaryLanguage: 'en' }
    }
  ],
};

const mockBilingualBook: Book = {
  ...mockBook1,
  id: 'book-bilingual',
  availableLanguages: ['en', 'vi'],
  chapters: [
    {
      id: 'ch-bi-1',
      order: 0,
      title: { en: 'Bilingual Chapter', vi: 'Chương Song Ngữ' },
      segments: [
        { 
          id: 's-bi-1', 
          type: 'text', 
          order: 0, 
          content: { primary: 'Hello world.', secondary: 'Xin chào thế giới.' }, 
          metadata: { isParagraphStart: true, wordCount: { primary: 2, secondary: 3 }, primaryLanguage: 'en' }, 
          formatting: {} 
        },
        { 
          id: 's-bi-2', 
          type: 'text', 
          order: 1, 
          content: { primary: 'Good morning.', secondary: 'Chào buổi sáng.' }, 
          metadata: { isParagraphStart: false, wordCount: { primary: 2, secondary: 3 }, primaryLanguage: 'en' }, 
          formatting: {} 
        },
      ],
      stats: { totalSegments: 2, totalWords: 10, estimatedReadingTime: 1 },
      metadata: { primaryLanguage: 'en' }
    }
  ],
};

const mockBook2: Book = {
  ...mockBook1,
  id: 'book2',
  title: { en: 'Test Book 2' },
  chapters: [
    {
      id: 'ch2-1',
      order: 0,
      title: { en: 'Chapter 1-2' },
      segments: [
        { 
          id: 's4', 
          type: 'text', 
          order: 0, 
          content: { primary: 'Another book first sentence.' }, 
          metadata: { isParagraphStart: true, wordCount: { primary: 4 }, primaryLanguage: 'en' }, 
          formatting: {} 
        },
      ],
      stats: { totalSegments: 1, totalWords: 4, estimatedReadingTime: 1 },
      metadata: { primaryLanguage: 'en' }
    },
  ],
};

const mockEmptyBook: Book = {
  ...mockBook1,
  id: 'book-empty',
  chapters: [],
};

const mockPlaylistItem1: PlaylistItem = {
  type: 'book',
  id: 'book1',
  title: "Test Book 1",
  data: mockBook1,
  primaryLanguage: 'en',
  availableLanguages: ['en'],
};

const mockPlaylistItem2: PlaylistItem = {
  type: 'book',
  id: 'book2',
  title: "Test Book 2",
  data: mockBook2,
  primaryLanguage: 'en',
  availableLanguages: ['en'],
};

const mockBilingualPlaylistItem: PlaylistItem = {
  type: 'book',
  id: 'book-bilingual',
  title: "Bilingual Book",
  data: mockBilingualBook,
  primaryLanguage: 'en',
  secondaryLanguage: 'vi',
  availableLanguages: ['en', 'vi'],
};

const mockEmptyPlaylistItem: PlaylistItem = {
  type: 'book',
  id: 'book-empty',
  title: "Empty Book",
  data: mockEmptyBook,
  primaryLanguage: 'en',
  availableLanguages: ['en'],
};

const mockVocabItems: VocabularyItem[] = [
  {
    id: 'v1',
    userId: 'user1',
    term: 'Hello',
    termLanguage: 'en',
    meaning: 'Xin chào',
    meaningLanguage: 'vi',
    example: 'Hello world!',
    exampleLanguage: 'en',
    folder: 'folder1',
    srsState: 'new',
    memoryStrength: 0,
    streak: 0,
    attempts: 0,
    lastReviewed: null,
    dueDate: new Date(),
    context: 'manual',
  },
  {
    id: 'v2',
    userId: 'user1',
    term: 'Goodbye',
    termLanguage: 'en',
    meaning: 'Tạm biệt',
    meaningLanguage: 'vi',
    folder: 'folder1',
    srsState: 'learning',
    memoryStrength: 1,
    streak: 1,
    attempts: 1,
    lastReviewed: new Date(),
    dueDate: new Date(),
    context: 'manual',
  },
];

// ============================================
// TEST SUITE
// ============================================

describe('AudioEngine - Complete Test Suite', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    audioEngine.stop();
    audioEngine.clearPlaylist();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ===================================
  // 1. INITIALIZATION
  // ===================================
  describe('Initialization', () => {
    it('should initialize with idle state', () => {
      const state = audioEngine.getState();
      expect(state.status.type).toBe('idle');
      expect(state.playlist).toEqual([]);
      expect(state.position.playlistIndex).toBe(-1);
      expect(state.position.chapterIndex).toBeNull();
      expect(state.position.segmentIndex).toBe(0);
    });

    it('should load settings from localStorage on init', () => {
      const savedState = {
        playlist: [{ type: 'book', id: 'book1', title: 'Test Book 1' }],
        settings: {
          tts: { rate: 1.5, pitch: 1.2, voicesByLanguage: { en: 'test-voice' } },
          repeat: { track: 'one', playlist: 'all' },
          sleepTimer: { duration: null, startedAt: null },
        },
      };
      
      localStorage.setItem('audioEngineState', JSON.stringify(savedState));
      
      // This is a private method, so we cast to any to test it.
      (audioEngine as any).loadStateFromStorage();
      
      const state = audioEngine.getState();
      expect(state.settings.tts.rate).toBe(1.5);
      expect(state.settings.tts.pitch).toBe(1.2);
      expect(state.settings.repeat.track).toBe('one');
      expect(state.playlist).toHaveLength(1);
    });
  });

  // ===================================
  // 2. CORE PLAYBACK
  // ===================================
  describe('Core Playback Flow', () => {
    it('should play a book and enter playing state', async () => {
      await audioEngine.play(mockPlaylistItem1);

      const state = audioEngine.getState();
      expect(state.status.type).toBe('active');
      expect((state.status as any).state).toBe('playing');
      expect(state.playlist).toHaveLength(1);
      expect(state.position.playlistIndex).toBe(0);
      expect(state.position.chapterIndex).toBe(0);
      expect(state.position.segmentIndex).toBe(0);

      expect(ttsService.speak).toHaveBeenCalledWith(expect.objectContaining({
        text: 'First sentence.',
        lang: 'en',
      }));
    });

    it('should pause and resume playback correctly', async () => {
      await audioEngine.play(mockPlaylistItem1);
      
      audioEngine.pause();
      let state = audioEngine.getState();
      expect(state.status.type).toBe('active');
      expect((state.status as any).state).toBe('paused');
      expect(ttsService.pause).toHaveBeenCalled();

      audioEngine.resume();
      state = audioEngine.getState();
      expect(state.status.type).toBe('active');
      expect((state.status as any).state).toBe('playing');
      expect(ttsService.resume).toHaveBeenCalled();
    });

    it('should stop playback and reset state', async () => {
      await audioEngine.play(mockPlaylistItem1);
      audioEngine.stop();

      const state = audioEngine.getState();
      expect(state.status.type).toBe('idle');
      expect(state.position.playlistIndex).toBe(-1);
      expect(ttsService.cancel).toHaveBeenCalled();
    });

    it('should handle rapid play/pause clicks gracefully', async () => {
      await audioEngine.play(mockPlaylistItem1);
      
      audioEngine.pause();
      audioEngine.resume();
      audioEngine.pause();
      audioEngine.resume();
      
      const state = audioEngine.getState();
      expect(state.status.type).toBe('active');
      expect((state.status as any).state).toBe('playing');
    });

    it('should resume from idle if playlist has items', async () => {
      audioEngine.addToPlaylist(mockPlaylistItem1);
      expect(audioEngine.getState().status.type).toBe('idle');
      
      audioEngine.resume();
      
      await vi.waitFor(() => {
        const state = audioEngine.getState();
        expect(state.status.type).toBe('active');
        expect((state.status as any).state).toBe('playing');
      });
    });
  });

  // ===================================
  // 3. BILINGUAL BOOKS
  // ===================================
  describe('Bilingual Book Playback', () => {
    it('should generate segments for both languages', async () => {
      await audioEngine.play(mockBilingualPlaylistItem);

      expect(ttsService.speak).toHaveBeenNthCalledWith(1, expect.objectContaining({
        text: 'Hello world.',
        lang: 'en',
      }));
    });

    it('should alternate between primary and secondary languages', async () => {
      await audioEngine.play(mockBilingualPlaylistItem);

      const speakCall = vi.mocked(ttsService.speak).mock.calls[0][0];
      speakCall.onEnd?.();

      await vi.waitFor(() => {
        expect(ttsService.speak).toHaveBeenNthCalledWith(2, expect.objectContaining({
          text: 'Xin chào thế giới.',
          lang: 'vi',
        }));
      });
    });

    it('should use correct voice for each language', async () => {
      audioEngine.setVoiceForLanguage('en', 'Google US English');
      audioEngine.setVoiceForLanguage('vi', 'Google Vietnamese');

      await audioEngine.play(mockBilingualPlaylistItem);

      expect(ttsService.speak).toHaveBeenCalledWith(expect.objectContaining({
        lang: 'en',
        voiceURI: 'Google US English',
      }));

      const speakCall = vi.mocked(ttsService.speak).mock.calls[0][0];
      speakCall.onEnd?.();

      await vi.waitFor(() => {
        expect(ttsService.speak).toHaveBeenCalledWith(expect.objectContaining({
          lang: 'vi',
          voiceURI: 'Google Vietnamese',
        }));
      });
    });
  });

  // ===================================
  // 4. VOCABULARY PLAYBACK
  // ===================================
  describe('Vocabulary Playback', () => {
    beforeEach(() => {
      vi.mocked(vocabService.getVocabularyItemsByFolder).mockResolvedValue(mockVocabItems);
      audioEngine.setDependencies({ user: { uid: 'user1' } });
    });

    it('should play vocabulary folder correctly', async () => {
      const vocabPlaylistItem: PlaylistItem = {
        type: 'vocab',
        id: 'folder1',
        title: 'Vocabulary Folder 1',
      };

      await audioEngine.play(vocabPlaylistItem);

      await vi.waitFor(() => {
        expect(vocabService.getVocabularyItemsByFolder).toHaveBeenCalledWith('user1', 'folder1');
        expect(ttsService.speak).toHaveBeenCalledWith(expect.objectContaining({
          text: 'Hello',
          lang: 'en',
        }));
      });
    });

    it('should play term → meaning → example sequence', async () => {
      const vocabPlaylistItem: PlaylistItem = {
        type: 'vocab',
        id: 'folder1',
        title: 'Vocabulary Folder 1',
      };

      await audioEngine.play(vocabPlaylistItem);

      await vi.waitFor(() => {
        expect(ttsService.speak).toHaveBeenNthCalledWith(1, expect.objectContaining({
          text: 'Hello',
          lang: 'en',
        }));
      });

      let speakCall = vi.mocked(ttsService.speak).mock.calls[0][0];
      speakCall.onEnd?.();
      await vi.waitFor(() => {
        expect(ttsService.speak).toHaveBeenNthCalledWith(2, expect.objectContaining({
          text: 'Xin chào',
          lang: 'vi',
        }));
      });

      speakCall = vi.mocked(ttsService.speak).mock.calls[1][0];
      speakCall.onEnd?.();
      await vi.waitFor(() => {
        expect(ttsService.speak).toHaveBeenNthCalledWith(3, expect.objectContaining({
          text: 'Hello world!',
          lang: 'en',
        }));
      });
    });

    it('should skip example if not available', async () => {
      const vocabPlaylistItem: PlaylistItem = {
        type: 'vocab',
        id: 'folder1',
        title: 'Vocabulary Folder 1',
      };

      await audioEngine.play(vocabPlaylistItem);

      await vi.waitFor(() => {
        expect(ttsService.speak).toHaveBeenCalledTimes(1);
      });

      // Skip term, meaning, example of first item (3 segments)
      for (let i = 0; i < 3; i++) {
        const speakCall = vi.mocked(ttsService.speak).mock.calls[i][0];
        speakCall.onEnd?.();
        await vi.waitFor(() => {
          expect(ttsService.speak).toHaveBeenCalledTimes(i + 2);
        });
      }

      // Now at second vocab item - should have term and meaning
      expect(ttsService.speak).toHaveBeenCalledWith(expect.objectContaining({
        text: 'Goodbye',
      }));
    });
  });

  // ===================================
  // 5. PLAYLIST MANAGEMENT
  // ===================================
  describe('Playlist Management', () => {
    it('should add an item to the playlist', () => {
        audioEngine.addToPlaylist(mockPlaylistItem1);
        const state = audioEngine.getState();
        expect(state.playlist).toHaveLength(1);
        expect(state.playlist[0].id).toBe('book1');
    });

    it('should not add duplicate items', () => {
        audioEngine.addToPlaylist(mockPlaylistItem1);
        audioEngine.addToPlaylist(mockPlaylistItem1);
        expect(audioEngine.getState().playlist).toHaveLength(1);
    });

    it('should play the next track in the playlist', async () => {
        audioEngine.addToPlaylist(mockPlaylistItem1);
        audioEngine.addToPlaylist(mockPlaylistItem2);

        await audioEngine.play(mockPlaylistItem1);
        expect(audioEngine.getState().position.playlistIndex).toBe(0);
        
        audioEngine.nextTrack();
        
        await vi.waitFor(() => {
            const finalState = audioEngine.getState();
            expect(finalState.status.type).toBe('active');
            expect(finalState.position.playlistIndex).toBe(1);
            expect(audioEngine.currentTrack?.id).toBe('book2');
            expect(ttsService.speak).toHaveBeenCalledWith(expect.objectContaining({
                text: 'Another book first sentence.',
            }));
        });
    });

    it('should play the previous track in the playlist', async () => {
        audioEngine.addToPlaylist(mockPlaylistItem1);
        audioEngine.addToPlaylist(mockPlaylistItem2);

        await audioEngine.jumpToTrack(1);
        expect(audioEngine.getState().position.playlistIndex).toBe(1);

        audioEngine.previousTrack();
        
        await vi.waitFor(() => {
            const finalState = audioEngine.getState();
            expect(finalState.position.playlistIndex).toBe(0);
            expect(audioEngine.currentTrack?.id).toBe('book1');
        });
    });

    it('should not go to previous track if at the beginning of the playlist', async () => {
        audioEngine.addToPlaylist(mockPlaylistItem1);
        await audioEngine.play(mockPlaylistItem1);

        audioEngine.previousTrack();
        
        expect(audioEngine.getState().position.playlistIndex).toBe(0);
        expect(audioEngine.getState().status.type).toBe('active');
    });

    it('should stop when nextTrack() is called on the last item (no repeat)', async () => {
        audioEngine.addToPlaylist(mockPlaylistItem1);
        await audioEngine.play(mockPlaylistItem1);
        
        audioEngine.nextTrack();
        
        expect(audioEngine.getState().status.type).toBe('idle');
    });

    it('should loop back to the first track when repeat-all is on', async () => {
        audioEngine.addToPlaylist(mockPlaylistItem1);
        audioEngine.addToPlaylist(mockPlaylistItem2);
        audioEngine.setPlaylistRepeatMode('all');

        await audioEngine.jumpToTrack(1);
        audioEngine.nextTrack();

        await vi.waitFor(() => {
            const state = audioEngine.getState();
            expect(state.status.type).toBe('active');
            expect(state.position.playlistIndex).toBe(0);
            expect(audioEngine.currentTrack?.id).toBe('book1');
        });
    });

    it('should remove an item from the playlist and update position correctly', async () => {
        audioEngine.addToPlaylist(mockPlaylistItem1);
        audioEngine.addToPlaylist(mockPlaylistItem2);
        await audioEngine.jumpToTrack(1);

        audioEngine.removeFromPlaylist('book1');

        const state = audioEngine.getState();
        expect(state.playlist).toHaveLength(1);
        expect(state.playlist[0].id).toBe('book2');
        expect(state.position.playlistIndex).toBe(0);
    });

    it('should stop playback if the currently playing item is removed', async () => {
        audioEngine.addToPlaylist(mockPlaylistItem1);
        await audioEngine.play(mockPlaylistItem1);

        audioEngine.removeFromPlaylist('book1');

        const state = audioEngine.getState();
        expect(state.status.type).toBe('idle');
        expect(state.playlist).toHaveLength(0);
        expect(state.position.playlistIndex).toBe(-1);
    });

    it('should clear entire playlist', async () => {
        audioEngine.addToPlaylist(mockPlaylistItem1);
        audioEngine.addToPlaylist(mockPlaylistItem2);
        await audioEngine.play(mockPlaylistItem1);

        audioEngine.clearPlaylist();

        const state = audioEngine.getState();
        expect(state.status.type).toBe('idle');
        expect(state.playlist).toHaveLength(0);
    });
  });

  // ===================================
  // 6. NAVIGATION
  // ===================================
  describe('Navigation Within a Track', () => {
    it('should skip to the next segment with skipForward()', async () => {
      await audioEngine.play(mockPlaylistItem1);
      expect(audioEngine.getState().position.segmentIndex).toBe(0);
      
      audioEngine.skipForward();
      
      expect(audioEngine.getState().position.segmentIndex).toBe(1);
      expect(ttsService.speak).toHaveBeenLastCalledWith(expect.objectContaining({
        text: 'Second sentence.'
      }));
    });

    it('should skip to the previous segment with skipBackward()', async () => {
      await audioEngine.play(mockPlaylistItem1, { segmentIndex: 1 });
      expect(audioEngine.getState().position.segmentIndex).toBe(1);

      audioEngine.skipBackward();
      
      expect(audioEngine.getState().position.segmentIndex).toBe(0);
      expect(ttsService.speak).toHaveBeenLastCalledWith(expect.objectContaining({
        text: 'First sentence.'
      }));
    });

    it('should not go below segment 0', async () => {
      await audioEngine.play(mockPlaylistItem1);
      expect(audioEngine.getState().position.segmentIndex).toBe(0);

      audioEngine.skipBackward();
      
      expect(audioEngine.getState().position.segmentIndex).toBe(0);
    });

    it('should automatically advance to the next chapter after the last segment', async () => {
      await audioEngine.play(mockPlaylistItem1, { chapterIndex: 0, segmentIndex: 1 });

      const speakCall = vi.mocked(ttsService.speak).mock.calls[0][0];
      speakCall.onEnd?.();
      
      await vi.waitFor(() => {
        const state = audioEngine.getState();
        expect(state.position.chapterIndex).toBe(1);
        expect(state.position.segmentIndex).toBe(0);
      });
    });

    it('should repeat the current segment when repeat-one is on', async () => {
      audioEngine.setRepeatMode('one');
      await audioEngine.play(mockPlaylistItem1);

      expect(ttsService.speak).toHaveBeenCalledTimes(1);

      const speakCall = vi.mocked(ttsService.speak).mock.calls[0][0];
      speakCall.onEnd?.();

      await vi.waitFor(() => {
        expect(audioEngine.getState().position.segmentIndex).toBe(0);
        expect(ttsService.speak).toHaveBeenCalledTimes(2);
      });
    });

    it('should seek to a specific segment within the current chapter', async () => {
      await audioEngine.play(mockPlaylistItem1);
      
      audioEngine.seekToSegment(1);

      expect(audioEngine.getState().position.segmentIndex).toBe(1);
      expect(ttsService.speak).toHaveBeenLastCalledWith(expect.objectContaining({
        text: 'Second sentence.'
      }));
    });

    it('should not seek to invalid segment index', async () => {
      await audioEngine.play(mockPlaylistItem1);
      const initialIndex = audioEngine.getState().position.segmentIndex;
      
      audioEngine.seekToSegment(999);
      
      expect(audioEngine.getState().position.segmentIndex).toBe(initialIndex);
    });
  });

  // ===================================
  // 7. WORD BOUNDARY TRACKING
  // ===================================
  describe('Word Boundary Tracking', () => {
    it('should update word boundary during playback', async () => {
      await audioEngine.play(mockPlaylistItem1);
      
      const speakCall = vi.mocked(ttsService.speak).mock.calls[0][0];
      speakCall.onBoundary?.({ charIndex: 5, charLength: 8 } as any);
      
      const state = audioEngine.getState();
      expect(state.position.wordBoundary).toEqual({
        charIndex: 5,
        charLength: 8,
      });
    });

    it('should clear word boundary on segment end', async () => {
      await audioEngine.play(mockPlaylistItem1);
      
      const speakCall = vi.mocked(ttsService.speak).mock.calls[0][0];
      speakCall.onBoundary?.({ charIndex: 5, charLength: 8 } as any);
      expect(audioEngine.getState().position.wordBoundary).not.toBeNull();
      
      speakCall.onEnd?.();
      
      await vi.waitFor(() => {
        expect(audioEngine.getState().position.wordBoundary).toBeNull();
      });
    });
  });

  // ===================================
  // 8. SETTINGS
  // ===================================
  describe('Settings Management', () => {
    it('should update TTS rate', () => {
      audioEngine.setTtsRate(1.5);
      expect(audioEngine.getState().settings.tts.rate).toBe(1.5);
    });

    it('should update TTS pitch', () => {
      audioEngine.setTtsPitch(1.2);
      expect(audioEngine.getState().settings.tts.pitch).toBe(1.2);
    });

    it('should set voice for language', () => {
      audioEngine.setVoiceForLanguage('en', 'Google US English');
      const state = audioEngine.getState();
      expect(state.settings.tts.voicesByLanguage['en']).toBe('Google US English');
    });

    it('should toggle repeat mode', () => {
      audioEngine.setRepeatMode('one');
      expect(audioEngine.getState().settings.repeat.track).toBe('one');
      
      audioEngine.setRepeatMode('off');
      expect(audioEngine.getState().settings.repeat.track).toBe('off');
    });

    it('should set and trigger sleep timer', async () => {
      vi.useFakeTimers();
      
      audioEngine.setSleepTimer(1);
      await audioEngine.play(mockPlaylistItem1);

      let state = audioEngine.getState();
      expect(state.settings.sleepTimer.duration).toBe(1);
      expect(state.settings.sleepTimer.startedAt).not.toBeNull();
      
      vi.advanceTimersByTime(60 * 1000 + 100);

      state = audioEngine.getState();
      expect(state.status.type).toBe('active');
      expect((state.status as any).state).toBe('paused');
      expect(state.settings.sleepTimer.duration).toBeNull();
    });

    it('should clear sleep timer', async () => {
      vi.useFakeTimers();
      
      audioEngine.setSleepTimer(5);
      await audioEngine.play(mockPlaylistItem1);
      
      audioEngine.setSleepTimer(null);
      
      const state = audioEngine.getState();
      expect(state.settings.sleepTimer.duration).toBeNull();
      expect(state.settings.sleepTimer.startedAt).toBeNull();
      
      vi.advanceTimersByTime(5 * 60 * 1000);
      expect(audioEngine.getState().status.type).toBe('active');
    });
  });

  // ===================================
  // 9. ERROR HANDLING
  // ===================================
  describe('Error Handling', () => {
    it('should handle TTS errors', async () => {
      vi.mocked(ttsService.speak).mockImplementationOnce((options) => {
        options.onError?.({ error: 'Network error' } as any);
      });

      await audioEngine.play(mockPlaylistItem1);

      const state = audioEngine.getState();
      expect(state.status.type).toBe('error');
    });

    it('should handle empty book', async () => {
      await audioEngine.play(mockEmptyPlaylistItem);
      
      const state = audioEngine.getState();
      expect(state.status.type).toMatch(/idle|error/);
    });

    it('should handle missing chapter data', async () => {
      const invalidItem: PlaylistItem = {
        ...mockPlaylistItem1,
        data: { ...mockBook1, chapters: [] },
      };

      await audioEngine.play(invalidItem);
      
      const state = audioEngine.getState();
      expect(state.status.type).toMatch(/idle|error/);
    });
  });

  // ===================================
  // 10. STATE SUBSCRIPTION
  // ===================================
  describe('State Subscription', () => {
    it('should notify listeners on state change', async () => {
      const listener = vi.fn();
      const unsubscribe = audioEngine.subscribe(listener);
      
      // Initial state
      expect(listener).toHaveBeenCalledTimes(1); 
      
      await audioEngine.play(mockPlaylistItem1);
      
      await vi.waitFor(() => {
        // We expect more than 2 calls (idle -> loading -> playing)
        expect(listener.mock.calls.length).toBeGreaterThan(2);
      });
      
      unsubscribe();
    });

    it('should not notify unsubscribed listeners', async () => {
      const listener = vi.fn();
      const unsubscribe = audioEngine.subscribe(listener);
      
      expect(listener).toHaveBeenCalledTimes(1);
      
      unsubscribe();
      
      await audioEngine.play(mockPlaylistItem1);
      
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should support multiple listeners', async () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      
      audioEngine.subscribe(listener1);
      audioEngine.subscribe(listener2);
      
      await audioEngine.play(mockPlaylistItem1);
      
      await vi.waitFor(() => {
        expect(listener1.mock.calls.length).toBeGreaterThan(2);
        expect(listener2.mock.calls.length).toBeGreaterThan(2);
      });
    });
  });

  // ===================================
  // 11. COMPUTED PROPERTIES
  // ===================================
  describe('Computed Properties', () => {
    it('should return current track', async () => {
      expect(audioEngine.currentTrack).toBeNull();
      
      await audioEngine.play(mockPlaylistItem1);
      
      expect(audioEngine.currentTrack?.id).toBe('book1');
    });

    it('should calculate progress', async () => {
      await audioEngine.play(mockPlaylistItem1);
      
      // Initially, progress might be 0 but let's check it becomes > 0
      const speakCall = vi.mocked(ttsService.speak).mock.calls[0][0];
      speakCall.onEnd?.();

      await vi.waitFor(() => {
        expect(audioEngine.progress).toBeGreaterThan(0);
        expect(audioEngine.progress).toBeLessThanOrEqual(100);
      });
    });

    it('should return current segment language', async () => {
      await audioEngine.play(mockPlaylistItem1);
      
      expect(audioEngine.currentSegmentLanguage).toBe('en');
    });

    it('should return available voices', () => {
      const voices = audioEngine.availableVoices;
      
      expect(voices).toHaveLength(2);
      expect(voices[0].name).toBe('Google US English');
    });
  });

  // ===================================
  // 12. PERSISTENCE
  // ===================================
  describe('State Persistence', () => {
    it('should save state to localStorage', async () => {
      audioEngine.addToPlaylist(mockPlaylistItem1);
      audioEngine.setTtsRate(1.5);
      
      const saved = localStorage.getItem('audioEngineState');
      expect(saved).not.toBeNull();
      
      const parsed = JSON.parse(saved!);
      expect(parsed.settings.tts.rate).toBe(1.5);
      expect(parsed.playlist).toHaveLength(1);
    });

    it('should not save book data to localStorage', async () => {
      audioEngine.addToPlaylist(mockPlaylistItem1);
      
      const saved = localStorage.getItem('audioEngineState');
      const parsed = JSON.parse(saved!);
      
      expect(parsed.playlist[0].data).toBeUndefined();
    });
  });
});
