"use client";

import React, { createContext, useContext, useState, useMemo, ReactNode } from 'react';
import type { CombinedBookmark } from '@/lib/types';

// The shape of the context data
interface BookmarkContextType {
  availableBookmarks: CombinedBookmark[];
  isLoading: boolean;
}

// Create the context with a default value
const BookmarkContext = createContext<BookmarkContextType | undefined>(undefined);

interface BookmarkProviderProps {
  initialBookmarks: CombinedBookmark[];
  children: React.ReactNode;
}

/**
 * A client-side provider that holds the globally available bookmark data.
 * This data is fetched once on the server and passed down as a prop.
 */
export const BookmarkProvider: React.FC<BookmarkProviderProps> = ({ initialBookmarks, children }) => {
  // The state simply holds the initial data.
  // In a more complex scenario, this could be updated via server actions or websockets.
  const [bookmarks, setBookmarks] = useState<CombinedBookmark[]>(initialBookmarks);
  const [isLoading, setIsLoading] = useState(false); // Data is pre-fetched, so it's never loading on client.

  const value = useMemo(() => ({
    availableBookmarks: bookmarks,
    isLoading,
  }), [bookmarks, isLoading]);

  return (
    <BookmarkContext.Provider value={value}>
      {children}
    </BookmarkContext.Provider>
  );
};

/**
 * Custom hook to easily access the bookmark context.
 */
export const useBookmarks = (): BookmarkContextType => {
  const context = useContext(BookmarkContext);
  if (context === undefined) {
    throw new Error('useBookmarks must be used within a BookmarkProvider');
  }
  return context;
};
