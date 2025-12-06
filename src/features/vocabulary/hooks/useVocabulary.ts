

"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useUser } from "@/contexts/user-context";
import { useLiveQuery } from "dexie-react-hooks";
import type { VocabularyItem, VocabularyFilters, VocabContext } from "@/lib/types";
import * as vocabService from "@/services/vocabulary-service";
import { useDebounce } from "@/hooks/useDebounce";

const PAGE_SIZE = 25;

interface UseVocabularyProps {
    enabled?: boolean;
    initialFolder?: string;
    /**
     * Determines the scope of vocabulary to fetch.
     * - 'global': Fetches all vocabulary items for the user. Used in the main library view.
     * - 'local': Fetches vocabulary items specific to a certain learning context (e.g., 'vocab-videos'). Used in `MiniVocabView`.
     */
    scope?: 'global' | 'local';
    /**
     * Specifies the learning context when scope is 'local'.
     * This allows fetching words saved only from a particular feature.
     * For example, `context: 'vocab-videos'` will only show words saved from that feature.
     */
    context?: VocabContext;
}

export function useVocabulary({ 
    enabled = true, 
    initialFolder = 'unorganized',
    scope = 'global',
    context,
}: UseVocabularyProps) {
  const { user } = useUser();
  const [filters, setFilters] = useState<VocabularyFilters>({
    folder: initialFolder,
    searchTerm: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
    scope,
    context: scope === 'local' ? context : undefined,
  });
  const [error, setError] = useState<Error | null>(null);
  const [transientFolders, setTransientFolders] = useState<string[]>([]);
  const [pagination, setPagination] = useState({ offset: 0, hasMore: true });

  const debouncedSearchTerm = useDebounce(filters.searchTerm, 300);
  
  // ✅ FIX: Separate live queries. This query ONLY gets folder info.
  const folderData = useLiveQuery(
    async () => {
        if (!user?.uid || !enabled) return { folders: [], folderCounts: { unorganized: 0 } };
        try {
            const [folders, folderCounts] = await Promise.all([
                vocabService.getUniqueFolders(user.uid),
                vocabService.getFolderCounts(user.uid),
            ]);
            return { folders, folderCounts };
        } catch (err: any) {
            setError(err);
            return { folders: [], folderCounts: { unorganized: 0 } };
        }
    },
    [user?.uid, enabled],
    { folders: [], folderCounts: { unorganized: 0 } }
  );

  // ✅ FIX: This query ONLY gets the items based on filters. It's now decoupled from folder changes.
  const vocabularyData = useLiveQuery(
    async () => {
      if (!user || !enabled) return { items: [], hasMore: false };
      try {
        const effectiveSearchTerm = debouncedSearchTerm.length >= 2 ? debouncedSearchTerm : '';
        
        const queryOptions = {
          ...filters,
          searchTerm: effectiveSearchTerm,
          limit: PAGE_SIZE + pagination.offset,
          offset: 0,
        };

        const result = await vocabService.getVocabularyItemsPaginated(user.uid, queryOptions);
        return { items: result.items, hasMore: result.hasMore };
      } catch (err: any) {
        setError(err);
        return { items: [], hasMore: false };
      }
    },
    [user, enabled, filters.folder, debouncedSearchTerm, pagination.offset, filters.sortBy, filters.sortOrder, filters.scope, filters.context],
    { items: [], hasMore: true }
  );

  const isLoading = (vocabularyData === undefined || folderData === undefined) && enabled;

  const combinedFolders = useMemo(() => {
    const allFolders = new Set<string>([...(folderData?.folders || []), ...transientFolders]);
    return Array.from(allFolders).sort((a, b) => a.localeCompare(b));
  }, [folderData?.folders, transientFolders]);

  useEffect(() => {
    if (!enabled) {
        setFilters({ 
            folder: initialFolder, 
            searchTerm: '', 
            sortBy: 'createdAt', 
            sortOrder: 'desc',
            scope,
            context: scope === 'local' ? context : undefined,
        });
        setPagination({ offset: 0, hasMore: true });
        return;
    }
    setPagination({ offset: 0, hasMore: true });
  }, [filters.folder, debouncedSearchTerm, filters.sortBy, filters.sortOrder, enabled, initialFolder, scope, context]);

  const loadMore = useCallback(() => {
    if (vocabularyData?.hasMore && !isLoading && enabled) {
      setPagination(prev => ({ ...prev, offset: prev.offset + PAGE_SIZE }));
    }
  }, [vocabularyData?.hasMore, isLoading, enabled]);

  const setFolderFilter = useCallback((folder: string) => {
    setFilters(f => ({ ...f, folder, searchTerm: '' }));
  }, []);

  const setSearchTerm = useCallback((term: string) => {
    setFilters(f => ({ ...f, searchTerm: term }));
  }, []);
  
  const addTransientFolder = useCallback((folderName: string) => {
    if (!combinedFolders.includes(folderName)) {
      setTransientFolders(prev => [...prev, folderName]);
    }
  }, [combinedFolders]);

  const addItem = useCallback(async (newItemData: Omit<VocabularyItem, 'id' | 'userId' | 'createdAt' | 'srsState' | 'memoryStrength' | 'streak' | 'attempts' | 'lastReviewed' | 'dueDate'>) => {
    if (!user) throw new Error("User not authenticated");
    const itemWithContext = {
      ...newItemData,
      context: newItemData.context || (scope === 'local' ? context : 'manual'),
    };
    
    const addedItem = await vocabService.addVocabularyItem(user, itemWithContext);
    
    if (addedItem.folder) {
        addTransientFolder(addedItem.folder);
    }
    
    return addedItem;
  }, [user, addTransientFolder, scope, context]);

  const updateItem = useCallback(async (updatedItemData: VocabularyItem) => {
    if (!user) throw new Error("User not authenticated");
    return await vocabService.updateVocabularyItem(user, updatedItemData.id, updatedItemData);
  }, [user]);

  const deleteItem = useCallback(async (itemId: string) => {
    if (!user) throw new Error("User not authenticated");
    await vocabService.deleteVocabularyItem(user, itemId);
  }, [user]);

  return {
    vocabulary: vocabularyData?.items || [],
    isLoading,
    hasMore: vocabularyData?.hasMore || false,
    loadMore,
    searchTerm: filters.searchTerm,
    setSearchTerm,
    setFolderFilter,
    folderFilter: filters.folder,
    folders: combinedFolders,
    folderCounts: folderData?.folderCounts || { unorganized: 0 },
    addItem,
    updateItem,
    deleteItem,
    error,
    clearError: () => setError(null),
    addTransientFolder,
  };
}
