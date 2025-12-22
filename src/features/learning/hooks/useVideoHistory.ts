// src/features/learning/hooks/useVideoHistory.ts

import { useState, useCallback, useEffect } from 'react';
import type { TranscriptResult } from '@/features/learning/services/shadowing-service';

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
const TRANSCRIPT_CACHE_KEY = 'chirpter_transcript_cache'; // ✅ Single cache key
const MAX_HISTORY_SIZE = 3;

// ✅ OPTIMIZED: Cache CHỈ 1 VIDEO FULL (priority 1)
const getTranscriptFromCache = (videoId: string): TranscriptResult | null => {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(TRANSCRIPT_CACHE_KEY);
    if (!cached) return null;
    
    const { id, data } = JSON.parse(cached);
    
    // Return data chỉ khi match videoId
    return id === videoId ? data : null;
  } catch (e) {
    console.error("Failed to read transcript cache", e);
    return null;
  }
};

// ✅ OPTIMIZED: Lưu transcript của video hiện tại (overwrite)
const saveTranscriptToCache = (videoId: string, data: TranscriptResult) => {
  if (typeof window === 'undefined') return;
  try {
    // Single cache entry - auto overwrite khi có video mới
    localStorage.setItem(TRANSCRIPT_CACHE_KEY, JSON.stringify({
      id: videoId,
      data,
      cachedAt: Date.now()
    }));
  } catch (e) {
    console.error("Failed to save transcript cache:", e);
  }
};

// ✅ OPTIMIZED: Clear cache khi cần
const clearTranscriptCache = () => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(TRANSCRIPT_CACHE_KEY);
  } catch (e) {
    console.error("Failed to clear cache", e);
  }
};

// --- MAIN HOOK ---

export const useVideoHistory = () => {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem(HISTORY_KEY);
      if (savedHistory) {
        const parsed = JSON.parse(savedHistory);
        if (Array.isArray(parsed)) {
          setHistory(parsed.slice(0, MAX_HISTORY_SIZE));
        }
      }
    } catch (e) {
      console.error('Failed to load video history', e);
    }
  }, []);

  const persistHistory = useCallback((nextHistory: HistoryItem[]) => {
    try {
      const historyToSave = nextHistory.slice(0, MAX_HISTORY_SIZE);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(historyToSave));
    } catch (e) {
      console.error('Failed to persist history', e);
    }
  }, []);

  // ✅ OPTIMIZED: Add/Update với cache priority logic
  const addOrUpdateHistory = useCallback((item: Omit<HistoryItem, 'lastAccessed'>) => {
    const newItem: HistoryItem = {
      ...item,
      lastAccessed: Date.now(),
      progress: item.progress || [],
    };

    setHistory(prev => {
      // Remove existing nếu có
      const filtered = prev.filter(h => h.videoId !== item.videoId);
      
      // Add to front (Priority 1)
      const next = [newItem, ...filtered];
      
      // Limit size
      const finalHistory = next.slice(0, MAX_HISTORY_SIZE);

      persistHistory(finalHistory);
      return finalHistory;
    });
  }, [persistHistory]);

  // ✅ OPTIMIZED: Update progress cho video đang xem
  const updateHistoryProgress = useCallback((videoId: string, progress: number[]) => {
    setHistory(prev => {
      const next = prev.map(h => 
        h.videoId === videoId 
          ? { ...h, progress, lastAccessed: Date.now() } 
          : h
      );
      // Sort by lastAccessed
      next.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
      persistHistory(next);
      return next;
    });
  }, [persistHistory]);

  // ✅ OPTIMIZED: Clear all
  const clearHistory = useCallback(() => {
    setHistory([]);
    try { 
      localStorage.removeItem(HISTORY_KEY);
      clearTranscriptCache(); // Clear transcript cache cùng lúc
    } catch (e) { 
      console.error(e); 
    }
  }, []);

  const currentVideo = history.length > 0 ? history[0] : null;

  return { 
    history,
    currentVideo, // Video đang xem (Priority 1)
    addOrUpdateHistory, 
    updateHistoryProgress, 
    clearHistory,
    getTranscriptFromCache,
    saveTranscriptToCache,
  };
};