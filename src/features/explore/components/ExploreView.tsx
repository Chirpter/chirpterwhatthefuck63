
"use client";

import React from 'react';
import { useTranslation } from 'react-i18next';
import { BookItemCard } from '@/features/library/components/BookItemCard';
import { Input } from '@/components/ui/input';
import { Icon } from '@/components/ui/icons';
import { useExplore } from '@/features/explore/hooks/useExplore';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { BookmarkCard } from '@/features/user/components/BookmarkCard';
import { useUser } from '@/contexts/user-context';
import { BookmarkStyleProvider } from '@/features/library/components/BookmarkStyleProvider';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';


export default function ExploreView() {
  const { t } = useTranslation(['common', 'shopPage', 'explorePage']);
  const { user } = useUser();
  
  const {
    items,
    bookmarks,
    isLoading,
    isLoadingMore,
    hasMore,
    searchTerm,
    setSearchTerm,
    loadMoreItems,
  } = useExplore();

  const ownedBookmarkIds = new Set(user?.ownedBookmarkIds || []);

  const renderBookContent = () => {
    if (isLoading && items.length === 0) {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-card p-4 rounded-lg shadow-md animate-pulse">
              <Skeleton className="h-48 bg-muted rounded-md mb-4" />
              <Skeleton className="h-6 w-3/4 bg-muted rounded-md mb-2" />
              <Skeleton className="h-4 w-1/2 bg-muted rounded-md mb-4" />
              <Skeleton className="h-8 w-full bg-muted rounded-md" />
            </div>
          ))}
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <div className="text-center py-12">
          <Icon name="SearchX" className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-xl font-headline font-medium mb-2">{t('explorePage:noBooksFound')}</h3>
          <p className="text-muted-foreground font-body">{t('explorePage:noBooksHint')}</p>
        </div>
      );
    }
    
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
        {items.map((item) => (
            <BookItemCard
                key={item.id}
                book={item}
            />
        ))}
      </div>
    );
  };
  
  const renderBookmarkContent = () => {
    if (isLoading && bookmarks.length === 0) {
       return (
         <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(144px, 1fr))', gap: '1rem' }}>
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
         </div>
       );
    }

    if (bookmarks.length === 0) return null;

    return (
       <BookmarkStyleProvider items={[]} availableBookmarks={bookmarks}>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(144px, 1fr))', gap: '1rem' }}>
                {bookmarks.map((bm) => {
                    const isOwned = ownedBookmarkIds.has(bm.id);
                    const isForSale = !isOwned && bm.unlockType === 'purchase';
                    
                    const status = isOwned ? 'owned' : (bm.unlockType === 'purchase' ? 'for_sale' : 'locked');
                    
                    return (
                        <div key={bm.id} className="flex flex-col">
                            <BookmarkCard
                                bookmark={bm}
                                status={status}
                                price={bm.price}
                                onCardClick={isForSale ? () => router.push('/shop') : undefined}
                                className="flex-grow"
                            />
                        </div>
                    )
                })}
            </div>
        </BookmarkStyleProvider>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl md:text-2xl font-headline font-semibold mb-6">{t('explorePage:title')}</h2>
      <p className="text-muted-foreground font-body -mt-5">{t('explorePage:description')}</p>

      <div className="flex items-center gap-2 p-2 bg-card rounded-lg shadow">
        <div className="relative flex-grow w-full">
            <Icon name="Search" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder={t('explorePage:searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="font-body pl-9 h-10"
              aria-label={t('explorePage:searchPlaceholder')}
            />
        </div>
      </div>
      
      {/* Bookmarks Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-headline font-semibold border-b pb-2">{t('explorePage:bookmarksTitle')}</h3>
        {renderBookmarkContent()}
      </div>
      
      {/* Books Section */}
      <div className="space-y-4 pt-4">
        <h3 className="text-lg font-headline font-semibold border-b pb-2">{t('explorePage:booksTitle')}</h3>
        {renderBookContent()}
        {hasMore && !isLoading && (
            <div className="text-center mt-8">
            <Button onClick={loadMoreItems} disabled={isLoadingMore}>
                {isLoadingMore && <Icon name="Loader2" className="mr-2 h-4 w-4 animate-spin" />}
                {t('loadMore')}
            </Button>
            </div>
        )}
      </div>
    </div>
  );
}
