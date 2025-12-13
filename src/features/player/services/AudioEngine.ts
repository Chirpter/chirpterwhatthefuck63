

/**
 * ============================================
 * CLEAN AUDIO ENGINE - Fully Refactored
 * ============================================
 * 
 * Key improvements:
 * 1. State reduced from 15 → 4 core fields
 * 2. Atomic operations (position updates in one go)
 * 3. Clear separation: state vs computed vs cache
 * 4. Each method does ONE thing
 */

import type {
  PlaylistItem,
  Book,
  Chapter,
  Segment,
  VocabularyItem,
} from '@/lib/types';
import * as ttsService from '@/services/client/tts.service';
import { getSystemVoices } from '@/services/client/tts.service';
import { getVocabularyItemsByFolder } from '@/services/client/vocabulary-service';

// ============================================
// TYPES - Clean & Minimal
// ============================================

export type PlaybackStatus = 
  | { type: 'idle' }
  | { type: 'loading'; trackId: string }
  | { type: 'active'; state: 'playing' | 'paused' }
  | { type: 'error'; message: string };

export interface PlaybackPosition {
  playlistIndex: number;        // -1 = nothing playing
  chapterIndex: number | null;  // null for vocab
  segmentIndex: number;
  wordBoundary: { charIndex: number; charLength: number } | null; // For text highlighting
}

export interface AudioSettings {
  tts: {
    rate: number;
    pitch: number;
    voicesByLanguage: Record<string, string>;
  };
  repeat: {
    track: 'off' | 'item';
    playlist: 'off' | 'all';
  };
  sleepTimer: {
    duration: number | null;
    startedAt: number | null;
  };
}

export interface AudioEngineState {
  status: PlaybackStatus;
  playlist: PlaylistItem[];
  position: PlaybackPosition;
  settings: AudioSettings;
}

// Playable segment (internal type)
interface SpeechSegment {
  text: string;
  lang: string;
  originalSegmentId: string;
}

// Cache for expensive computations (NOT in state)
interface BookCache {
  totalSegmentsInBook: number; // Total original segments in the whole book
  totalSpokenSegmentsInChapter: number; // Spoken segments for the CURRENT chapter
  cumulativeOriginalSegments: number; // Original segments up to the start of the current chapter
}

// External event listener
type StateListener = (state: AudioEngineState) => void;

interface EngineDependencies {
  user?: any;
  toast?: any;
  t?: (key: string) => string;
}

// ============================================
// AUDIO ENGINE - Clean Implementation
// ============================================

class AudioEngine {
  // === STATE ===
  private state: AudioEngineState;
  
  // === CACHE (separate from state!) ===
  private segmentsCache: SpeechSegment[] = [];
  private bookStatsCache: BookCache | null = null;
  private currentPlaybackLanguages: string[] = [];
  
  // === LISTENERS ===
  private listeners = new Set<StateListener>();
  
  // === DEPENDENCIES ===
  private deps: EngineDependencies = {};
  
  // === TIMERS ===
  private sleepTimer: NodeJS.Timeout | null = null;
  
  constructor() {
    this.state = this.getInitialState();
    this.loadStateFromStorage();
    
    if (typeof window !== 'undefined') {
      window.speechSynthesis.onvoiceschanged = () => {
        this.notifyListeners(); // Voices changed, notify UI
      };
    }
  }
  
  // ============================================
  // PUBLIC API - Commands
  // ============================================
  
  /**
   * Play a track (book or vocab folder)
   */
  public async play(
    item: PlaylistItem,
    options?: { 
      chapterIndex?: number; 
      segmentIndex?: number;
      playbackLanguages?: string[];
    }
  ): Promise<void> {
    this.stop(); // Clean slate
    
    try {
      // 1. Add to playlist if needed
      const playlistIndex = this.ensureInPlaylist(item);
      
      // 2. Set languages to be played for this session
      const secondaryLang = item.availableLanguages.find(l => l !== item.primaryLanguage);
      this.currentPlaybackLanguages = options?.playbackLanguages || (secondaryLang ? [item.primaryLanguage, secondaryLang] : [item.primaryLanguage]);
      
      // 3. Set position
      this.setPosition({
        playlistIndex,
        chapterIndex: options?.chapterIndex ?? (item.type === 'book' ? 0 : null),
        segmentIndex: options?.segmentIndex ?? 0,
        wordBoundary: null,
      });
      
      // 4. Load track data
      await this.loadAndPlayTrack(item);
      
    } catch (error: any) {
      this.setStatus({ type: 'error', message: error.message });
    }
  }
  
  public pause(): void {
    if (!this.isPlaying) return;
    ttsService.pause();
    this.setStatus({ type: 'active', state: 'paused' });
    this.clearSleepTimer();
  }
  
  public resume(): void {
    const { status, playlist } = this.state;
    
    if (status.type === 'active' && status.state === 'paused') {
      ttsService.resume();
      this.setStatus({ type: 'active', state: 'playing' });
      this.startSleepTimer();
    } else if (status.type === 'idle' && playlist.length > 0) {
      const trackToPlay = this.currentTrack || playlist[0];
      const indexToPlay = this.currentTrack ? this.state.position.playlistIndex : 0;
      
      if (trackToPlay) {
          this.setPosition({ ...this.getInitialState().position, playlistIndex: indexToPlay });
          this.loadAndPlayTrack(trackToPlay);
      }
    }
  }
  
  public stop(): void {
    ttsService.cancel();
    this.clearCache();
    this.clearSleepTimer();
    this.setStatus({ type: 'idle' });
    this.setPosition({ playlistIndex: -1, chapterIndex: null, segmentIndex: 0, wordBoundary: null });
  }
  
  public skipForward(): void {
    if (!this.isActive) return;
    
    const nextIndex = this.state.position.segmentIndex + 1;
    if (nextIndex < this.segmentsCache.length) {
      this.seekToSegment(nextIndex);
    } else {
      this.nextChapter();
    }
  }
  
  public skipBackward(): void {
    if (!this.isActive) return;
    
    const prevIndex = Math.max(0, this.state.position.segmentIndex - 1);
    this.seekToSegment(prevIndex);
  }
  
  public seekToSegment(index: number): void {
    if (index < 0 || index >= this.segmentsCache.length) return;
    
    ttsService.cancel();
    this.updatePosition({ segmentIndex: index });
    this.speakCurrentSegment();
  }
  
  public nextTrack(): void {
    if (!this.canGoNext) {
      if (this.state.settings.repeat.playlist === 'all' && this.state.playlist.length > 0) {
        this.jumpToTrack(0);
      } else {
        this.stop();
      }
      return;
    }
    this.jumpToTrack(this.state.position.playlistIndex + 1);
  }
  
  public previousTrack(): void {
    if (!this.canGoPrevious) return;
    this.jumpToTrack(this.state.position.playlistIndex - 1);
  }
  
  public async jumpToTrack(playlistIndex: number): Promise<void> {
    const track = this.state.playlist[playlistIndex];
    if (!track) return;
    
    this.setPosition({
      playlistIndex,
      chapterIndex: track.type === 'book' ? 0 : null,
      segmentIndex: 0,
      wordBoundary: null,
    });
    
    await this.loadAndPlayTrack(track);
  }
  
  // ============================================
  // SETTINGS API
  // ============================================
  
  public setTtsRate(rate: number): void {
    this.updateSettings({
      tts: { ...this.state.settings.tts, rate }
    });
  }
  
  public setTtsPitch(pitch: number): void {
    this.updateSettings({
      tts: { ...this.state.settings.tts, pitch }
    });
  }
  
  public setVoiceForLanguage(lang: string, voiceURI: string): void {
    this.updateSettings({
      tts: {
        ...this.state.settings.tts,
        voicesByLanguage: {
          ...this.state.settings.tts.voicesByLanguage,
          [lang]: voiceURI,
        }
      }
    });
  }
  
  public setRepeatMode(mode: 'off' | 'item'): void {
    this.updateSettings({
      repeat: { ...this.state.settings.repeat, track: mode }
    });
  }
  
  public setPlaylistRepeatMode(mode: 'off' | 'all'): void {
    this.updateSettings({
      repeat: { ...this.state.settings.repeat, playlist: mode }
    });
  }
  
  public setSleepTimer(duration: number | null): void {
    this.clearSleepTimer();
    this.updateSettings({
      sleepTimer: {
        duration,
        startedAt: duration ? Date.now() : null,
      }
    });
    if (duration && this.isPlaying) {
      this.startSleepTimer();
    }
  }
  
  // ============================================
  // PLAYLIST API
  // ============================================
  
  public addToPlaylist(item: PlaylistItem): void {
    // Avoid adding duplicates, but ensure data is fresh
    this.ensureInPlaylist(item);
  }
  
  public removeFromPlaylist(itemId: string): void {
    const { playlist, position } = this.state;
    const itemIndexToRemove = playlist.findIndex(item => item.id === itemId);

    if (itemIndexToRemove === -1) return;

    const newPlaylist = playlist.filter(item => item.id !== itemId);
    
    if (position.playlistIndex === itemIndexToRemove) {
      // If removing the currently playing track
      this.stop();
      this.setState({ playlist: newPlaylist });
    } else if (position.playlistIndex > itemIndexToRemove) {
      // If removing a track before the current one
      this.setState({
        playlist: newPlaylist,
        position: { ...position, playlistIndex: position.playlistIndex - 1 }
      });
    } else {
      // If removing a track after the current one
      this.setState({ playlist: newPlaylist });
    }
  }
  
  public clearPlaylist(): void {
    this.stop();
    this.setState({ playlist: [] });
  }
  
  // ============================================
  // SUBSCRIPTION API
  // ============================================
  
  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.state); // Initial call
    return () => this.listeners.delete(listener);
  }
  
  public getState(): AudioEngineState {
    return this.state;
  }
  
  public setDependencies(deps: EngineDependencies): void {
    this.deps = { ...this.deps, ...deps };
  }
  
  // ============================================
  // COMPUTED PROPERTIES (Getters)
  // ============================================
  
  get currentTrack(): PlaylistItem | null {
    const { playlist, position } = this.state;
    if (position.playlistIndex === -1) return null;
    return playlist[position.playlistIndex] || null;
  }
  
  get isPlaying(): boolean {
    return this.state.status.type === 'active' && 
           this.state.status.state === 'playing';
  }
  
  get isPaused(): boolean {
    return this.state.status.type === 'active' && 
           this.state.status.state === 'paused';
  }
  
  get isActive(): boolean {
    return this.state.status.type === 'active';
  }
  
  get canGoNext(): boolean {
    return this.state.position.playlistIndex < this.state.playlist.length - 1;
  }
  
  get canGoPrevious(): boolean {
    return this.state.position.playlistIndex > 0;
  }
  
  get progress(): number {
    const track = this.currentTrack;
    if (!track || !this.bookStatsCache) return 0;
    
    const { position } = this.state;
    
    if (track.type === 'book' && position.chapterIndex !== null) {
      // Spoken segments so far in THIS chapter
      const spokenSegmentsInChapter = this.state.position.segmentIndex;
      
      // Total original segments up to the PREVIOUS chapter
      const originalSegmentsBefore = this.bookStatsCache.cumulativeOriginalSegments;

      // The correct number of spoken segments before this chapter starts
      const cumulativeSpokenSegmentsBefore = originalSegmentsBefore * this.currentPlaybackLanguages.length;

      // Total original segments in the WHOLE book
      const totalOriginalSegmentsInBook = this.bookStatsCache.totalSegmentsInBook;

      // Total spoken segments in the WHOLE book
      const totalSpokenSegmentsInBook = totalOriginalSegmentsInBook * this.currentPlaybackLanguages.length;
      
      if (totalSpokenSegmentsInBook === 0) return 0;
      
      const totalPlayedSoFar = cumulativeSpokenSegmentsBefore + spokenSegmentsInChapter;
      
      return (totalPlayedSoFar / totalSpokenSegmentsInBook) * 100;
    }
    
    if (this.segmentsCache.length > 0) {
      return ((position.segmentIndex + 1) / this.segmentsCache.length) * 100;
    }
    
    return 0;
  }
  
  get currentSegmentLanguage(): string | null {
    const segment = this.segmentsCache[this.state.position.segmentIndex];
    return segment?.lang || null;
  }
  
  get availableVoices(): SpeechSynthesisVoice[] {
    return getSystemVoices();
  }
  
  // ============================================
  // INTERNAL - State Management
  // ============================================
  
  private setState(updates: Partial<AudioEngineState>): void {
    this.state = { ...this.state, ...updates };
    this.notifyListeners();
    this.saveStateToStorage();
  }
  
  private setStatus(status: PlaybackStatus): void {
    this.setState({ status });
  }
  
  private setPosition(position: PlaybackPosition): void {
    this.setState({ position });
  }
  
  private updatePosition(updates: Partial<PlaybackPosition>): void {
    this.setPosition({ ...this.state.position, ...updates });
  }
  
  private updateSettings(updates: Partial<AudioSettings>): void {
    this.setState({
      settings: { ...this.state.settings, ...updates }
    });
  }
  
  private notifyListeners(): void {
    // Batch notifications to avoid excessive re-renders in React
    // Using a microtask to ensure all state updates in a single tick are processed
    Promise.resolve().then(() => {
        this.listeners.forEach(listener => listener(this.state));
    });
  }
  
  // ============================================
  // INTERNAL - Playback Logic
  // ============================================
  
  private async loadAndPlayTrack(item: PlaylistItem): Promise<void> {
    this.setStatus({ type: 'loading', trackId: item.id });
    
    try {
      // 1. Generate segments
      this.segmentsCache = await this.generateSegments(item);
      
      if (this.segmentsCache.length === 0) {
        throw new Error('No playable segments');
      }
      
      // 2. Calculate stats (for books)
      if (item.type === 'book' && item.data) {
        this.bookStatsCache = this.calculateBookStats(item.data as Book, this.state.position.chapterIndex ?? 0);
      }
      
      // 3. Validate position
      if (this.state.position.segmentIndex >= this.segmentsCache.length) {
        this.updatePosition({ segmentIndex: 0 });
      }
      
      // 4. Start playback
      this.setStatus({ type: 'active', state: 'playing' });
      this.speakCurrentSegment();
      this.startSleepTimer();
      
    } catch (error: any) {
      this.setStatus({ type: 'error', message: error.message });
    }
  }
  
  private speakCurrentSegment(): void {
    const segment = this.segmentsCache[this.state.position.segmentIndex];
    if (!segment) {
      this.onSegmentEnd();
      return;
    }
    
    const { tts } = this.state.settings;
    
    ttsService.speak({
      text: segment.text,
      lang: segment.lang,
      voiceURI: tts.voicesByLanguage[segment.lang] || null,
      rate: tts.rate,
      pitch: tts.pitch,
      onEnd: () => this.onSegmentEnd(),
      onBoundary: (event) => {
        this.updatePosition({
          wordBoundary: {
            charIndex: event.charIndex,
            charLength: event.charLength,
          }
        });
      },
      onError: (event) => {
        this.setStatus({
          type: 'error',
          message: event?.error || 'TTS failed'
        });
      }
    });
  }
  
  private onSegmentEnd(): void {
    this.updatePosition({ wordBoundary: null });

    // ✅ FIX: Correctly handle repeat mode
    if (this.state.settings.repeat.track === 'item') {
      this.speakCurrentSegment(); // Re-speak the current segment
      return;
    }

    const nextIndex = this.state.position.segmentIndex + 1;
    if (nextIndex < this.segmentsCache.length) {
      this.updatePosition({ segmentIndex: nextIndex });
      this.speakCurrentSegment();
    } else {
      this.nextChapter();
    }
  }
  
  private nextChapter(): void {
    const track = this.currentTrack;
    if (!track || track.type !== 'book' || !track.data) {
      this.nextTrack();
      return;
    }
    
    const { position } = this.state;
    const nextChapterIndex = (position.chapterIndex ?? 0) + 1;
    
    if (nextChapterIndex < ((track.data as Book).chapters?.length || 0)) {
      this.setPosition({
        ...position,
        chapterIndex: nextChapterIndex,
        segmentIndex: 0,
        wordBoundary: null,
      });
      this.loadAndPlayTrack(track);
    } else {
      this.nextTrack();
    }
  }
  
  // ============================================
  // INTERNAL - Data Generation
  // ============================================
  
  private async generateSegments(item: PlaylistItem): Promise<SpeechSegment[]> {
    if (item.type === 'book' && item.data) {
      return this.generateBookSegments(item.data as Book, this.state.position.chapterIndex ?? 0);
    }
    
    if (item.type === 'vocab') {
      return this.generateVocabSegments(item.id);
    }
    
    return [];
  }
  
  private generateBookSegments(book: Book, chapterIndex: number): SpeechSegment[] {
    const chapter = book.chapters?.[chapterIndex];
    if (!chapter?.segments) return [];
  
    const speechSegments: SpeechSegment[] = [];
  
    for (const seg of chapter.segments) {
      // Filter out languages not in the current playback selection
      const languagesToPlay = this.currentPlaybackLanguages.filter(lang => seg.content[lang]);
      
      for (const lang of languagesToPlay) {
        const text = seg.content[lang]?.trim();
        if (text) {
          speechSegments.push({
            text,
            lang,
            originalSegmentId: seg.id,
          });
        }
      }
    }
    return speechSegments;
  }
  
  private async generateVocabSegments(folderId: string): Promise<SpeechSegment[]> {
    if (!this.deps.user?.uid) return [];
    
    const items = await getVocabularyItemsByFolder(
      this.deps.user.uid,
      folderId
    );
    
    const speechSegments: SpeechSegment[] = [];

    for (const vocab of items) {
      if (vocab.term) {
        speechSegments.push({ text: vocab.term, lang: vocab.termLanguage, originalSegmentId: `${'${vocab.id}'}-term` });
      }
      if (vocab.meaning) {
        speechSegments.push({ text: vocab.meaning, lang: vocab.meaningLanguage, originalSegmentId: `${'${vocab.id}'}-meaning` });
      }
      if (vocab.example) {
        speechSegments.push({ text: vocab.example, lang: vocab.exampleLanguage || vocab.termLanguage, originalSegmentId: `${'${vocab.id}'}-example` });
      }
    }
    return speechSegments;
  }
  
  private calculateBookStats(book: Book, currentChapterIndex: number): BookCache {
    let totalSegmentsInBook = 0;
    let cumulativeOriginalSegments = 0;
    
    book.chapters?.forEach((chapter, index) => {
      const segmentCount = chapter.segments?.length || 0;
      totalSegmentsInBook += segmentCount;
      if (index < currentChapterIndex) {
        cumulativeOriginalSegments += segmentCount;
      }
    });

    const currentChapter = book.chapters?.[currentChapterIndex];
    // Correctly calculate spoken segments by accounting for multiple languages
    const totalSpokenSegmentsInChapter = (currentChapter?.segments?.length || 0) * this.currentPlaybackLanguages.length;
    
    return {
      totalSegmentsInBook,
      totalSpokenSegmentsInChapter,
      cumulativeOriginalSegments,
    };
  }
  
  // ============================================
  // INTERNAL - Helpers
  // ============================================
  
  private ensureInPlaylist(item: PlaylistItem): number {
    const existingIndex = this.state.playlist.findIndex(p => p.id === item.id);
    
    if (existingIndex !== -1) {
      // ✅ FIX: Update data if exists to ensure freshness
      const newPlaylist = [...this.state.playlist];
      newPlaylist[existingIndex] = item;
      this.setState({ playlist: newPlaylist });
      return existingIndex;
    }
    
    // Add to end
    const newPlaylist = [...this.state.playlist, item];
    this.setState({ playlist: newPlaylist });
    return newPlaylist.length - 1;
  }
  
  private clearCache(): void {
    this.segmentsCache = [];
    this.bookStatsCache = null;
    this.currentPlaybackLanguages = [];
  }
  
  private startSleepTimer(): void {
    this.clearSleepTimer();
    const { duration, startedAt } = this.state.settings.sleepTimer;
    
    if (!duration || !startedAt) return;
    
    const elapsed = Date.now() - startedAt;
    const remaining = duration * 60 * 1000 - elapsed;
    
    if (remaining > 0) {
      this.sleepTimer = setTimeout(() => {
        this.pause();
        this.updateSettings({
          sleepTimer: { duration: null, startedAt: null }
        });
        this.deps.toast?.({ title: this.deps.t?.('sleepTimer.ended') });
      }, remaining);
    }
  }
  
  private clearSleepTimer(): void {
    if (this.sleepTimer) {
      clearTimeout(this.sleepTimer);
      this.sleepTimer = null;
    }
  }
  
  // ============================================
  // PERSISTENCE
  // ============================================
  
  private getInitialState(): AudioEngineState {
    return {
      status: { type: 'idle' },
      playlist: [],
      position: {
        playlistIndex: -1,
        chapterIndex: null,
        segmentIndex: 0,
        wordBoundary: null,
      },
      settings: {
        tts: {
          rate: 1.0,
          pitch: 1.0,
          voicesByLanguage: {},
        },
        repeat: {
          track: 'off',
          playlist: 'off',
        },
        sleepTimer: {
          duration: null,
          startedAt: null,
        },
      },
    };
  }
  
  private saveStateToStorage(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const toSave = {
        playlist: this.state.playlist.map(item => ({ ...item, data: undefined })),
        settings: this.state.settings,
      };
      localStorage.setItem('audioEngineState', JSON.stringify(toSave));
    } catch (e) {
      console.warn('Failed to save state:', e);
    }
  }
  
  private loadStateFromStorage(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const saved = localStorage.getItem('audioEngineState');
      if (!saved) return;
      
      const parsed = JSON.parse(saved);

      // Deep merge settings to prevent wiping keys if the saved format is old
      const mergedSettings = {
        ...this.state.settings,
        ...(parsed.settings || {}),
        tts: {
            ...this.state.settings.tts,
            ...(parsed.settings?.tts || {}),
        },
        repeat: {
            ...this.state.settings.repeat,
            ...(parsed.settings?.repeat || {}),
        },
        sleepTimer: {
            ...this.state.settings.sleepTimer,
            ...(parsed.settings?.sleepTimer || {}),
        }
      };

      this.setState({
        playlist: parsed.playlist || [],
        settings: mergedSettings,
      });
    } catch (e) {
      console.warn('Failed to load state from storage:', e);
    }
  }
}

// Lazy-initialized singleton pattern
let instance: AudioEngine | null = null;
export const audioEngine = (): AudioEngine => {
    if (!instance) {
        instance = new AudioEngine();
    }
    return instance;
};
