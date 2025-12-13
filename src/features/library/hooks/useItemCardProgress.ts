// src/features/library/hooks/useItemCardProgress.ts

"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { AudioProgressState, Book, LibraryItem } from '@/lib/types';
import { useUser } from '@/contexts/user-context';

interface ProgressInfo {
    overallProgress: number;
    chapterProgress: number;
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
            return { overallProgress: 0, chapterProgress: 0, chapterIndex: 0 };
        }
        
        const book = item as Book;
        const chapters = book.chapters || [];
        if (chapters.length === 0) {
            return { overallProgress: 0, chapterProgress: 0, chapterIndex: 0 };
        }

        let totalSegmentsInBook = 0;
        let segmentsPlayedSoFar = 0;
        let segmentsInCurrentChapter = 0;
        
        // This logic now correctly reflects the flat segment structure per chapter
        chapters.forEach((chapter, index) => {
            const chapterSegmentCount = chapter.segments?.length || 0;
            totalSegmentsInBook += chapterSegmentCount;
            
            if (index < progress.chapterIndex) {
                segmentsPlayedSoFar += chapterSegmentCount;
            }
            if (index === progress.chapterIndex) {
                segmentsInCurrentChapter = chapterSegmentCount;
            }
        });
        
        if (totalSegmentsInBook === 0) {
            return { overallProgress: 0, chapterProgress: 0, chapterIndex: progress.chapterIndex };
        }

        segmentsPlayedSoFar += progress.segmentIndex;

        const overallProgress = (segmentsPlayedSoFar / totalSegmentsInBook) * 100;
        const chapterProgress = segmentsInCurrentChapter > 0 ? (progress.segmentIndex / segmentsInCurrentChapter) * 100 : 0;
        
        return {
            overallProgress,
            chapterProgress,
            chapterIndex: progress.chapterIndex,
        };

    }, [item, progress]);

    return calculatedProgress;
};
