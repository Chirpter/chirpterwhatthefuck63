

"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Book, CombinedBookmark } from '@/lib/types';
import { useToast } from '@/hooks/useToast';
import { getGlobalBooks } from '@/services/server/library-service';
import type { DocumentData } from 'firebase/firestore';
import { ApiServiceError } from '@/lib/errors';
import { useBookmarks } from '@/contexts/bookmark-context'; // Use centralized bookmarks

const ITEMS_PER_PAGE = 20;

export type PurchasableItem = (Book & { itemType: 'book' }) | (CombinedBookmark & { itemType: 'bookmark' });

interface CreditPack {
    id: string;
    name: string;
    description: string;
    credits: number;
    priceUsd: number;
}

export const useShop = () => {
  const [items, setItems] = useState<PurchasableItem[]>([]);
  const [creditPacks, setCreditPacks] = useState<CreditPack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastBookDoc, setLastBookDoc] = useState<DocumentData | null>(null);

  const { toast } = useToast();
  const { availableBookmarks, isLoading: areBookmarksLoading } = useBookmarks();

  useEffect(() => {
    let isMounted = true;
    const loadInitialData = async () => {
      setIsLoading(true);
      try {
        let allNewItems: PurchasableItem[] = [];
        const now = new Date().toISOString();
        
        // Fetch books from global store
        const { items: newBooks, lastDoc } = await getGlobalBooks({ limit: ITEMS_PER_PAGE, forSale: true });
        
        if (!isMounted) return;

        // Filter bookmarks from context
        const purchasableBookmarks = availableBookmarks
          .filter(bm => 
              bm.status === 'published' && 
              bm.unlockType === 'purchase' &&
              (!bm.releaseDate || bm.releaseDate <= now) &&
              (!bm.endDate || bm.endDate > now)
          )
          .map(bm => ({ ...bm, itemType: 'bookmark' as const }));
          
        allNewItems.push(...purchasableBookmarks);

        setCreditPacks([
            { id: 'pack_100', name: 'Tiny Pack', description: 'A small start for your journey.', credits: 100, priceUsd: 0.99 },
            { id: 'pack_550', name: 'Author Pack', description: 'More credits for endless creation.', credits: 550, priceUsd: 4.99 },
            { id: 'pack_1200', name: 'Master Author Pack', description: 'The biggest and most cost-effective pack for true writers.', credits: 1200, priceUsd: 9.99 },
        ]);

        const purchasableBooks = newBooks.map(book => ({ ...book, itemType: 'book' as const }));
        allNewItems.push(...purchasableBooks);
        allNewItems.sort((a, b) => (b.releaseDate || '').localeCompare(a.releaseDate || ''));

        setItems(allNewItems);
        setLastBookDoc(lastDoc);
        setHasMore(newBooks.length === ITEMS_PER_PAGE);

      } catch (error: any) {
        console.error('Error fetching shop items:', error);
        toast({
          title: 'Error',
          description: 'Could not load items for the shop.',
          variant: 'destructive',
        });
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    
    // Only load when bookmarks are ready
    if (!areBookmarksLoading) {
      loadInitialData();
    }

    return () => { isMounted = false; };
  }, [toast, areBookmarksLoading, availableBookmarks]); // Rerun when bookmarks from context change

  const loadMoreItems = async () => {
    if (hasMore && !isLoadingMore) {
        setIsLoadingMore(true);
        try {
            const { items: newItems, lastDoc: newLastDoc } = await getGlobalBooks({
                limit: ITEMS_PER_PAGE,
                startAfter: lastBookDoc,
                forSale: true,
            });

            const purchasableBooks = newItems.map(book => ({ ...book, itemType: 'book' as const }));

            setItems(prev => [...prev, ...purchasableBooks]);
            setLastBookDoc(newLastDoc);
            setHasMore(newItems.length === ITEMS_PER_PAGE);
        } catch (error) {
            console.error('Error loading more items:', error);
            toast({ title: 'Error', description: 'Could not load more items.', variant: 'destructive' });
        } finally {
            setIsLoadingMore(false);
        }
    }
  };

  return {
    items,
    creditPacks,
    isLoading: isLoading || areBookmarksLoading,
    isLoadingMore,
    hasMore,
    loadMoreItems,
  };
};
