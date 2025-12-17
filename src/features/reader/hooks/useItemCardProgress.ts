// src/features/library/hooks/useItemCardProgress.ts

"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { AudioProgressState, Book, LibraryItem, Segment } from '@/lib/types';
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
        // Guard against missing data
        if (!item || item.type !== 'book' || !progress || !Array.isArray(item.content)) {
            return { overallProgress: 0, chapterProgress: 0, chapterIndex: 0 };
        }
        
        const book = item as Book;
        const allSegments = book.content as Segment[];
        if (allSegments.length === 0) {
            return { overallProgress: 0, chapterProgress: 0, chapterIndex: 0 };
        }

        // Reconstruct chapter boundaries on the fly
        const chapters: Segment[][] = [];
        let currentChapter: Segment[] = [];
        allSegments.forEach(seg => {
            if (seg.type === 'heading1' && currentChapter.length > 0) {
                chapters.push(currentChapter);
                currentChapter = [];
            }
            currentChapter.push(seg);
        });
        if (currentChapter.length > 0) {
            chapters.push(currentChapter);
        }

        const chapterIndex = progress.chapterIndex;
        // Ensure chapterIndex from progress is valid
        if (chapterIndex >= chapters.length) {
             return { overallProgress: 0, chapterProgress: 0, chapterIndex: 0 };
        }
        
        let totalSegmentsInBook = allSegments.length;
        let segmentsPlayedSoFar = 0;
        
        // Sum segments from previous chapters
        for (let i = 0; i < chapterIndex; i++) {
            segmentsPlayedSoFar += chapters[i].length;
        }
        // Add segments from the current chapter
        segmentsPlayedSoFar += progress.segmentIndex;

        const segmentsInCurrentChapter = chapters[chapterIndex].length;

        // Calculate percentages
        const overallProgress = totalSegmentsInBook > 0 ? (segmentsPlayedSoFar / totalSegmentsInBook) * 100 : 0;
        const chapterProgress = segmentsInCurrentChapter > 0 ? (progress.segmentIndex / segmentsInCurrentChapter) * 100 : 0;
        
        return {
            overallProgress,
            chapterProgress,
            chapterIndex: progress.chapterIndex,
        };

    }, [item, progress]);

    return calculatedProgress;
};
