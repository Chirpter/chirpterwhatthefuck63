// src/features/library/hooks/useLibraryItems.ts
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from '@/contexts/user-context';
import type { LibraryItem, OverallStatus, VocabularyItem, VocabularyFilters } from '@/lib/types';
import { getLibraryItems as serviceGetLibraryItems } from '@/services/library-service';
import { getVocabularyItemsPaginated } from '@/services/client/vocabulary-service';
import type { DocumentData } from 'firebase/firestore';


interface UseLibraryItemsProps {
  contentType?: "book" | "piece" | "vocabulary";
  status?: OverallStatus | 'all';
  limit?: number;
  enabled?: boolean;
  folder?: string;
  searchTerm?: string;
}

/**
 * A centralized, generic hook for fetching paginated library items (Books, Pieces, or Vocabulary).
 * This hook is responsible for the core data fetching, pagination, and caching logic.
 */
export const useLibraryItems = ({ 
  contentType, 
  status = 'all', 
  limit = 20, 
  enabled = true,
  folder,
  searchTerm
}: UseLibraryItemsProps) => {
  const { user } = useUser();
  const [items, setItems] = useState<(LibraryItem | VocabularyItem)[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const lastDocRef = useRef<DocumentData | null>(null);
  
  const pageRef = useRef(1);
  const isFetchingRef = useRef(false);

  const fetchItems = useCallback(async (isInitialLoad: boolean) => {
    if (!user || !enabled || isFetchingRef.current) return;

    isFetchingRef.current = true;
    if (isInitialLoad) {
      setIsLoading(true);
      lastDocRef.current = null;
      setItems([]);
      pageRef.current = 1;
    } else {
      setIsLoadingMore(true);
    }
    setError(null);

    try {
      let result;
      if (contentType === 'vocabulary') {
        const offset = (pageRef.current - 1) * limit;
        const vocabResult = await getVocabularyItemsPaginated(user.uid, {
          folder: folder || 'all',
          searchTerm,
          limit,
          offset,
        });
        result = { items: vocabResult.items, hasMore: vocabResult.hasMore };
        if (vocabResult.hasMore) {
            pageRef.current += 1;
        }
      } else {
        const libResult = await serviceGetLibraryItems(user.uid, {
          contentType,
          status,
          limit,
          startAfter: isInitialLoad ? null : lastDocRef.current,
        });
        result = { items: libResult.items, hasMore: !!libResult.lastDoc };
        lastDocRef.current = libResult.lastDoc;
      }
      
      setItems(prev => isInitialLoad ? result.items : [...prev, ...result.items]);
      setHasMore(result.hasMore);

    } catch (err: any) {
      console.error(`[useLibraryItems] Failed to fetch ${contentType || 'items'}:`, err);
      setError(err);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      isFetchingRef.current = false;
    }
  }, [user, enabled, contentType, status, limit, folder, searchTerm]); 
  
  useEffect(() => {
    fetchItems(true);
  }, [fetchItems]);

  const loadMoreItems = useCallback(() => {
    if (hasMore && !isLoadingMore) {
      fetchItems(false);
    }
  }, [hasMore, isLoadingMore, fetchItems]);

  const mutate = useCallback((updater: (prevItems: (LibraryItem[] | VocabularyItem[])) => (LibraryItem[] | VocabularyItem[])) => {
    setItems(updater);
  }, []);

  return {
    items,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMoreItems,
    error,
    clearError: () => setError(null),
    mutate,
  };
};
