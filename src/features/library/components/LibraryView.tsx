'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Icon } from '@/components/ui/icons';
import { useToast } from '@/hooks/useToast';
import { useTranslation } from 'react-i18next';
import type { LibraryItem, Book, Piece } from '@/lib/types';
import { useLibrary } from '../hooks/useLibrary';
import { LibraryContext } from '../contexts/LibraryContext';
import { BookItemCard } from './BookItemCard';
import { PieceItemCard } from './PieceItemCard';
import { ProcessingBookItemCard } from './ProcessingBookItemCard';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BookmarkStyleProvider } from './BookmarkStyleProvider';
import { useBookmarks } from '@/contexts/bookmark-context';


interface LibraryViewProps {
  contentType: 'book' | 'piece' | 'vocabulary';
}

function LibraryGrid({ items, onDelete }: { items: LibraryItem[], onDelete: (item: LibraryItem) => void }) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <Icon name="SearchX" className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-xl font-headline font-medium mb-2">No Items Found</h3>
        <p className="text-muted-foreground font-body">Try adjusting your search or filters.</p>
      </div>
    );
  }

  return (
    <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-4 xl:columns-5 2xl:columns-6 gap-4 space-y-4">
      {items.map(item => {
        if (item.status === 'processing') {
          return <ProcessingBookItemCard key={item.id} book={item as Book} onDelete={onDelete} />;
        }
        if (item.type === 'book') {
          return <BookItemCard key={item.id} book={item as Book} />;
        }
        if (item.type === 'piece') {
          return <PieceItemCard key={item.id} work={item as Piece} />;
        }
        return null;
      })}
    </div>
  );
}

export default function LibraryView({ contentType }: LibraryViewProps) {
  const { authUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const { availableBookmarks } = useBookmarks();

  const libraryHook = useLibrary({ contentType: contentType === 'vocabulary' ? 'piece' : contentType });

  const {
    filteredItems,
    isLoading,
    searchTerm,
    setSearchTerm,
    itemToDelete,
    isDeleting,
    handleDelete,
    cancelDelete,
    confirmDelete,
    handleBookmarkChange,
  } = libraryHook;

  if (isLoading || authLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Icon name="Loader2" className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <LibraryContext.Provider value={{ availableBookmarks, onBookmarkChange: handleBookmarkChange, onDelete: confirmDelete }}>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="relative flex-grow w-full md:w-auto">
            <Icon name="Search" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search your library..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="font-body pl-9"
              aria-label="Search library"
            />
          </div>
          <Button onClick={() => router.push('/create')} className="w-full md:w-auto">
            <Icon name="Plus" className="mr-2 h-4 w-4" />
            Create New
          </Button>
        </div>
        
        <BookmarkStyleProvider items={filteredItems} availableBookmarks={availableBookmarks}>
          <LibraryGrid items={filteredItems} onDelete={confirmDelete} />
        </BookmarkStyleProvider>
        
        <AlertDialog open={!!itemToDelete} onOpenChange={(open) => !open && cancelDelete()}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete "{itemToDelete?.title.primary}" and all of its data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={cancelDelete} disabled={isDeleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                  {isDeleting && <Icon name="Loader2" className="mr-2 h-4 w-4 animate-spin" />}
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

      </div>
    </LibraryContext.Provider>
  );
}
