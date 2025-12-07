
"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/useToast';
import { type LibraryItem, type FoundClip, type Piece, ApiServiceError } from '@/lib/types';
import { searchClipsPaged } from '@/features/learning/services/vocab-videos.service';

interface LookupState {
  isOpen: boolean;
  text: string;
  rect: DOMRect | null;
  sourceLang: string;
  targetLanguage: string;
  sourceItem: LibraryItem | null;
  sentenceContext: string;
  context: "vocab-videos";
}

export const useVocabVideos = () => {
    const { user } = useAuth();
    const { t } = useTranslation(['learningPage', 'common', 'toast']);
    const { toast } = useToast();

    // Core state
    const [query, setQueryState] = useState('');
    const [clips, setClips] = useState<FoundClip[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isAutoSkipping, setIsAutoSkipping] = useState(true);
    const [repeatCount, setRepeatCount] = useState(0);

    const [lookupState, setLookupState] = useState<LookupState>({
        isOpen: false, 
        text: '', 
        rect: null, 
        sourceLang: 'en', 
        targetLanguage: 'en', 
        sourceItem: null, 
        sentenceContext: '', 
        context: 'vocab-videos'
    });

    // Refs for async operations and transitions
    const searchAbortControllerRef = useRef<AbortController | null>(null);
    const isTransitioningRef = useRef(false);
    const autoSkipTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    
    const replayTriggerRef = useRef<(() => void) | null>(null);
    
    const isProUser = useMemo(() => user?.plan === 'pro', [user?.plan]);
    const isRepeating = useMemo(() => repeatCount > 0, [repeatCount]);
    const selectedResult = useMemo(() => clips[selectedIndex] || null, [clips, selectedIndex]);

    const getErrorMessage = useCallback((error: ApiServiceError, searchTerm: string) => {
        switch (error.code) {
            case 'RATE_LIMIT':
                return t('vocabVideos.rateLimitError', { 
                    defaultValue: 'Daily search limit reached (20 searches/day). Try again tomorrow.' 
                });
            case 'AUTH':
                return t('toast:authErrorDesc', { 
                    defaultValue: 'Please sign in to search.' 
                });
            case 'NETWORK':
                return t('vocabVideos.networkError', { 
                    defaultValue: 'Network error. Check your connection.' 
                });
            default:
                return t('vocabVideos.searchError', { 
                    defaultValue: 'Search failed. Please try again.' 
                });
        }
    }, [t]);

    const clearPendingTimeouts = useCallback(() => {
        if (autoSkipTimeoutRef.current) {
            clearTimeout(autoSkipTimeoutRef.current);
            autoSkipTimeoutRef.current = null;
        }
    }, []);

    const clearSearch = useCallback(() => {
      clearPendingTimeouts();
      if (searchAbortControllerRef.current) {
        searchAbortControllerRef.current.abort();
      }
      setClips([]);
      setSelectedIndex(-1);
      setError(null);
      setIsLoading(false);
      setRepeatCount(0);
      setQueryState('');
    }, [clearPendingTimeouts]);

    const handleSearch = useCallback(async (searchQuery: string) => {
        if (!user) {
            toast({ 
                title: t('toast:authErrorTitle'), 
                description: t('toast:authErrorDesc'), 
                variant: 'destructive' 
            });
            return;
        }

        const trimmedQuery = searchQuery.trim();
        if (!trimmedQuery) {
            return;
        }
        
        clearSearch(); // Clear previous state before starting new search
        
        const abortController = new AbortController();
        searchAbortControllerRef.current = abortController;
        
        setIsLoading(true);
        setQueryState(trimmedQuery);

        try {
            const results = await searchClipsPaged(
                trimmedQuery, 
                user.uid, 
                isProUser ? 30 : 5
            );
            
            if (!abortController.signal.aborted) {
                if (results.length > 0) {
                    setClips(results);
                    setSelectedIndex(0);
                } else {
                    const noResultsMsg = t('vocabVideos.noClipsFound', { 
                        term: trimmedQuery,
                        defaultValue: `No clips found for "${trimmedQuery}"` 
                    });
                    setError(noResultsMsg);
                }
            }
        } catch (err) {
            if (!abortController.signal.aborted) {
                const errorMessage = err instanceof ApiServiceError 
                    ? getErrorMessage(err, trimmedQuery)
                    : (err instanceof Error ? err.message : t('vocabVideos.searchError', { defaultValue: 'Search failed' }));
                
                setError(errorMessage);
                
                if (err instanceof ApiServiceError && err.code === 'RATE_LIMIT') {
                    toast({
                        title: t('toast:rateLimitTitle', { defaultValue: 'Rate Limit' }),
                        description: errorMessage,
                        variant: 'destructive'
                    });
                }
            }
        } finally {
            if (!abortController.signal.aborted) {
                setIsLoading(false);
            }
        }
    }, [user, toast, t, isProUser, getErrorMessage, clearSearch]);

    const goToClip = useCallback((index: number) => {
        if (clips.length === 0 || isTransitioningRef.current) {
            return;
        }
        
        const newIndex = Math.max(0, Math.min(index, clips.length - 1));
        
        if (newIndex !== selectedIndex) {
            clearPendingTimeouts();
            isTransitioningRef.current = true;
            setSelectedIndex(newIndex);
            setRepeatCount(0);
            
            setTimeout(() => {
                isTransitioningRef.current = false;
            }, 150);
        }
    }, [clips.length, selectedIndex, clearPendingTimeouts]);

    const handleNext = useCallback(() => {
        if (selectedIndex < clips.length - 1) {
            goToClip(selectedIndex + 1);
        }
    }, [selectedIndex, clips.length, goToClip]);

    const handlePrevious = useCallback(() => {
        if (selectedIndex > 0) {
            goToClip(selectedIndex - 1);
        }
    }, [selectedIndex, goToClip]);

    const handleReplay = useCallback(() => {
        clearPendingTimeouts();
        
        if (isRepeating) {
            setRepeatCount(0);
        } else {
            setRepeatCount(3);
            if (replayTriggerRef.current) {
                replayTriggerRef.current();
            }
        }
    }, [isRepeating, clearPendingTimeouts]);

    const handleVideoEnd = useCallback(() => {
        clearPendingTimeouts();
        
        if (repeatCount > 1) {
            setRepeatCount(prev => prev - 1);
            if (replayTriggerRef.current) {
                replayTriggerRef.current();
            }
            return;
        } else if (repeatCount === 1) {
            setRepeatCount(0);
        }
        
        if (isAutoSkipping && selectedIndex < clips.length - 1 && !isTransitioningRef.current) {
            autoSkipTimeoutRef.current = setTimeout(() => {
                handleNext();
            }, 250);
        }
    }, [repeatCount, isAutoSkipping, selectedIndex, clips.length, handleNext, clearPendingTimeouts]);

    const handleTextSelection = useCallback((event: React.MouseEvent<HTMLDivElement>, sourceItem: LibraryItem, sentenceContext: string) => {
        if (lookupState.isOpen) {
            setLookupState(prev => ({ ...prev, isOpen: false }));
            return;
        }

        const selection = window.getSelection();
        const selectedText = selection?.toString().trim() ?? '';

        if (!selectedText || selectedText.length > 150 || !selection || !sourceItem) {
            return;
        }

        try {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            
            setLookupState({ 
                isOpen: true, 
                text: selectedText, 
                rect, 
                sourceLang: 'en', // Assuming English for now
                targetLanguage: 'en', // This will be set by i18n
                sourceItem: sourceItem,
                sentenceContext,
                context: 'vocab-videos',
            });
        } catch (error) {
            console.error('[Selection] Error:', error);
        }
    }, [lookupState.isOpen]);


    const closeLookup = useCallback(() => {
        setLookupState(prev => ({ ...prev, isOpen: false }));
    }, []);

    const setQuery = useCallback((newQuery: string) => {
        setQueryState(newQuery);
    }, []);

    const jumpToClip = useCallback((videoId: string, startTime: number) => {
        const index = clips.findIndex(
            c => c.videoId === videoId && Math.abs(c.start - startTime) < 1
        );
        
        if (index >= 0) {
            goToClip(index);
        }
    }, [clips, goToClip]);

    const registerReplayTrigger = useCallback((trigger: () => void) => {
        replayTriggerRef.current = trigger;
    }, []);

    useEffect(() => {
        return () => {
            searchAbortControllerRef.current?.abort();
            clearPendingTimeouts();
        };
    }, [clearPendingTimeouts]);

    return {
        query,
        clips,
        selectedIndex,
        isLoading,
        error,
        isAutoSkipping,
        setIsAutoSkipping,
        repeatCount,
        isRepeating,
        handleSearch,
        handleNext,
        handlePrevious,
        handleReplay,
        handleVideoEnd,
        lookupState,
        handleTextSelection,
        closeLookup,
        setQuery,
        jumpToClip,
        registerReplayTrigger,
        clearSearch,
    };
};
