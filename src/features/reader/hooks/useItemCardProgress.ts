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
        if (!item || item.type !== 'book' || !progress) {
            return { overallProgress: 0, chapterProgress: 0, chapterIndex: 0 };
        }
        
        const book = item as Book;
        const segments = book.generatedContent || [];
        if (segments.length === 0) {
            return { overallProgress: 0, chapterProgress: 0, chapterIndex: 0 };
        }

        const chapterHeadings = segments.map((seg, index) => ({ seg, index }))
                                     .filter(({ seg }) => typeof seg.content[0] === 'string' && seg.content[0].startsWith('#'));

        const chapterStartIndexMap = chapterHeadings.map(ch => ch.index);

        let chapterStartIndex = 0;
        let chapterEndIndex = segments.length - 1;
        let currentChapterIndex = 0;
        
        for (let i = 0; i < chapterStartIndexMap.length; i++) {
            if (progress.segmentIndex >= chapterStartIndexMap[i]) {
                currentChapterIndex = i;
                chapterStartIndex = chapterStartIndexMap[i];
                chapterEndIndex = (i + 1 < chapterStartIndexMap.length) ? chapterStartIndexMap[i + 1] - 1 : segments.length - 1;
            } else {
                break;
            }
        }
        
        const segmentsInCurrentChapter = chapterEndIndex - chapterStartIndex + 1;
        const segmentsPlayedInCurrentChapter = progress.segmentIndex - chapterStartIndex;

        const overallProgress = (progress.segmentIndex / segments.length) * 100;
        const chapterProgress = segmentsInCurrentChapter > 0 ? (segmentsPlayedInCurrentChapter / segmentsInCurrentChapter) * 100 : 0;
        
        return {
            overallProgress,
            chapterProgress,
            chapterIndex: currentChapterIndex,
        };

    }, [item, progress]);

    return calculatedProgress;
};
