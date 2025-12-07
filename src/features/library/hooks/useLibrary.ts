// ===================================================================
// DEBUG SCRIPT - Add vào useLibrary hook tạm thời để debug
// ===================================================================

"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/useToast';
import { useUser } from '@/contexts/user-context';
import type { LibraryItem, OverallStatus } from '@/lib/types';
import { getLibraryItems, deleteLibraryItem as serviceDeleteLibraryItem, updateLibraryItem } from '@/services/library-service';

interface UseLibraryProps {
  contentType: "book" | "piece";
}

export const useLibrary = ({ contentType }: UseLibraryProps) => {
  const [allItems, setAllItems] = useState<LibraryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<OverallStatus | 'all'>("all");
  const { user } = useUser();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [itemToDelete, setItemToDelete] = useState<LibraryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setIsLoading(false);
      setAllItems([]);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const { signal } = controller;

    const performFetch = async () => {
      setIsLoading(true);
      
      const currentFetchId = ++fetchIdRef.current;
      
      try {
        const result = await getLibraryItems(
          user.uid, 
          { 
            contentType,
            status: 'all',
            limit: 100
          }
        );

        if (currentFetchId === fetchIdRef.current && !signal.aborted) {
          setAllItems(result.items);
        }
        
      } catch (error: any) {
        // Only show errors for the latest fetch and if it's not an abort error
        if (error.name !== 'AbortError' && currentFetchId === fetchIdRef.current) {
          console.error('[useLibrary] Fetch error:', error);
          toast({
            title: t('common:error'),
            description: t('libraryPage:toastFailedToLoad'),
            variant: 'destructive',
          });
        }
      } finally {
        if (currentFetchId === fetchIdRef.current && !signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    performFetch();

    return () => {
      controller.abort();
    };
  }, [user?.uid, contentType, t, toast]);

  const filteredItems = useMemo(() => {
    let itemsToFilter = allItems;
    
    if (statusFilter !== 'all') {
      itemsToFilter = itemsToFilter.filter(item => item.status === statusFilter);
    }
    
    if (searchTerm) {
      itemsToFilter = itemsToFilter.filter(item => {
        const title = (item.title as any)?.primary || 
                      Object.values(item.title)[0] || 
                      '';
        return title.toLowerCase().includes(searchTerm.toLowerCase());
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
      setAllItems(prev => prev.filter(item => item.id !== itemToDelete.id));
      
      toast({
        title: t("common:success"),
        description: t("common:alertDialog.deleteSuccess", { 
          title: (itemToDelete.title as any).primary 
        }),
      });
      
    } catch (error) {
      console.error('[useLibrary] ❌ Delete error:', error);
      
      toast({
        title: t("common:error"),
        description: t("libraryPage:toastFailedToDelete", { 
          title: (itemToDelete.title as any).primary
        }),
        variant: "destructive",
      });
      
    } finally {
      setIsDeleting(false);
      setItemToDelete(null);
    }
  }, [itemToDelete, user, t, toast]);

  const handleBookmarkChange = useCallback(async (itemId: string, newBookmarkId: string) => {
    if (!user) return;
    
    const originalItems = [...allItems];
    
    setAllItems(prev => prev.map(item => 
      item.id === itemId && item.type === 'book' 
        ? { ...item, selectedBookmark: newBookmarkId } 
        : item
    ));
    
    try {
      await updateLibraryItem(user.uid, itemId, { selectedBookmark: newBookmarkId });
      
    } catch (err) {
      console.error('[useLibrary] ❌ Bookmark update error:', err);
      
      toast({ 
        title: t('common:error'), 
        description: t('bookCard:toastBookmarkError'), 
        variant: 'destructive' 
      });
      
      setAllItems(originalItems);
    }
  }, [user, allItems, toast, t]);

  const cancelDelete = useCallback(() => {
    setItemToDelete(null);
  }, []);

  const loadMoreItems = async () => {
    console.warn('[useLibrary] ⚠️ Pagination not implemented yet');
  };

  return {
    filteredItems,
    isLoading,
    isLoadingMore: false,
    hasMore: false,
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
