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
  PlaylistItem as TPlaylistItem,
  Book,
  ChapterTitle,
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
    itemToPlay: LibraryItem | TPlaylistItem,
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
  setRepeatMode: (mode: 'off' | 'one') => void;
  setPlaylistRepeatMode: (mode: 'off' | 'all') => void;
  setTtsRate: (rate: number) => void;
  setTtsPitch: (pitch: number) => void;
  setVoiceForLanguage: (langBcp47: string, voiceURI: string) => void;
  setSleepTimer: (duration: number | null) => void;

  // Computed State
  isPlaying: boolean;
  isPaused: boolean;
  isLoading: boolean;
  currentPlayingItem: TPlaylistItem | null;
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
  repeatMode: 'off' | 'one';
  playlistRepeatMode: 'off' | 'all';
}

const AudioPlayerContext = createContext<AudioPlayerContextType | undefined>(
  undefined
);

// ============================================
// HELPER FUNCTIONS
// ============================================

const ensurePlaylistItem = (item: LibraryItem | TPlaylistItem): TPlaylistItem => {
  if ('type' in item && item.type === 'book' && (item as any).data) {
    return item as TPlaylistItem;
  }
  if ('type' in item && item.type === 'vocab') {
    return item as TPlaylistItem;
  }
  
  const bookData = item as Book;
  
  let title: string;
  if (typeof bookData.title === 'string') {
    title = bookData.title;
  } else if (typeof bookData.title === 'object' && bookData.title !== null) {
    const primaryTitle = (bookData.title as ChapterTitle)[bookData.primaryLanguage] || 
                        (bookData.title as ChapterTitle).primary;
    title = primaryTitle || Object.values(bookData.title)[0] || 'Untitled Book';
  } else {
    title = 'Untitled Book';
  }

  return { 
    type: 'book', 
    id: item.id, 
    title: title, 
    data: bookData 
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

  // UI state (not managed by engine)
  const [playerState, setPlayerState] = useState<'expanded' | 'collapsed'>('collapsed');

  // Engine state (single source of truth)
  const [engineState, setEngineState] = useState<AudioEngineState>(
    audioEngine.getState()
  );

  // Subscribe to engine updates
  useEffect(() => {
    const unsubscribe = audioEngine.subscribe(setEngineState);
    return unsubscribe;
  }, []);

  // Provide dependencies to the engine
  useEffect(() => {
    audioEngine.setDependencies({ user, toast, t });
  }, [user, toast, t]);

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

    const currentPlayingItem =
      position.playlistIndex !== -1
        ? playlist[position.playlistIndex] || null
        : null;

    const isPlaying = status.type === 'active' && status.state === 'playing';
    const isPaused = status.type === 'active' && status.state === 'paused';
    const isLoading = status.type === 'loading';
    
    const canGoNext = position.playlistIndex < playlist.length - 1;
    const canGoPrevious = position.playlistIndex > 0;
    
    const overallProgressPercentage = audioEngine.progress;
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
      availableSystemVoices: audioEngine.availableVoices,
      currentSpokenSegmentLang: audioEngine.currentSegmentLanguage,
      currentSpeechBoundary: position.wordBoundary,
    };
  }, [engineState]);

  // ============================================
  // COMMAND FUNCTIONS (Delegate to engine)
  // ============================================

  const commands = useMemo(
    () => ({
      startPlayback: (
        itemToPlay: LibraryItem | TPlaylistItem,
        options?: { chapterIndex?: number; segmentIndex?: number }
      ) => {
        const playlistItem = ensurePlaylistItem(itemToPlay);
        audioEngine.play(playlistItem, options);
      },
      
      pauseAudio: () => audioEngine.pause(),
      
      resumeAudio: () => audioEngine.resume(),
      
      stopAudio: () => {
        audioEngine.stop();
        setPlayerState('collapsed');
      },
      
      skipToNextItem: () => audioEngine.nextTrack(),
      
      skipToPreviousItem: () => audioEngine.previousTrack(),
      
      seekToSegment: (index: number) => audioEngine.seekToSegment(index),
      
      skipForward: () => audioEngine.skipForward(),
      
      skipBackward: () => audioEngine.skipBackward(),
      
      replay: () => {
        audioEngine.seekToSegment(engineState.position.segmentIndex);
      },
      
      speakTextSnippet: (text: string, lang: string, onEnd?: () => void) => {
        // This is a standalone TTS call, not part of main playback
        // Implementation can be added if needed
        console.warn('speakTextSnippet: Not yet implemented in refactored engine');
      },
      
      addBookToPlaylist: (book: LibraryItem) => {
        const playlistItem = ensurePlaylistItem(book);
        audioEngine.addToPlaylist(playlistItem);
      },
      
      addVocabFolderToPlaylist: (folderId: string, folderName: string) => {
        audioEngine.addToPlaylist({ 
          type: 'vocab', 
          id: folderId, 
          title: folderName 
        });
      },
      
      playVocabFolder: (folderId: string, folderName: string) => {
        audioEngine.play({ 
          type: 'vocab', 
          id: folderId, 
          title: folderName 
        });
      },
      
      removePlaylistItem: (itemId: string) => {
        audioEngine.removeFromPlaylist(itemId);
      },
      
      clearPlaylist: () => {
        audioEngine.clearPlaylist();
        setPlayerState('collapsed');
      },
      
      setRepeatMode: (mode: 'off' | 'one') => audioEngine.setRepeatMode(mode),
      
      setPlaylistRepeatMode: (mode: 'off' | 'all') => audioEngine.setPlaylistRepeatMode(mode),
      
      setTtsRate: (rate: number) => audioEngine.setTtsRate(rate),
      
      setTtsPitch: (pitch: number) => audioEngine.setTtsPitch(pitch),
      
      setVoiceForLanguage: (lang: string, voiceURI: string) => 
        audioEngine.setVoiceForLanguage(lang, voiceURI),
      
      setSleepTimer: (duration: number | null) => audioEngine.setSleepTimer(duration),
    }),
    [engineState.position.segmentIndex]
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