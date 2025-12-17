
"use client";

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/useToast';
import { useUser } from '@/contexts/user-context';
import { useRouter } from 'next/navigation';
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
import { Icon, type IconName } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { purchaseGlobalItem } from '@/services/server/user-service';
import type { Book, CombinedBookmark } from '@/lib/types';
import { useShop } from '@/features/shop/hooks/useShop';
import { BookItemCard } from '@/features/library/components/BookItemCard';
import { BookmarkCard } from '@/features/user/components/BookmarkCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { CreditIcon } from "@/components/ui/CreditIcon";

type PurchasableItem = (Book & { itemType: 'book' }) | (CombinedBookmark & { itemType: 'bookmark' });

// NEW: A component for credit packs or special bundles
const ProductCard: React.FC<{ title: string, description: string, price: string, icon: IconName, onPurchase: () => void }> = ({ title, description, price, icon, onPurchase }) => (
    <Card className="flex flex-col">
        <CardHeader className="items-center text-center">
            <div className="h-16 w-16 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground mb-2">
                <CreditIcon className="h-8 w-8" />
            </div>
            <CardTitle className="font-headline text-xl">{title}</CardTitle>
        </CardHeader>
        <CardContent className="text-center text-muted-foreground text-sm flex-grow">
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
  const router = useRouter();
  
  const { items, isLoading, isLoadingMore, hasMore, loadMoreItems, creditPacks } = useShop();

  const [itemToPurchase, setItemToPurchase] = useState<PurchasableItem | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const ownedBookmarkIds = new Set(user?.ownedBookmarkIds || []);
  const ownedBookIds = new Set(user?.purchasedBookIds || []);

  const handlePurchaseClick = (item: PurchasableItem) => {
    if (!user) {
      toast({ title: t('error'), description: t('authRequired'), variant: 'destructive' });
      return;
    }
    if (user.credits < (item.price || 0)) {
      toast({ title: t('insufficientCreditsTitle'), description: t('insufficientCreditsDesc'), variant: 'destructive' });
      return;
    }
    setItemToPurchase(item);
  };

  const confirmPurchase = async () => {
    if (!user || !itemToPurchase) return;

    setIsPurchasing(true);
    try {
      const title = (itemToPurchase.itemType === 'book' ? itemToPurchase.title[itemToPurchase.origin.split('-')[0]] : itemToPurchase.name) || 'item';
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
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="bg-card p-4 rounded-lg shadow-md animate-pulse">
          <Skeleton className="h-48 bg-muted rounded-md mb-4" />
          <Skeleton className="h-6 w-3/4 bg-muted rounded-md mb-2" />
          <Skeleton className="h-4 w-1/2 bg-muted rounded-md mb-4" />
          <Skeleton className="h-8 w-full bg-muted rounded-md" />
        </div>
      ))}
    </div>
  );

  const renderCreditPacks = () => {
      if (isLoading) {
          return (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-64" />)}
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
                    price={`${pack.priceUsd.toFixed(2)}`}
                    icon={"Sparkles"}
                    onPurchase={() => toast({ title: t('common:comingSoon'), description: t('shopPage:iapComingSoon') })}
                  />
              ))}
          </div>
      );
  };

  const renderItemsContent = () => {
    if (isLoading && items.length === 0) return renderSkeleton();
    
    const unownedItems = items.filter(item => {
        if (item.itemType === 'book') {
            return !ownedBookIds.has(item.id);
        }
        if (item.itemType === 'bookmark') {
            return !ownedBookmarkIds.has(item.id);
        }
        return true;
    });

    if (unownedItems.length === 0) {
      return (
        <div className="text-center py-12">
          <Icon name="Store" className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-xl font-headline font-medium mb-2">{t('shopPage:emptyShopTitle')}</h3>
          <p className="text-muted-foreground font-body">{t('shopPage:emptyShopHint')}</p>
        </div>
      );
    }

    return (
      <>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
          {unownedItems.map((item) => (
              item.itemType === 'book' ? (
                  <BookItemCard key={item.id} book={item} onPurchase={() => handlePurchaseClick(item)} />
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
            <div className="text-center mt-8">
              <Button onClick={loadMoreItems} disabled={isLoadingMore}>
                {isLoadingMore && <Icon name="Loader2" className="mr-2 h-4 w-4 animate-spin" />}
                {t('common:loadMore')}
              </Button>
            </div>
          )}
      </>
    );
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl md:text-2xl font-headline font-semibold">{t('shopPage:pageTitle')}</h2>
      
       <Tabs defaultValue="items" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-sm">
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


      {itemToPurchase && (
        <AlertDialog open={!!itemToPurchase} onOpenChange={(open) => !open && setItemToPurchase(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="font-headline">{t('shopPage:confirmPurchaseTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('shopPage:confirmPurchaseDesc', { title: itemToPurchase.name || (itemToPurchase as Book).title[(itemToPurchase as Book).origin.split('-')[0]], price: itemToPurchase.price })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setItemToPurchase(null)} disabled={isPurchasing}>{t('common:cancel')}</AlertDialogCancel>
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
