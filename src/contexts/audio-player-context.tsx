

'use client';

import React, {
  createContext,
  useState,
  useContext,
  ReactNode,
  useEffect,
  useMemo,
} from 'react';
import type {
  LibraryItem,
  PlaylistItem,
  Book,
  MultilingualContent,
  PlaylistRepeatMode,
  RepeatMode,
} from '@/lib/types';
import {
  audioEngine,
  type AudioEngineState,
} from '@/features/player/services/AudioEngine';
import { useUser } from './user-context';
import { useToast } from '@/hooks/useToast';
import { useTranslation } from 'react-i18next';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface AudioPlayerContextType extends AudioEngineState {
  // UI State (not in engine)
  playerState: 'expanded' | 'collapsed';
  setPlayerState: (state: 'expanded' | 'collapsed') => void;

  // Commands
  startPlayback: (
    itemToPlay: LibraryItem | PlaylistItem,
    options?: { chapterIndex?: number; segmentIndex?: number }
  ) => void;
  pauseAudio: () => void;
  resumeAudio: () => void;
  stopAudio: () => void;
  skipToNextItem: () => void;
  skipToPreviousItem: () => void;
  seekToSegment: (segmentIndex: number) => void;
  skipForward: () => void;
  skipBackward: () => void;
  replay: () => void;
  speakTextSnippet: (text: string, lang: string, onEnd?: () => void) => void;
  addBookToPlaylist: (book: LibraryItem) => void;
  addVocabFolderToPlaylist: (folderId: string, folderName: string) => void;
  playVocabFolder: (folderId: string, folderName: string) => void;
  removePlaylistItem: (itemIdToRemove: string) => void;
  clearPlaylist: () => void;

  // Settings
  setRepeatMode: (mode: 'off' | 'item') => void;
  setPlaylistRepeatMode: (mode: 'off' | 'all') => void;
  setTtsRate: (rate: number) => void;
  setTtsPitch: (pitch: number) => void;
  setVoiceForLanguage: (langBcp47: string, voiceURI: string) => void;
  setSleepTimer: (duration: number | null) => void;

  // Computed State
  isPlaying: boolean;
  isPaused: boolean;
  isLoading: boolean;
  // ✅ FIX: Renamed itemId to id for consistency with PlaylistItem type
  currentPlayingItem: (PlaylistItem & { originLanguages: string }) | null;
  overallProgressPercentage: number;
  chapterProgressPercentage: number;
  canGoNext: boolean;
  canGoPrevious: boolean;
  availableSystemVoices: SpeechSynthesisVoice[];
  currentSpokenSegmentLang: string | null;
  currentSpeechBoundary: { charIndex: number; charLength: number } | null;

  // Deprecated (for backwards compatibility)
  currentChapterDetails: any;
  ttsSettings: any;
  sleepTimerDuration: number | null;
  repeatMode: 'off' | 'item';
  playlistRepeatMode: 'off' | 'all';
}

const AudioPlayerContext = createContext<AudioPlayerContextType | undefined>(
  undefined
);

// ============================================
// HELPER FUNCTIONS
// ============================================

const ensurePlaylistItem = (item: LibraryItem | PlaylistItem): PlaylistItem => {
    if ('type' in item && (item.type === 'book' || item.type === 'vocab') && 'data' in item) {
      return item as PlaylistItem;
    }
    
    const bookData = item as Book;
    const [primaryLang] = (bookData.origin || 'en').split('-');
    
    let title: string;
    if (typeof bookData.title === 'string') {
      title = bookData.title;
    } else if (typeof bookData.title === 'object' && bookData.title !== null) {
      // Safely access primary language, providing fallbacks
      title = (bookData.title as MultilingualContent)[primaryLang] as string || 
              Object.values(bookData.title)[0] as string || 
              'Untitled Book';
    } else {
      title = 'Untitled Book';
    }
  
    return { 
      type: 'book', 
      id: item.id, 
      title: title, 
      data: bookData,
      origin: bookData.origin,
      availableLanguages: bookData.langs || [],
      primaryLanguage: primaryLang,
    };
  };

// ============================================
// PROVIDER COMPONENT
// ============================================

export const AudioPlayerProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { user } = useUser();
  const { toast } = useToast();
  const { t } = useTranslation(['playlist', 'common', 'toast']);
  const engine = audioEngine(); // Get the singleton instance

  // UI state (not managed by engine)
  const [playerState, setPlayerState] = useState<'expanded' | 'collapsed'>('collapsed');

  // Engine state (single source of truth)
  const [engineState, setEngineState] = useState<AudioEngineState>(
    engine.getState()
  );

  // Subscribe to engine updates
  useEffect(() => {
    const unsubscribe = engine.subscribe(setEngineState);
    return unsubscribe;
  }, [engine]);

  // Provide dependencies to the engine
  useEffect(() => {
    engine.setDependencies({ user, toast, t });
  }, [user, toast, t, engine]);

  // Auto-expand player when playback starts
  useEffect(() => {
    if (engineState.status.type === 'active' && playerState === 'collapsed') {
      setPlayerState('expanded');
    }
  }, [engineState.status.type, playerState]);

  // ============================================
  // DERIVED STATE (Memoized for performance)
  // ============================================

  const derivedState = useMemo(() => {
    const { status, playlist, position } = engineState;

    const rawCurrentItem =
      position.playlistIndex !== -1
        ? playlist[position.playlistIndex] || null
        : null;

    // ✅ FIX: Ensure originLanguages always has a valid fallback value ('en').
    const currentPlayingItem = rawCurrentItem ? {
        ...rawCurrentItem,
        originLanguages: rawCurrentItem.origin || rawCurrentItem.primaryLanguage || 'en',
    } : null;

    const isPlaying = status.type === 'active' && status.state === 'playing';
    const isPaused = status.type === 'active' && status.state === 'paused';
    const isLoading = status.type === 'loading';
    
    const canGoNext = position.playlistIndex < playlist.length - 1;
    const canGoPrevious = position.playlistIndex > 0;
    
    const overallProgressPercentage = engine.progress;
    const chapterProgressPercentage = 0; // Simplified

    return {
      isPlaying,
      isPaused,
      isLoading,
      currentPlayingItem,
      canGoNext,
      canGoPrevious,
      overallProgressPercentage,
      chapterProgressPercentage,
      availableSystemVoices: engine.availableVoices,
      currentSpokenSegmentLang: engine.currentSegmentLanguage,
      currentSpeechBoundary: position.wordBoundary,
    };
  }, [engineState, engine]);

  // ============================================
  // COMMAND FUNCTIONS (Delegate to engine)
  // ============================================

  const commands = useMemo(
    () => ({
      startPlayback: (
        itemToPlay: LibraryItem | PlaylistItem,
        options?: { chapterIndex?: number; segmentIndex?: number }
      ) => {
        const playlistItem = ensurePlaylistItem(itemToPlay);
        engine.play(playlistItem, options);
      },
      
      pauseAudio: () => engine.pause(),
      
      resumeAudio: () => engine.resume(),
      
      stopAudio: () => {
        engine.stop();
        setPlayerState('collapsed');
      },
      
      skipToNextItem: () => engine.nextTrack(),
      
      skipToPreviousItem: () => engine.previousTrack(),
      
      seekToSegment: (index: number) => engine.seekToSegment(index),
      
      skipForward: () => engine.skipForward(),
      
      skipBackward: () => engine.skipBackward(),
      
      replay: () => {
        engine.seekToSegment(engineState.position.segmentIndex);
      },
      
      speakTextSnippet: (text: string, lang: string, onEnd?: () => void) => {
        // This is a standalone TTS call, not part of main playback
        // Implementation can be added if needed
        console.warn('speakTextSnippet: Not yet implemented in refactored engine');
      },
      
      addBookToPlaylist: (book: LibraryItem) => {
        const playlistItem = ensurePlaylistItem(book);
        engine.addToPlaylist(playlistItem);
      },
      
      addVocabFolderToPlaylist: (folderId: string, folderName: string) => {
        engine.addToPlaylist({ 
          type: 'vocab', 
          id: folderId, 
          title: folderName,
          data: {},
          primaryLanguage: 'en', // default, vocab engine will determine actual
          availableLanguages: [],
        });
      },
      
      playVocabFolder: (folderId: string, folderName: string) => {
        engine.play({ 
          type: 'vocab', 
          id: folderId, 
          title: folderName,
          data: {},
          primaryLanguage: 'en', // default
          availableLanguages: [],
        });
      },
      
      removePlaylistItem: (itemId: string) => {
        engine.removeFromPlaylist(itemId);
      },
      
      clearPlaylist: () => {
        engine.clearPlaylist();
        setPlayerState('collapsed');
      },
      
      setRepeatMode: (mode: 'off' | 'item') => engine.setRepeatMode(mode),
      
      setPlaylistRepeatMode: (mode: 'off' | 'all') => engine.setPlaylistRepeatMode(mode),
      
      setTtsRate: (rate: number) => engine.setTtsRate(rate),
      
      setTtsPitch: (pitch: number) => engine.setTtsPitch(pitch),
      
      setVoiceForLanguage: (lang: string, voiceURI: string) => 
        engine.setVoiceForLanguage(lang, voiceURI),
      
      setSleepTimer: (duration: number | null) => engine.setSleepTimer(duration),
    }),
    [engineState.position.segmentIndex, engine]
  );

  // ============================================
  // PROVIDER VALUE (Complete context API)
  // ============================================

  const providerValue = useMemo(
    (): AudioPlayerContextType => ({
      // Engine state
      ...engineState,
      
      // UI state
      playerState,
      setPlayerState,
      
      // Derived state
      ...derivedState,
      
      // Commands
      ...commands,
      
      // Deprecated fields (for backwards compatibility)
      currentChapterDetails: null,
      ttsSettings: engineState.settings.tts,
      sleepTimerDuration: engineState.settings.sleepTimer.duration,
      repeatMode: engineState.settings.repeat.track,
      playlistRepeatMode: engineState.settings.repeat.playlist,
    }),
    [engineState, derivedState, commands, playerState]
  );

  return (
    <AudioPlayerContext.Provider value={providerValue}>
      {children}
    </AudioPlayerContext.Provider>
  );
};

// ============================================
// HOOK
// ============================================

export const useAudioPlayer = (): AudioPlayerContextType => {
  const context = useContext(AudioPlayerContext);
  if (context === undefined) {
    throw new Error('useAudioPlayer must be used within an AudioPlayerProvider');
  }
  return context;
};
