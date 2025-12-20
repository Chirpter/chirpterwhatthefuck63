// ============================================
// SHOP VIEW - Refactored
// ============================================

"use client";

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/useToast';
import { useUser } from '@/contexts/user-context';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Icon } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { purchaseGlobalItem } from '@/services/server/user-service';
import type { Book, CombinedBookmark } from '@/lib/types';
import { useShop } from '@/features/shop/hooks/useShop';
import { BookItemCard } from '@/features/library/components/BookItemCard';
import { BookmarkCard } from '@/features/user/components/BookmarkCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { CreditIcon } from "@/components/ui/CreditIcon";

type PurchasableItem = (Book & { itemType: 'book' }) | (CombinedBookmark & { itemType: 'bookmark' });

const ProductCard: React.FC<{ 
  title: string; 
  description: string; 
  price: string; 
  onPurchase: () => void 
}> = ({ title, description, price, onPurchase }) => (
  <Card className="flex flex-col">
    <CardHeader className="items-center text-center pb-4">
      <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-3">
        <CreditIcon className="h-8 w-8 text-primary-foreground" />
      </div>
      <CardTitle className="text-lg">{title}</CardTitle>
    </CardHeader>
    <CardContent className="text-center text-sm text-muted-foreground flex-1">
      <p>{description}</p>
    </CardContent>
    <CardFooter>
      <Button className="w-full" onClick={onPurchase}>
        {price}
      </Button>
    </CardFooter>
  </Card>
);

export default function ShopView() {
  const { t } = useTranslation(['common', 'shopPage', 'toast']);
  const { user, reloadUser } = useUser();
  const { toast } = useToast();
  
  const { items, isLoading, isLoadingMore, hasMore, loadMoreItems, creditPacks } = useShop();

  const [itemToPurchase, setItemToPurchase] = useState<PurchasableItem | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  
  const ownedBookmarkIds = new Set(user?.ownedBookmarkIds || []);
  const ownedBookIds = new Set(user?.purchasedBookIds || []);

  const handlePurchaseClick = (item: PurchasableItem) => {
    if (!user) {
      toast({ 
        title: t('error'), 
        description: t('authRequired'), 
        variant: 'destructive' 
      });
      return;
    }
    
    if (user.credits < (item.price || 0)) {
      toast({ 
        title: t('insufficientCreditsTitle'), 
        description: t('insufficientCreditsDesc'), 
        variant: 'destructive' 
      });
      return;
    }
    
    setItemToPurchase(item);
  };

  const confirmPurchase = async () => {
    if (!user || !itemToPurchase) return;

    setIsPurchasing(true);
    try {
      const title = itemToPurchase.itemType === 'book' 
        ? itemToPurchase.title[itemToPurchase.origin.split('-')[0]] 
        : itemToPurchase.name || 'item';
        
      await purchaseGlobalItem(user.uid, itemToPurchase.id, itemToPurchase.itemType);
      
      toast({
        title: t('toast:purchaseSuccessTitle'),
        description: t('toast:purchaseSuccessDesc', { title }),
      });
      
      await reloadUser();
      setItemToPurchase(null);
    } catch (error: any) {
      toast({
        title: t('toast:purchaseFailedTitle'),
        description: error.message || t('toast:genericError'),
        variant: "destructive",
      });
    } finally {
      setIsPurchasing(false);
    }
  };

  const renderSkeleton = (count = 12) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
      {[...Array(count)].map((_, i) => (
        <Skeleton key={i} className="aspect-[3/4] w-full rounded-lg" />
      ))}
    </div>
  );

  const renderCreditPacks = () => {
    if (isLoading) {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-64 rounded-lg" />)}
        </div>
      );
    }
    
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {creditPacks.map(pack => (
          <ProductCard 
            key={pack.id}
            title={pack.name}
            description={pack.description}
            price={`$${pack.priceUsd.toFixed(2)}`}
            onPurchase={() => toast({ 
              title: t('common:comingSoon'), 
              description: t('shopPage:iapComingSoon') 
            })}
          />
        ))}
      </div>
    );
  };

  const renderItemsContent = () => {
    if (isLoading && items.length === 0) return renderSkeleton();
    
    const unownedItems = items.filter(item => {
      if (item.itemType === 'book') return !ownedBookIds.has(item.id);
      if (item.itemType === 'bookmark') return !ownedBookmarkIds.has(item.id);
      return true;
    });

    if (unownedItems.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Icon name="Store" className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-xl font-headline font-medium mb-2">
            {t('shopPage:emptyShopTitle')}
          </h3>
          <p className="text-muted-foreground max-w-md">
            {t('shopPage:emptyShopHint')}
          </p>
        </div>
      );
    }

    return (
      <>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
          {unownedItems.map((item) => (
            item.itemType === 'book' ? (
              <BookItemCard 
                key={item.id} 
                book={item} 
                onPurchase={() => handlePurchaseClick(item)} 
              />
            ) : (
              <BookmarkCard 
                key={item.id}
                bookmark={item}
                status="for_sale"
                price={item.price}
                onCardClick={() => handlePurchaseClick(item)}
              />
            )
          ))}
        </div>
        
        {hasMore && !isLoadingMore && (
          <div className="flex justify-center mt-8">
            <Button onClick={loadMoreItems} variant="outline">
              {t('common:loadMore')}
              <Icon name="ChevronDown" className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}
        
        {isLoadingMore && (
          <div className="flex justify-center mt-8">
            <Icon name="Loader2" className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
      </>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl md:text-2xl font-headline font-semibold">
          {t('shopPage:pageTitle')}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t('shopPage:pageDescription')}
        </p>
      </div>
      
      <Tabs defaultValue="items" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="items">{t('shopPage:tabs.items')}</TabsTrigger>
          <TabsTrigger value="credits">{t('shopPage:tabs.credits')}</TabsTrigger>
        </TabsList>
        
        <TabsContent value="items" className="mt-6">
          {renderItemsContent()}
        </TabsContent>
        
        <TabsContent value="credits" className="mt-6">
          {renderCreditPacks()}
        </TabsContent>
      </Tabs>

      {/* Purchase Confirmation Dialog */}
      {itemToPurchase && (
        <AlertDialog open={!!itemToPurchase} onOpenChange={(open) => !open && setItemToPurchase(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('shopPage:confirmPurchaseTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('shopPage:confirmPurchaseDesc', { 
                  title: itemToPurchase.name || (itemToPurchase as Book).title[(itemToPurchase as Book).origin.split('-')[0]], 
                  price: itemToPurchase.price 
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setItemToPurchase(null)} disabled={isPurchasing}>
                {t('common:cancel')}
              </AlertDialogCancel>
              <AlertDialogAction onClick={confirmPurchase} disabled={isPurchasing}>
                {isPurchasing && <Icon name="Loader2" className="mr-2 h-4 w-4 animate-spin" />}
                {t('common:confirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

// ============================================
// EXPLORE VIEW - Refactored
// ============================================

export function ExploreView() {
  const { t } = useTranslation(['common', 'explorePage']);
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

  const renderSkeleton = (count = 12) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
      {[...Array(count)].map((_, i) => (
        <Skeleton key={i} className="aspect-[3/4] w-full rounded-lg" />
      ))}
    </div>
  );

  const renderBookContent = () => {
    if (isLoading && items.length === 0) return renderSkeleton();

    if (items.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Icon name="SearchX" className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-xl font-headline font-medium mb-2">
            {t('explorePage:noBooksFound')}
          </h3>
          <p className="text-muted-foreground max-w-md">
            {t('explorePage:noBooksHint')}
          </p>
        </div>
      );
    }
    
    return (
      <>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
          {items.map((item) => (
            <BookItemCard key={item.id} book={item} />
          ))}
        </div>
        
        {hasMore && !isLoadingMore && (
          <div className="flex justify-center mt-8">
            <Button onClick={loadMoreItems} variant="outline">
              {t('common:loadMore')}
              <Icon name="ChevronDown" className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}
        
        {isLoadingMore && (
          <div className="flex justify-center mt-8">
            <Icon name="Loader2" className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
      </>
    );
  };
  
  const renderBookmarkContent = () => {
    if (isLoading && bookmarks.length === 0) return renderSkeleton(6);
    if (bookmarks.length === 0) return null;

    return (
      <BookmarkStyleProvider items={[]} availableBookmarks={bookmarks}>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
          {bookmarks.map((bm) => {
            const isOwned = ownedBookmarkIds.has(bm.id);
            const status = isOwned ? 'owned' : (bm.unlockType === 'purchase' ? 'for_sale' : 'locked');
            
            return (
              <BookmarkCard
                key={bm.id}
                bookmark={bm}
                status={status}
                price={bm.price}
              />
            );
          })}
        </div>
      </BookmarkStyleProvider>
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl md:text-2xl font-headline font-semibold">
          {t('explorePage:title')}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t('explorePage:description')}
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-2xl">
        <Icon name="Search" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder={t('explorePage:searchPlaceholder')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 h-10"
        />
      </div>
      
      {/* Bookmarks Section */}
      {bookmarks.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-headline font-semibold border-b pb-2">
            {t('explorePage:bookmarksTitle')}
          </h3>
          {renderBookmarkContent()}
        </div>
      )}
      
      {/* Books Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-headline font-semibold border-b pb-2">
          {t('explorePage:booksTitle')}
        </h3>
        {renderBookContent()}
      </div>
    </div>
  );
}

// ============================================
// SETTINGS VIEW - Refactored
// ============================================

export function SettingsView() {
  const { t } = useTranslation(['settingsPage']);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl md:text-2xl font-headline font-semibold">
          {t('title')}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t('subtitle')}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Icon name="Settings" className="mr-2 h-5 w-5 text-primary" />
            {t('generalCardTitle')}
          </CardTitle>
          <CardDescription>{t('generalCardDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Icon name="Construction" className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{t('moreSettingsComingSoon')}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}