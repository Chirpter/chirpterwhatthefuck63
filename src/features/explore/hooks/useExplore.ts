

"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Book, BookmarkMetadata } from '@/lib/types';
import { useToast } from '@/hooks/useToast';
import { getGlobalBooks } from '@/services/server/library.service';
import { getBookmarkMetadata, getSystemBookmarks } from '@/services/server/bookmark.service';
import type { DocumentData } from 'firebase/firestore';
import type { CombinedBookmark } from '@/features/library/hooks/useLibrary';
import { useAuth } from '@/contexts/auth-context';
import { useUser } from '@/contexts/user-context';
import { supabase } from '@/lib/supabase';
import { useDebounce } from '@/hooks/useDebounce';

const ITEMS_PER_PAGE = 20;

export const useExplore = () => {
  const [items, setItems] = useState<Book[]>([]);
  const [bookmarks, setBookmarks] = useState<CombinedBookmark[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastBookDoc, setLastBookDoc] = useState<DocumentData | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const { toast } = useToast();
  const { authUser } = useAuth();
  const { user } = useUser();

  const loadInitialData = useCallback(async (signal: AbortSignal) => {
    setIsLoading(true);
    try {
        const now = new Date().toISOString();
        
        // Fetch bookmarks
        const [systemBookmarks, metadata] = await Promise.all([
          getSystemBookmarks(),
          getBookmarkMetadata(),
        ]);

        if (signal.aborted) return;

        const metadataMap = new Map(metadata.map(m => [m.id, m]));
        const allPublishedBookmarks = systemBookmarks
          .map(sb => ({ ...sb, ...metadataMap.get(sb.id) }))
          .filter(bm => 
              bm.status === 'published' &&
              (!bm.releaseDate || bm.releaseDate <= now) &&
              (!bm.endDate || bm.endDate > now)
          );
        setBookmarks(allPublishedBookmarks);

        // Fetch initial set of books
        const { items: newBooks, lastDoc } = await getGlobalBooks({
            limit: ITEMS_PER_PAGE,
        }, signal);

        if (signal.aborted) return;

        setItems(newBooks);
        setLastBookDoc(lastDoc);
        setHasMore(newBooks.length === ITEMS_PER_PAGE);

    } catch (error: any) {
        if (error.name !== 'AbortError') {
            console.error('Error fetching initial explore items:', error);
            toast({ title: 'Error', description: 'Could not load items to explore.', variant: 'destructive' });
        }
    } finally {
        if (!signal.aborted) {
            setIsLoading(false);
        }
    }
  }, [toast]);
  
  const searchItems = useCallback(async (signal: AbortSignal) => {
      if (!debouncedSearchTerm.trim()) {
          loadInitialData(signal);
          return;
      }

      setIsLoading(true);
      try {
          const { data, error } = await supabase.rpc('search_global_content', {
              p_search_term: debouncedSearchTerm.trim()
          });

          if (signal.aborted) return;

          if (error) {
              // RLS policy on Supabase will return an error when the rate limit is exceeded.
              // We catch it here and show a user-friendly message.
              if (error.code === 'PGRST301' || error.message.includes('rate limit')) {
                   toast({
                      title: 'Search Limit Reached',
                      description: 'You have reached your search limit for today.',
                      variant: 'destructive',
                    });
                     setItems([]);
                     setBookmarks([]);
              } else {
                  throw error;
              }
          } else {
              const books = (data as any[]).filter(item => item.item_type === 'book').map(item => ({...item.item_data, id: item.item_id})) as Book[];
              const bookmarkItems = (data as any[]).filter(item => item.item_type === 'bookmark').map(item => ({...item.item_data, id: item.item_id})) as CombinedBookmark[];
              
              setItems(books);
              setBookmarks(bookmarkItems);
              setHasMore(false);
          }

      } catch (error: any) {
           if (error.name !== 'AbortError') {
                console.error('Error searching items:', error);
                toast({ title: 'Error', description: 'Search failed. Please try again later.', variant: 'destructive' });
           }
      } finally {
           if (!signal.aborted) {
                setIsLoading(false);
           }
      }
  }, [debouncedSearchTerm, toast, loadInitialData]);

  useEffect(() => {
    const controller = new AbortController();
    searchItems(controller.signal);
    return () => controller.abort();
  }, [debouncedSearchTerm, searchItems]);

  const loadMoreItems = async () => {
    if (!hasMore || isLoadingMore || debouncedSearchTerm) return;
    
    setIsLoadingMore(true);
    try {
      const { items: newItems, lastDoc: newLastDoc } = await getGlobalBooks({
        limit: ITEMS_PER_PAGE,
        startAfter: lastBookDoc,
      });

      setItems(prev => [...prev, ...newItems]);
      setLastBookDoc(newLastDoc);
      setHasMore(newItems.length === ITEMS_PER_PAGE);

    } catch (error) {
      console.error('Error loading more items:', error);
      toast({ title: 'Error', description: 'Could not load more items.', variant: 'destructive' });
    } finally {
      setIsLoadingMore(false);
    }
  };

  return {
    items,
    bookmarks,
    isLoading,
    isLoadingMore,
    hasMore,
    searchTerm,
    setSearchTerm,
    loadMoreItems,
  };
};
