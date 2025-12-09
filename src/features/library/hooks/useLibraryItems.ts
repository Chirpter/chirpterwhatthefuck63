
// src/features/library/hooks/useLibraryItems.ts
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from '@/contexts/user-context';
import type { LibraryItem, OverallStatus, VocabularyItem, VocabularyFilters } from '@/lib/types';
import { getLibraryItems as serviceGetLibraryItems } from '@/services/library-service';
import { getVocabularyItemsPaginated } from '@/services/vocabulary-service';

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
  const [items, setItems] = useState<LibraryItem[] | VocabularyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const pageRef = useRef(1);
  const isFetchingRef = useRef(false);

  const fetchItems = useCallback(async (page: number, currentItems: (LibraryItem[] | VocabularyItem[])) => {
    if (!user || !enabled || isFetchingRef.current) return;

    isFetchingRef.current = true;
    if (page === 1) setIsLoading(true);
    else setIsLoadingMore(true);

    setError(null);

    try {
      let result;
      const offset = (page - 1) * limit;

      if (contentType === 'vocabulary') {
        const vocabResult = await getVocabularyItemsPaginated(user.uid, {
          folder: folder || 'all',
          searchTerm,
          limit,
          offset,
        });
        result = { items: vocabResult.items, hasMore: vocabResult.hasMore };
      } else {
        // Fetching books or pieces
        const libResult = await serviceGetLibraryItems(user.uid, {
          contentType,
          status,
          limit,
          // Note: Firestore pagination is different, this hook would need adjustment
          // For now, we fetch more and append. A cursor-based approach is better for Firestore.
        });
        // This simplified version fetches all and appends, not true pagination for Firestore
        // A real implementation would use the `lastDoc` from the service.
        result = { items: libResult.items, hasMore: false }; // Simplified
      }
      
      setItems(page === 1 ? result.items : [...currentItems, ...result.items]);
      setHasMore(result.hasMore);
      pageRef.current = page;

    } catch (err: any) {
      setError(err);
      console.error(`[useLibraryItems] Failed to fetch ${contentType || 'items'}:`, err);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      isFetchingRef.current = false;
    }
  }, [user, enabled, contentType, status, limit, folder, searchTerm]);
  
  // Effect to trigger fetch when filters change
  useEffect(() => {
    pageRef.current = 1; // Reset page number on filter change
    fetchItems(1, []);
  }, [fetchItems]); // `fetchItems` has all dependencies

  const loadMoreItems = useCallback(() => {
    if (hasMore && !isLoadingMore) {
      fetchItems(pageRef.current + 1, items);
    }
  }, [hasMore, isLoadingMore, fetchItems, items]);

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

// A new file for a new hook
// src/features/library/hooks/useLibraryItems.ts
