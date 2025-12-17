// src/features/library/hooks/useItemCardProgress.ts

"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { AudioProgressState, Book, LibraryItem } from '@/lib/types';
import { useUser } from '@/contexts/user-context';
import { parseMarkdownToSegments } from '@/services/shared/SegmentParser';

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
        if (!item || item.type !== 'book' || !progress || !item.content) {
            return { overallProgress: 0, chapterProgress: 0, chapterIndex: 0 };
        }
        
        const book = item as Book;
        const allSegments = parseMarkdownToSegments(book.content, book.origin, book.unit);
        
        // This is a simplified calculation. A more accurate one would need to know
        // which segments belong to which chapter. For now, we assume a flat structure for progress.
        const totalSegmentsInBook = allSegments.length;
        if (totalSegmentsInBook === 0) {
             return { overallProgress: 0, chapterProgress: 0, chapterIndex: 0 };
        }
        
        // This logic is a placeholder and needs to be refined based on how TTS engine reports progress
        // against the new flat segment structure. For now, it will likely be inaccurate.
        const segmentsPlayedSoFar = progress.segmentIndex;
        const overallProgress = (segmentsPlayedSoFar / totalSegmentsInBook) * 100;
        
        return {
            overallProgress,
            chapterProgress: 0, // Placeholder
            chapterIndex: progress.chapterIndex,
        };

    }, [item, progress]);

    return calculatedProgress;
};
