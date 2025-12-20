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

const HISTORY_KEY = 'chirpter_shadowing_history_v2';
const TRANSCRIPT_CACHE_PREFIX = 'chirpter_transcript_cache_';
const MAX_HISTORY_SIZE = 3;

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

const saveTranscriptToCache = (videoId: string, data: TranscriptResult) => {
  if (typeof window === 'undefined') return;
  try {
    // 1. Clear all existing transcript caches to enforce single-item cache
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

// --- MAIN HOOK ---

export const useVideoHistory = () => {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Load history from localStorage on initial mount
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem(HISTORY_KEY);
      if (savedHistory) {
        const parsed = JSON.parse(savedHistory);
        if (Array.isArray(parsed)) {
            setHistory(parsed.slice(0, MAX_HISTORY_SIZE)); // Ensure limit on load
        }
      }
    } catch (e) {
      console.error('Failed to load video history', e);
    }
  }, []);

  const persistHistory = useCallback((nextHistory: HistoryItem[]) => {
    try {
      // Always store only the top N items
      const historyToSave = nextHistory.slice(0, MAX_HISTORY_SIZE);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(historyToSave));
    } catch (e) {
      console.error('Failed to persist history', e);
    }
  }, []);

  const addOrUpdateHistory = useCallback((item: Omit<HistoryItem, 'lastAccessed'>) => {
    const newItem: HistoryItem = {
        ...item,
        lastAccessed: Date.now(),
        progress: item.progress || [],
    };

    setHistory(prev => {
        // Remove existing item if it's already in the list
        const filtered = prev.filter(h => h.videoId !== item.videoId);
        
        // Add the new/updated item to the front
        const next = [newItem, ...filtered];
        
        // Enforce the size limit
        const finalHistory = next.slice(0, MAX_HISTORY_SIZE);

        persistHistory(finalHistory);
        return finalHistory;
    });
  }, [persistHistory]);

  const updateHistoryProgress = useCallback((videoId: string, progress: number[]) => {
    setHistory(prev => {
      const next = prev.map(h => 
        h.videoId === videoId 
          ? { ...h, progress, lastAccessed: Date.now() } 
          : h
      );
      // Sort by lastAccessed to ensure the most recently interacted item is first
      next.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
      persistHistory(next);
      return next;
    });
  }, [persistHistory]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    try { 
      localStorage.removeItem(HISTORY_KEY); 
      // Also clear all transcript caches
      Object.keys(localStorage)
          .filter(key => key.startsWith(TRANSCRIPT_CACHE_PREFIX))
          .forEach(key => localStorage.removeItem(key));
    } catch (e) { 
      console.error(e); 
    }
  }, []);

  const currentVideo = history.length > 0 ? history[0] : null;

  return { 
    history,
    currentVideo, // The most recent item is always the current one
    addOrUpdateHistory, 
    updateHistoryProgress, 
    clearHistory,
    getTranscriptFromCache,
    saveTranscriptToCache,
  };
};
