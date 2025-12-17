// src/features/library/hooks/useItemCardProgress.ts

"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { AudioProgressState, Book, LibraryItem, Segment } from '@/lib/types';
import { useUser } from '@/contexts/user-context';

interface ProgressInfo {
    overallProgress: number;
    chapterIndex: number;
}

export const useItemCardProgress = (itemId: string | null, item: LibraryItem | null): ProgressInfo => {
    const { user } = useUser();
    const [progress, setProgress] = useState<AudioProgressState | null>(null);

    const getProgressFromStorage = useCallback(() => {
        if (!user || !itemId) return null;
        const progressKey = `chirpter_progress_${itemId}_${user.uid}`;
        try {
            const savedProgressStr = localStorage.getItem(progressKey);
            if (savedProgressStr) {
                const bookProgress = JSON.parse(savedProgressStr);
                return bookProgress.audio || null;
            }
        } catch (e) {
            console.warn("Could not parse saved progress for book card:", e);
        }
        return null;
    }, [user, itemId]);

    // Effect for initial load and to listen for cross-tab storage changes
    useEffect(() => {
        setProgress(getProgressFromStorage());
        
        const handleStorageChange = (event: StorageEvent) => {
            if (!user || !itemId) return;
            const progressKey = `chirpter_progress_${itemId}_${user.uid}`;
            if (event.key === progressKey) {
                setProgress(getProgressFromStorage());
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, [itemId, user, getProgressFromStorage]);
    
    // Effect to listen for same-tab custom events
    useEffect(() => {
        const handleProgressUpdate = (event: Event) => {
            const detail = (event as CustomEvent).detail;
            if (detail.bookId === itemId) {
                setProgress(detail.progress);
            }
        };

        window.addEventListener('audioprogressupdate', handleProgressUpdate);
        return () => window.removeEventListener('audioprogressupdate', handleProgressUpdate);
    }, [itemId]);
    
    const calculatedProgress = useMemo((): ProgressInfo => {
        if (!item || item.type !== 'book' || !progress) {
            return { overallProgress: 0, chapterIndex: 0 };
        }
        
        const book = item as Book;
        const segments = book.content || [];
        if (segments.length === 0) {
            return { overallProgress: 0, chapterIndex: 0 };
        }

        // This is simplified. For the audio engine, the `segmentIndex` would refer to the index
        // in the flattened, multi-lingual `speechSegments` array, not the original `content` array.
        // A more accurate progress would require a more complex mapping.
        // For now, we assume a rough 1-to-1 mapping for display purposes.
        const overallProgress = (progress.segmentIndex / segments.length) * 100;
        
        return {
            overallProgress,
            chapterIndex: 0, // Simplified, as we no longer have chapterIndex in audio progress state
        };

    }, [item, progress]);

    return calculatedProgress;
};
