
// src/features/library/hooks/useLibrary.ts

import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/useToast';
import { useUser } from '@/contexts/user-context';
import type { LibraryItem, OverallStatus } from '@/lib/types';
import { deleteLibraryItem as serviceDeleteLibraryItem, updateLibraryItem } from '@/services/server/library.service';
import { useLibraryItems } from './useLibraryItems';

interface UseLibraryProps {
  contentType?: "book" | "piece";
}

export const useLibrary = ({ contentType }: UseLibraryProps) => {
  const { t } = useTranslation(['common', 'libraryPage', 'toast']);
  const { toast } = useToast();
  const { user } = useUser();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<OverallStatus | 'all'>("all");
  const [itemToDelete, setItemToDelete] = useState<LibraryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Use the new centralized data fetching hook
  const {
    items: allItems,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMoreItems,
    mutate, // Function to update local state
  } = useLibraryItems({ contentType, status: 'all', limit: 100 });

  const filteredItems = useMemo(() => {
    let itemsToFilter = allItems;
    
    if (statusFilter !== 'all') {
      itemsToFilter = itemsToFilter.filter(item => item.status === statusFilter);
    }
    
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      itemsToFilter = itemsToFilter.filter(item => {
        const title = (item.title as any)?.primary || 
                      Object.values(item.title)[0] || 
                      '';
        return title.toLowerCase().includes(lowerCaseSearchTerm);
      });
    }
    
    return itemsToFilter;
  }, [allItems, searchTerm, statusFilter]);

  const confirmDelete = useCallback((item: LibraryItem) => {
    setItemToDelete(item);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!itemToDelete || !user) return;
    
    setIsDeleting(true);
    
    try {
      await serviceDeleteLibraryItem(user.uid, itemToDelete.id);
      mutate(prevItems => prevItems?.filter(item => item.id !== itemToDelete.id) || []);
      
      const title = (itemToDelete.title as any)?.primary || Object.values(itemToDelete.title)[0] || 'item';
      toast({
        title: t("common:success"),
        description: t("common:alertDialog.deleteSuccess", { title }),
      });
      
    } catch (error) {
      console.error('[useLibrary] Delete error:', error);
      const title = (itemToDelete.title as any)?.primary || Object.values(itemToDelete.title)[0] || 'item';
      toast({
        title: t("common:error"),
        description: t("libraryPage:toastFailedToDelete", { title }),
        variant: "destructive",
      });
      
    } finally {
        setIsDeleting(false);
        setItemToDelete(null);
    }
  }, [itemToDelete, user, t, toast, mutate]);
  
  const handleBookmarkChange = useCallback(async (itemId: string, newBookmarkId: string) => {
    if (!user) return;

    // Optimistic UI update
    mutate(prevItems => {
        if (!prevItems) return [];
        return prevItems.map(item => 
          item.id === itemId && item.type === 'book' 
            ? { ...item, selectedBookmark: newBookmarkId } 
            : item
        );
    });
    
    try {
      await updateLibraryItem(user.uid, itemId, { selectedBookmark: newBookmarkId });
    } catch (err) {
      console.error('[useLibrary] Bookmark update error:', err);
      toast({ 
        title: t('common:error'), 
        description: t('bookCard:toastBookmarkError'), 
        variant: 'destructive' 
      });
      // Revert local state on error
      mutate(prevItems => {
        if (!prevItems) return [];
        return prevItems.map(item =>
          item.id === itemId
            ? { ...item, selectedBookmark: allItems.find(i => i.id === itemId)?.selectedBookmark || 'default' }
            : item
        );
      });
    }
  }, [user, allItems, toast, t, mutate]);

  const cancelDelete = useCallback(() => {
    setItemToDelete(null);
  }, []);

  return {
    filteredItems,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMoreItems,
    searchTerm,
    statusFilter,
    itemToDelete,
    isDeleting,
    handleDelete,
    cancelDelete,
    confirmDelete,
    handleBookmarkChange,
    setSearchTerm,
    setStatusFilter,
  };
};

export type { CombinedBookmark } from '@/lib/types';
