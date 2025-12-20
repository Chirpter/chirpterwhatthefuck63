// src/features/learning/hooks/useVideoHistory.ts

import { useState, useCallback, useEffect } from 'react';
import type { TranscriptResult } from '@/services/server/shadowing-service';

export interface HistoryItem {
  videoId: string;
  url: string;
  title: string;
  thumbnail?: string;
  totalLines?: number;
  progress?: number[];
  lastAccessed?: number;
}

const HISTORY_KEY = 'chirpter_shadowing_history';
const CURRENT_VIDEO_KEY = 'chirpter_shadowing_current_video';
const TRANSCRIPT_CACHE_PREFIX = 'chirpter_transcript_cache_';

// --- CACHE MANAGEMENT ---

const getTranscriptFromCache = (videoId: string): TranscriptResult | null => {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(`${TRANSCRIPT_CACHE_PREFIX}${videoId}`);
    return cached ? JSON.parse(cached) : null;
  } catch (e) {
    console.error("Failed to read from transcript cache", e);
    return null;
  }
};

/**
 * Saves a single transcript to the cache, clearing all previous ones first.
 * @param videoId The ID of the video for the new transcript.
 * @param data The transcript data to save.
 */
const saveTranscriptToCache = (videoId: string, data: TranscriptResult) => {
  if (typeof window === 'undefined') return;
  try {
    // 1. Clear all existing transcript caches
    Object.keys(localStorage)
      .filter(key => key.startsWith(TRANSCRIPT_CACHE_PREFIX))
      .forEach(key => localStorage.removeItem(key));
      
    // 2. Save the new transcript
    const newKey = `${TRANSCRIPT_CACHE_PREFIX}${videoId}`;
    localStorage.setItem(newKey, JSON.stringify(data));

  } catch (e) {
    console.error("Failed to save to transcript cache:", e);
  }
};


export const useVideoHistory = () => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [currentVideo, setCurrentVideo] = useState<HistoryItem | null>(null);

  // Load history and current video from localStorage on initial mount
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem(HISTORY_KEY);
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }
      
      const savedCurrent = localStorage.getItem(CURRENT_VIDEO_KEY);
      if (savedCurrent) {
        setCurrentVideo(JSON.parse(savedCurrent));
      }
    } catch (e) {
      console.error('Failed to load video history', e);
    }
  }, []);

  const persistHistory = useCallback((nextHistory: HistoryItem[]) => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
    } catch (e) {
      console.error('Failed to persist history', e);
    }
  }, []);

  const persistCurrentVideo = useCallback((video: HistoryItem | null) => {
    try {
      if (video) {
        localStorage.setItem(CURRENT_VIDEO_KEY, JSON.stringify(video));
      } else {
        localStorage.removeItem(CURRENT_VIDEO_KEY);
      }
    } catch (e) {
      console.error('Failed to persist current video', e);
    }
  }, []);


  const addToHistory = useCallback((item: Omit<HistoryItem, 'lastAccessed'>) => {
    const newItem: HistoryItem = {
        ...item,
        progress: [],
        lastAccessed: Date.now(),
    };

    setHistory(prev => {
        const next = [newItem, ...prev.filter(h => h.videoId !== item.videoId)];
        persistHistory(next);
        return next;
    });

    setCurrentVideo(newItem);
    persistCurrentVideo(newItem);
  }, [persistHistory, persistCurrentVideo]);


  const updateHistoryProgress = useCallback((videoId: string, progress: number[]) => {
    setHistory(prev => {
      const next = prev.map(h => 
        h.videoId === videoId 
          ? { ...h, progress, lastAccessed: Date.now() } 
          : h
      );
      persistHistory(next);
      return next;
    });
  }, [persistHistory]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    setCurrentVideo(null); // Also clear the current video
    try { 
      localStorage.removeItem(HISTORY_KEY); 
      localStorage.removeItem(CURRENT_VIDEO_KEY);
      // Also clear all transcript caches
      Object.keys(localStorage)
          .filter(key => key.startsWith(TRANSCRIPT_CACHE_PREFIX))
          .forEach(key => localStorage.removeItem(key));
    } catch (e) { 
      console.error(e); 
    }
  }, []);

  return { 
    history, 
    currentVideo,
    setCurrentVideo: (item: HistoryItem | null) => {
        setCurrentVideo(item);
        persistCurrentVideo(item);
    },
    addToHistory, 
    updateHistoryProgress, 
    clearHistory,
    getTranscriptFromCache,
    saveTranscriptToCache
  };
};
