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
const MAX_HISTORY_SIZE = 6;

export const useVideoHistory = () => {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      if (saved) setHistory(JSON.parse(saved));
    } catch (e) {
      console.error('Failed to load shadowing history', e);
    }
  }, []);

  const persist = useCallback((next: HistoryItem[]) => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch (e) {
      console.error('Failed to persist shadowing history', e);
    }
  }, []);

  const addToHistory = useCallback((item: Omit<HistoryItem, 'lastAccessed'>) => {
    setHistory(prev => {
      const existing = prev.find(h => h.videoId === item.videoId);
      const newItem: HistoryItem = {
        ...item,
        // ✅ FIX: Ensure progress is always an array, never undefined
        progress: existing?.progress ?? item.progress ?? [],
        lastAccessed: Date.now(),
      };

      const next = [newItem, ...prev.filter(h => h.videoId !== item.videoId)].slice(0, MAX_HISTORY_SIZE);
      persist(next);
      return next;
    });
  }, [persist]);

  const updateHistoryProgress = useCallback((videoId: string, progress: number[]) => {
    setHistory(prev => {
      const next = prev.map(h => h.videoId === videoId ? { ...h, progress, lastAccessed: Date.now() } : h);
      persist(next);
      return next;
    });
  }, [persist]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    try { 
      localStorage.removeItem(HISTORY_KEY); 
    } catch (e) { 
      console.error(e); 
    }
  }, []);

  return { 
    history, 
    addToHistory, 
    updateHistoryProgress, 
    clearHistory 
  };
};
