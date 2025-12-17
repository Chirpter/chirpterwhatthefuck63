

// AudioEngine.test.ts - COMPLETE VERSION
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { audioEngine, type AudioEngineState } from './AudioEngine';
import type { Book, PlaylistItem, VocabularyItem, Segment } from '@/lib/types';
import * as ttsService from '@/services/client/tts.service';
import * as vocabService from '@/services/client/vocabulary-service';

// ============================================
// MOCKS
// ============================================

vi.mock('@/services/client/tts.service', () => ({
  speak: vi.fn(),
  cancel: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  getSystemVoices: vi.fn().mockReturnValue([
    { name: 'Google US English', lang: 'en-US', voiceURI: 'Google US English' },
    { name: 'Google Vietnamese', lang: 'vi-VN', voiceURI: 'Google Vietnamese' },
  ]),
}));

vi.mock('@/services/client/vocabulary-service', () => ({
  getVocabularyItemsByFolder: vi.fn().mockResolvedValue([]),
}));

// ============================================
// TEST DATA
// ============================================

const mockSegments: Segment[] = [
    { 
        id: 's1', 
        order: 0, 
        content: ['', { en: 'First sentence.' }]
    },
    { 
        id: 's2', 
        order: 1, 
        content: ['', { en: 'Second sentence.' }]
    },
];

const mockBook1: Book = {
  id: 'book1',
  type: 'book',
  userId: 'user1',
  title: { en: 'Test Book 1' },
  status: 'draft',
  presentationStyle: 'book',
  availableLanguages: ['en'],
  primaryLanguage: 'en',
  contentState: 'ready',
  coverState: 'ready',
  content: [
      { id: 'h1', order: 0, content: ['# ', { en: 'Chapter 1' }] },
      ...mockSegments,
      { id: 'h2', order: 3, content: ['# ', { en: 'Chapter 2' }] },
      { id: 's3', order: 4, content: ['', { en: 'Chapter two sentence.' }] },
  ],
};

const mockBilingualBook: Book = {
  ...mockBook1,
  id: 'book-bilingual',
  availableLanguages: ['en', 'vi'],
  primaryLanguage: 'en',
  content: [
    { id: 'h-bi-1', order: 0, content: ['# ', { en: 'Bilingual Chapter', vi: 'Chương Song Ngữ' }] },
    { id: 's-bi-1', order: 1, content: ['', { en: 'Hello world.', vi: 'Xin chào thế giới.' }] },
    { id: 's-bi-2', order: 2, content: ['', { en: 'Good morning.', vi: 'Chào buổi sáng.' }] },
  ],
};

const mockBook2: Book = {
  ...mockBook1,
  id: 'book2',
  title: { en: 'Test Book 2' },
  availableLanguages: ['en'],
  primaryLanguage: 'en',
  content: [
      { id: 's4', order: 0, content: ['', { en: 'Another book first sentence.' }] },
  ],
};

const mockEmptyBook: Book = {
  ...mockBook1,
  id: 'book-empty',
  content: [],
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
    audioEngine().stop();
    audioEngine().clearPlaylist();
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
      const state = audioEngine().getState();
      expect(state.status.type).toBe('idle');
      expect(state.playlist).toEqual([]);
      expect(state.position.playlistIndex).toBe(-1);
      expect(state.position.segmentIndex).toBe(0);
    });

    it('should load settings from localStorage on init', () => {
      const savedState = {
        playlist: [{ type: 'book', id: 'book1', title: 'Test Book 1', primaryLanguage: 'en', availableLanguages: ['en'] }],
        settings: {
          tts: { rate: 1.5, pitch: 1.2, voicesByLanguage: { en: 'test-voice' } },
          repeat: { track: 'item', playlist: 'all' },
          sleepTimer: { duration: null, startedAt: null },
        },
      };
      
      localStorage.setItem('audioEngineState', JSON.stringify(savedState));
      
      // The constructor should handle loading
      const newEngineInstance = audioEngine();
      
      const state = newEngineInstance.getState();
      expect(state.settings.tts.rate).toBe(1.5);
      expect(state.settings.tts.pitch).toBe(1.2);
      expect(state.settings.repeat.track).toBe('item');
      expect(state.playlist).toHaveLength(1);
    });
  });

  // ===================================
  // 2. CORE PLAYBACK
  // ===================================
  describe('Core Playback Flow', () => {
    it('should play a book and enter playing state', async () => {
      const engine = audioEngine();
      await engine.play(mockPlaylistItem1);

      const state = engine.getState();
      expect(state.status.type).toBe('active');
      expect((state.status as any).state).toBe('playing');
      expect(state.playlist).toHaveLength(1);
      expect(state.position.playlistIndex).toBe(0);
      expect(state.position.segmentIndex).toBe(0);

      expect(ttsService.speak).toHaveBeenCalledWith(expect.objectContaining({
        text: 'Chapter 1',
        lang: 'en',
      }));
    });

    it('should pause and resume playback correctly', async () => {
      const engine = audioEngine();
      await engine.play(mockPlaylistItem1);
      
      engine.pause();
      let state = engine.getState();
      expect(state.status.type).toBe('active');
      expect((state.status as any).state).toBe('paused');
      expect(ttsService.pause).toHaveBeenCalled();

      engine.resume();
      state = engine.getState();
      expect(state.status.type).toBe('active');
      expect((state.status as any).state).toBe('playing');
      expect(ttsService.resume).toHaveBeenCalled();
    });

    it('should stop playback and reset state', async () => {
      const engine = audioEngine();
      await engine.play(mockPlaylistItem1);
      engine.stop();

      const state = engine.getState();
      expect(state.status.type).toBe('idle');
      expect(state.position.playlistIndex).toBe(-1);
      expect(ttsService.cancel).toHaveBeenCalled();
    });

    it('should resume from idle if playlist has items', async () => {
      const engine = audioEngine();
      engine.addToPlaylist(mockPlaylistItem1);
      expect(engine.getState().status.type).toBe('idle');
      
      engine.resume();
      
      await vi.waitFor(() => {
        const state = engine.getState();
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
      const engine = audioEngine();
      await engine.play(mockBilingualPlaylistItem, { playbackLanguages: ['en', 'vi'] });

      expect(ttsService.speak).toHaveBeenNthCalledWith(1, expect.objectContaining({
        text: 'Bilingual Chapter',
        lang: 'en',
      }));
    });

    it('should alternate between primary and secondary languages', async () => {
      const engine = audioEngine();
      await engine.play(mockBilingualPlaylistItem, { playbackLanguages: ['en', 'vi'] });

      // First segment (heading)
      const speakCall1 = vi.mocked(ttsService.speak).mock.calls[0][0];
      speakCall1.onEnd?.();

      await vi.waitFor(() => {
        expect(ttsService.speak).toHaveBeenNthCalledWith(2, expect.objectContaining({
          text: 'Chương Song Ngữ',
          lang: 'vi',
        }));
      });
      
      // Second segment
      const speakCall2 = vi.mocked(ttsService.speak).mock.calls[1][0];
      speakCall2.onEnd?.();
      
      await vi.waitFor(() => {
        expect(ttsService.speak).toHaveBeenNthCalledWith(3, expect.objectContaining({
          text: 'Hello world.',
          lang: 'en',
        }));
      });
    });

    it('should use correct voice for each language', async () => {
      const engine = audioEngine();
      engine.setVoiceForLanguage('en', 'Google US English');
      engine.setVoiceForLanguage('vi', 'Google Vietnamese');

      await engine.play(mockBilingualPlaylistItem, { playbackLanguages: ['en', 'vi'] });

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
      audioEngine().setDependencies({ user: { uid: 'user1' } });
    });

    it('should play vocabulary folder correctly', async () => {
      const engine = audioEngine();
      const vocabPlaylistItem: PlaylistItem = {
        type: 'vocab',
        id: 'folder1',
        title: 'Vocabulary Folder 1',
        primaryLanguage: 'en',
        availableLanguages: ['en', 'vi'],
      };

      await engine.play(vocabPlaylistItem);

      await vi.waitFor(() => {
        expect(vocabService.getVocabularyItemsByFolder).toHaveBeenCalledWith('user1', 'folder1');
        expect(ttsService.speak).toHaveBeenCalledWith(expect.objectContaining({
          text: 'Hello',
          lang: 'en',
        }));
      });
    });
  });

  // ===================================
  // 5. PLAYLIST MANAGEMENT
  // ===================================
  describe('Playlist Management', () => {
    it('should play the next track in the playlist', async () => {
        const engine = audioEngine();
        engine.addToPlaylist(mockPlaylistItem1);
        engine.addToPlaylist(mockPlaylistItem2);

        await engine.play(mockPlaylistItem1);
        expect(engine.getState().position.playlistIndex).toBe(0);
        
        engine.nextTrack();
        
        await vi.waitFor(() => {
            const finalState = engine.getState();
            expect(finalState.status.type).toBe('active');
            expect(finalState.position.playlistIndex).toBe(1);
            expect(engine.currentTrack?.id).toBe('book2');
            expect(ttsService.speak).toHaveBeenCalledWith(expect.objectContaining({
                text: 'Another book first sentence.',
            }));
        });
    });
  });

  // ===================================
  // 6. NAVIGATION
  // ===================================
  describe('Navigation Within a Track', () => {
    it('should automatically advance to the next segment after the current one finishes', async () => {
      const engine = audioEngine();
      await engine.play(mockPlaylistItem1);

      // First call for the heading
      expect(ttsService.speak).toHaveBeenCalledWith(expect.objectContaining({ text: 'Chapter 1' }));

      // Simulate first speech ending
      const speakCall1 = vi.mocked(ttsService.speak).mock.calls[0][0];
      speakCall1.onEnd?.();

      // Should now speak the first sentence
      await vi.waitFor(() => {
        expect(engine.getState().position.segmentIndex).toBe(1);
        expect(ttsService.speak).toHaveBeenLastCalledWith(expect.objectContaining({
          text: 'First sentence.',
        }));
      });
    });
  });
});
