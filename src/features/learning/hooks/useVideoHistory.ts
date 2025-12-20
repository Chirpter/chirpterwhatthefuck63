// src/features/learning/hooks/shadowing/useVideoHistory.ts

import { useState, useCallback, useEffect } from 'react';

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
const MAX_HISTORY_SIZE = 6;

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
        const next = [newItem, ...prev.filter(h => h.videoId !== item.videoId)].slice(0, MAX_HISTORY_SIZE);
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
    clearHistory 
  };
};
