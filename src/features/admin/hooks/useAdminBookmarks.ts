
"use client";

import { useState, useEffect, useCallback } from 'react';
import { collection, updateDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/useToast';
import type { CombinedBookmark, BookmarkMetadata } from '@/lib/types';
import { removeUndefinedProps } from '@/lib/utils';
import { getSystemBookmarks, getBookmarkMetadata } from '@/services/server/bookmark.service';
import { useBookmarks } from '@/contexts/bookmark-context';

export type BookmarkStatus = 'published' | 'unpublished' | 'maintenance';

type FormValues = {
  price?: number;
  status?: BookmarkStatus;
  unlockType?: 'free' | 'purchase' | 'pro';
  releaseDate?: Date;
  endDate?: Date;
};

export const useAdminBookmarks = () => {
  const { availableBookmarks, isLoading: areBookmarksLoading } = useBookmarks();
  const [bookmarks, setBookmarks] = useState<CombinedBookmark[]>(availableBookmarks);
  const [isLoading, setIsLoading] = useState(areBookmarksLoading);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState<CombinedBookmark | null>(null);
  const { toast } = useToast();
  
  useEffect(() => {
    setBookmarks(availableBookmarks);
    setIsLoading(areBookmarksLoading);
  }, [availableBookmarks, areBookmarksLoading]);

  const loadBookmarks = useCallback(async () => {
    // This function can be used to trigger a server action to refetch if needed.
    // For now, it just re-sets from the context.
    setIsLoading(true);
    setBookmarks(availableBookmarks);
    setIsLoading(false);
  }, [availableBookmarks]);

  const handleEdit = (bookmark: CombinedBookmark) => {
    setEditingBookmark(bookmark);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingBookmark(null);
  };

  const handleSave = async (data: Partial<FormValues>, bookmarkId: string) => {
    try {
      const metadataRef = doc(db, 'bookmarkMetadata', bookmarkId);
      
      const metadataPayload: Partial<BookmarkMetadata> = {
        id: bookmarkId,
        price: data.price,
        status: data.status,
        unlockType: data.unlockType,
        releaseDate: data.releaseDate ? data.releaseDate.toISOString() : undefined,
        endDate: data.endDate ? data.endDate.toISOString() : undefined,
      };
      
      await setDoc(metadataRef, removeUndefinedProps(metadataPayload), { merge: true });

      toast({ title: "Success", description: "Bookmark metadata updated." });
      // The data will auto-update if the provider is designed to refetch.
      // For now, we manually reload. A more advanced implementation could use a 'refetch' from context.
      // await loadBookmarks(); 
    } catch (error) {
      console.error("Error saving bookmark metadata:", error);
      toast({ title: "Error", description: "Failed to save bookmark metadata.", variant: "destructive" });
      throw error;
    }
  };

  return {
    bookmarks,
    isLoading,
    isFormOpen,
    editingBookmark,
    handleEdit,
    handleSave,
    handleCloseForm,
    loadBookmarks,
  };
};
