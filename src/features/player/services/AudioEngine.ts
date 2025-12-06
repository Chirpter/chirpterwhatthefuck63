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
  PlaylistItem as TPlaylistItem,
  Book,
  Chapter,
  Segment,
} from '@/lib/types';
import * as ttsService from '@/services/tts-service';
import { getSystemVoices } from '@/services/tts-service';
import * as vocabService from '@/services/vocabulary-service';

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
    track: 'off' | 'one';
    playlist: 'off' | 'all';
  };
  sleepTimer: {
    duration: number | null;
    startedAt: number | null;
  };
}

export interface AudioEngineState {
  status: PlaybackStatus;
  playlist: TPlaylistItem[];
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
  totalSegments: number;
  segmentsPerChapter: number[];
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
    item: TPlaylistItem,
    options?: { chapterIndex?: number; segmentIndex?: number }
  ): Promise<void> {
    this.stop(); // Clean slate
    
    try {
      // 1. Add to playlist if needed
      const playlistIndex = this.ensureInPlaylist(item);
      
      // 2. Set position
      this.setPosition({
        playlistIndex,
        chapterIndex: options?.chapterIndex ?? (item.type === 'book' ? 0 : null),
        segmentIndex: options?.segmentIndex ?? 0,
        wordBoundary: null,
      });
      
      // 3. Load track data
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
  
  public setRepeatMode(mode: 'off' | 'one'): void {
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
  
  public addToPlaylist(item: TPlaylistItem): void {
    // Avoid adding duplicates
    if (this.state.playlist.some(p => p.id === item.id)) return;
    
    this.setState({
      playlist: [...this.state.playlist, item]
    });
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
  
  get currentTrack(): TPlaylistItem | null {
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
      const segmentsBefore = position.chapterIndex > 0 
        ? this.bookStatsCache.segmentsPerChapter[position.chapterIndex - 1] 
        : 0;
      const totalPlayed = segmentsBefore + position.segmentIndex;
      return (totalPlayed / this.bookStatsCache.totalSegments) * 100;
    }
    
    // Vocab progress
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
  
  private async loadAndPlayTrack(item: TPlaylistItem): Promise<void> {
    this.setStatus({ type: 'loading', trackId: item.id });
    
    try {
      // 1. Generate segments
      this.segmentsCache = await this.generateSegments(item);
      
      if (this.segmentsCache.length === 0) {
        throw new Error('No playable segments');
      }
      
      // 2. Calculate stats (for books)
      if (item.type === 'book' && item.data) {
        this.bookStatsCache = this.calculateBookStats(item.data);
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
      console.warn('No segment to speak');
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
    // Clear word boundary
    this.updatePosition({ wordBoundary: null });

    // If repeat is on, just replay the same segment
    if (this.state.settings.repeat.track === 'one') {
      this.speakCurrentSegment();
      return;
    }

    // Try to advance to the next segment
    const nextIndex = this.state.position.segmentIndex + 1;
    if (nextIndex < this.segmentsCache.length) {
      this.updatePosition({ segmentIndex: nextIndex });
      this.speakCurrentSegment();
    } else {
      // If no more segments, try to advance the chapter or track
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
    
    if (nextChapterIndex < track.data.chapters.length) {
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
  
  private async generateSegments(item: TPlaylistItem): Promise<SpeechSegment[]> {
    if (item.type === 'book' && item.data) {
      return this.generateBookSegments(item.data, this.state.position.chapterIndex ?? 0);
    }
    
    if (item.type === 'vocab') {
      return this.generateVocabSegments(item.id);
    }
    
    return [];
  }
  
  private generateBookSegments(book: Book, chapterIndex: number): SpeechSegment[] {
    const chapter = book.chapters[chapterIndex];
    if (!chapter?.segments) return [];
    
    return chapter.segments.flatMap(seg => {
      const segments: SpeechSegment[] = [];
      
      if (seg.content.primary) {
        segments.push({
          text: seg.content.primary,
          lang: book.primaryLanguage,
          originalSegmentId: seg.id,
        });
      }
      
      if (book.isBilingual && book.secondaryLanguage && seg.content.secondary) {
        segments.push({
          text: seg.content.secondary,
          lang: book.secondaryLanguage,
          originalSegmentId: seg.id,
        });
      }
      
      return segments;
    });
  }
  
  private async generateVocabSegments(folderId: string): Promise<SpeechSegment[]> {
    if (!this.deps.user) return [];
    
    const items = await vocabService.getVocabularyItemsByFolder(
      this.deps.user.uid,
      folderId
    );
    
    return items.flatMap(vocab => [
      { text: vocab.term, lang: vocab.termLanguage, originalSegmentId: `${'${vocab.id}'}-term` },
      { text: vocab.meaning, lang: vocab.meaningLanguage, originalSegmentId: `${'${vocab.id}'}-meaning` },
      ...(vocab.example ? [{
        text: vocab.example,
        lang: vocab.exampleLanguage || vocab.termLanguage,
        originalSegmentId: `${'${vocab.id}'}-example`
      }] : [])
    ]);
  }
  
  private calculateBookStats(book: Book): BookCache {
    const segmentsPerChapter: number[] = [];
    let totalSegments = 0;
    
    book.chapters.forEach(chapter => {
      const chapterSegmentCount = chapter.segments.reduce((count, seg) => {
        let segCount = seg.content.primary ? 1 : 0;
        if (book.isBilingual && seg.content.secondary) segCount++;
        return count + segCount;
      }, 0);
      
      totalSegments += chapterSegmentCount;
      segmentsPerChapter.push(totalSegments); // Cumulative
    });
    
    return { totalSegments, segmentsPerChapter };
  }
  
  // ============================================
  // INTERNAL - Helpers
  // ============================================
  
  private ensureInPlaylist(item: TPlaylistItem): number {
    const existingIndex = this.state.playlist.findIndex(p => p.id === item.id);
    
    if (existingIndex !== -1) {
      // Update data if exists
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
      this.setState({
        playlist: parsed.playlist || [],
        settings: parsed.settings || this.state.settings,
      });
    } catch (e) {
      console.warn('Failed to load state:', e);
    }
  }
}

// ============================================
// EXPORT SINGLETON
// ============================================

export const audioEngine = new AudioEngine();
