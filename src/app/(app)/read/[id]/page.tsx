// src/app/(app)/read/[id]/page.tsx
'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { notFound } from 'next/navigation';
import { useUser } from '@/contexts/user-context';
import { getLibraryItemById } from '@/services/client/library-service'; // Client-side fetch
import type { LibraryItem } from '@/lib/types';
import BookReader from '@/features/reader/components/book/BookReader';
import PieceReader from '@/features/reader/components/piece/PieceReader';
import { Logo } from '@/components/ui/Logo';

interface ReadPageProps {
  params: { id: string };
}

const ReaderLoader = () => (
    <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="text-center">
            <Logo className="h-24 w-24 animate-pulse text-primary mx-auto" />
            <p className="mt-2 text-sm text-muted-foreground">Loading Content...</p>
        </div>
    </div>
);


// This is now a client component that fetches its own data.
export default function ReadPage({ params }: ReadPageProps) {
  const { id } = params;
  const { user } = useUser();
  const [item, setItem] = useState<LibraryItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      // User is not loaded yet, wait.
      return;
    }

    const fetchItem = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const fetchedItem = await getLibraryItemById(user.uid, id);
        if (fetchedItem) {
          setItem(fetchedItem);
        } else {
          setError("Content not found or you don't have access.");
        }
      } catch (e: any) {
        console.error("Failed to fetch library item:", e);
        setError("Failed to load content.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchItem();
  }, [id, user]);

  if (isLoading) {
    return <ReaderLoader />;
  }

  if (error) {
    // A simple error message, could be a more styled component
    return <div className="flex items-center justify-center h-screen text-destructive">{error}</div>;
  }

  if (!item) {
    // This will be triggered if the item is not found after loading.
    return notFound();
  }

  // Based on the item type, render the correct reader component.
  if (item.type === 'book') {
    return <BookReader book={item} />;
  }

  if (item.type === 'piece') {
    return <PieceReader piece={item} />;
  }

  // Fallback for any other type
  return notFound();
}
