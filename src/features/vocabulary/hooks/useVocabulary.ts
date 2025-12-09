
"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useUser } from "@/contexts/user-context";
import { useLiveQuery } from "dexie-react-hooks";
import type { VocabularyItem, VocabularyFilters, VocabContext } from "@/lib/types";
import * as vocabService from "@/services/vocabulary-service";
import { useDebounce } from "@/hooks/useDebounce";
import { useLibraryItems } from "@/features/library/hooks/useLibraryItems";

const PAGE_SIZE = 25;

interface UseVocabularyProps {
    enabled?: boolean;
    initialFolder?: string;
    scope?: 'global' | 'local';
    context?: VocabContext;
}

export function useVocabulary({ 
    enabled = true, 
    initialFolder = 'unorganized',
    scope = 'global',
    context,
}: UseVocabularyProps) {
  const { user } = useUser();
  const [searchTerm, setSearchTerm] = useState('');
  const [folderFilter, setFolderFilter] = useState(initialFolder);
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Centralized data fetching hook for folder information
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
            console.error(err);
            return { folders: [], folderCounts: { unorganized: 0 } };
        }
    },
    [user?.uid, enabled],
    { folders: [], folderCounts: { unorganized: 0 } }
  );
  
  // Centralized data fetching for vocabulary items, now using the shared hook
  const { items: vocabulary, isLoading, hasMore, loadMore, error, clearError } = useLibraryItems({
    contentType: 'vocabulary',
    enabled: enabled,
    folder: folderFilter,
    searchTerm: debouncedSearchTerm.length >= 2 ? debouncedSearchTerm : '',
    limit: PAGE_SIZE
  });

  const [transientFolders, setTransientFolders] = useState<string[]>([]);
  const combinedFolders = useMemo(() => {
    const allFolders = new Set<string>([...(folderData?.folders || []), ...transientFolders]);
    return Array.from(allFolders).sort((a, b) => a.localeCompare(b));
  }, [folderData?.folders, transientFolders]);
  
  const addTransientFolder = useCallback((folderName: string) => {
    if (!combinedFolders.includes(folderName)) {
      setTransientFolders(prev => [...prev, folderName]);
    }
  }, [combinedFolders]);

  const addItem = useCallback(async (newItemData: Omit<VocabularyItem, 'id' | 'userId' | 'createdAt' | 'srsState' | 'memStrength' | 'streak' | 'attempts' | 'lastReview' | 'dueDate'>) => {
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
    vocabulary,
    isLoading: isLoading || folderData === undefined,
    hasMore,
    loadMore,
    searchTerm,
    setSearchTerm,
    setFolderFilter,
    folderFilter,
    folders: combinedFolders,
    folderCounts: folderData?.folderCounts || { unorganized: 0 },
    addItem,
    updateItem,
    deleteItem,
    error,
    clearError,
    addTransientFolder,
  };
}
