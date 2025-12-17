// src/features/library/hooks/useItemCardProgress.ts

"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { AudioProgressState, Book, LibraryItem, Segment } from '@/lib/types';
import { useUser } from '@/contexts/user-context';

interface ProgressInfo {
    overallProgress: number;
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
        if (!item || !progress) {
            return { overallProgress: 0 };
        }
        
        // This logic is now greatly simplified because the `AudioEngine` is the single source of truth
        // for complex calculations. This hook just reads the final percentage.
        const totalSegments = item.content?.length || 0;
        if (totalSegments === 0) return { overallProgress: 0 };

        const overallProgress = (progress.segmentIndex / totalSegments) * 100;
        
        return {
            overallProgress,
        };

    }, [item, progress]);

    return calculatedProgress;
};
