// src/features/reader/components/ReaderPage.tsx
'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useParams } from 'next/navigation';
import { useUser } from '@/contexts/user-context';
import { getLibraryItemById } from '@/services/client/library-service';
import type { LibraryItem } from '@/lib/types';
import { Icon } from '@/components/ui/icons';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Logo } from '@/components/ui/Logo';

// Lazy load the specific readers
const BookReader = dynamic(() => import('@/features/reader/components/book/BookReader'), {
  loading: () => <ReaderLoader />,
});
const PieceReader = dynamic(() => import('@/features/reader/components/piece/PieceReader'), {
  loading: () => <ReaderLoader />,
});

// A unified loader component
const ReaderLoader = () => (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-4 text-center bg-background">
        <Logo className="h-24 w-24 animate-pulse text-primary mx-auto" />
        <p className="mt-2 text-sm text-muted-foreground">Loading Content...</p>
    </div>
);

// A unified error component
const ReaderError = () => {
    const { t } = useTranslation(['readerPage', 'common']);
    return (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-4 text-center bg-background">
            <Icon name="AlertCircle" className="h-12 w-12 text-destructive mb-4" />
            <h2 className="text-xl font-semibold">{t('common:error')}</h2>
            <p className="text-muted-foreground">{t('failedToLoadContent')}</p>
            <Button asChild className="mt-4"><Link href="/library/book">{t('common:backToLibrary')}</Link></Button>
        </div>
    );
};

/**
 * ReaderPage is now a simple "router" component.
 * Its only job is to fetch the item data and then delegate rendering
 * to the appropriate specialized reader component (`BookReader` or `PieceReader`).
 */
export function ReaderPage() {
  const params = useParams();
  const idFromUrl = params.id as string;
  const { user } = useUser();
  
  const [item, setItem] = useState<LibraryItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadItem() {
      if (!idFromUrl || !user?.uid) {
        setIsLoading(false);
        setError("Invalid request.");
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const fetchedItem = await getLibraryItemById(user.uid, idFromUrl);
        if (isMounted) {
          if (fetchedItem) {
            setItem(fetchedItem);
          } else {
            setError("Content not found.");
          }
        }
      } catch (err) {
        console.error("Error fetching library item:", err);
        if (isMounted) setError("Failed to load content.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadItem();
    
    return () => { isMounted = false; };
  }, [idFromUrl, user?.uid]);

  if (isLoading) {
    return <ReaderLoader />;
  }

  if (error || !item) {
    return <ReaderError />;
  }

  // Delegate rendering based on the item's type
  return (
    <Suspense fallback={<ReaderLoader />}>
        {item.type === 'book' && <BookReader book={item} />}
        {item.type === 'piece' && <PieceReader piece={item} />}
    </Suspense>
  );
}
