
"use client";

import { createContext } from 'react';
import type { LibraryItem, BookmarkType } from '@/lib/types';
import type { CombinedBookmark } from '../hooks/useLibrary';

export interface LibraryContextType {
  availableBookmarks: CombinedBookmark[];
  onBookmarkChange: (itemId: string, newBookmarkId: BookmarkType) => void;
  onDelete: (item: LibraryItem) => void;
}

export const LibraryContext = createContext<LibraryContextType>({
  availableBookmarks: [],
  onBookmarkChange: () => {},
  onDelete: () => {},
});
