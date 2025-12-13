// src/features/library/components/LibraryView.tsx
"use client";

import React, { useCallback, lazy, Suspense, useState, useEffect, useMemo, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Icon } from '@/components/ui/icons';
import { Skeleton } from '@/components/ui/skeleton';
import { useLibrary } from '@/features/library/hooks/useLibrary';
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
import { STATUS_FILTERS } from '@/lib/constants';
import Link from 'next/link';
import type { LibraryItem, Book, Piece, VocabularyItem, BookmarkType, OverallStatus, CombinedBookmark } from '@/lib/types';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { LibraryContext } from '../contexts/LibraryContext';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useToast } from '@/hooks/useToast';
import { useVocabulary } from '@/features/vocabulary/hooks/useVocabulary';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { BookmarkStyleProvider } from './BookmarkStyleProvider';
import { useBookmarks } from '@/contexts/bookmark-context';


// Lazy load components
const BookItemCard = dynamic(() => import('./BookItemCard').then(mod => mod.BookItemCard), {
    loading: () => <Skeleton className="h-80 w-full" />,
});
const PieceItemCard = dynamic(() => import('./PieceItemCard').then(mod => mod.PieceItemCard), {
    loading: () => <Skeleton className="h-64 w-full" />,
});
const ProcessingBookItemCard = dynamic(() => import('./ProcessingBookItemCard').then(mod => mod.ProcessingBookItemCard), {
    loading: () => <Skeleton className="h-80 w-full" />,
});
const AddVocabDialog = dynamic(() => import('@/features/vocabulary/components/dialogs/AddVocabDialog'), { ssr: false });
const AddFolderDialog = dynamic(() => import('@/features/vocabulary/components/dialogs/AddFolderDialog'), { ssr: false });
const VocabularyView = dynamic(() => import('@/features/vocabulary/components/vocab/VocabularyView'), { ssr: false });

interface LibraryViewProps {
  contentType: 'book' | 'piece' | 'vocabulary';
}

const INITIAL_LOAD_THRESHOLD = 20;

function LibraryViewContent({ contentType }: LibraryViewProps) {
  const { t } = useTranslation(['libraryPage', 'common', 'bookCard', 'vocabularyPage', 'toast', 'presets']);
  const router = useRouter();
  const { toast } = useToast();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isAddFolderDialogOpen, setIsAddFolderDialogOpen] = useState(false);
  
  const isVocabActive = contentType === 'vocabulary';
  
  // Conditionally call hooks based on content type
  const libraryHook = useLibrary({ 
      contentType: isVocabActive ? undefined : contentType,
      enabled: !isVocabActive,
  });
  
  const vocabularyHook = useVocabulary({ enabled: isVocabActive });
  
  // Use the correct hook based on the content type
  const {
    filteredItems,
    itemToDelete,
    isDeleting,
    handleDelete,
    cancelDelete,
    confirmDelete,
    isLoading: isLibraryLoading,
    loadMoreItems: loadMoreLibrary,
    hasMore: hasMoreLibrary,
    isLoadingMore: isLoadingMoreLibrary,
  } = libraryHook;

  const { availableBookmarks } = useContext(LibraryContext);

  const handleTabChange = (value: string) => {
    router.push(`/library/${value}`);
  };

  const handleAddFolderSuccess = useCallback((newFolderName: string) => {
    vocabularyHook.addTransientFolder(newFolderName);
    vocabularyHook.setFolderFilter(newFolderName);
    setIsAddFolderDialogOpen(false);
  }, [vocabularyHook]);

  const handleAddVocabSuccess = useCallback(async (newItemData: Omit<VocabularyItem, 'id' | 'userId' | 'createdAt' | 'srsState' | 'memoryStrength' | 'streak' | 'attempts' | 'lastReviewed' | 'dueDate'>) => {
    try {
      await vocabularyHook.addItem(newItemData);
      setIsAddDialogOpen(false);
      toast({ title: t('toast:addSuccessTitle'), description: t('toast:addSuccessDesc', { term: newItemData.term }) });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add vocabulary item",
        variant: "destructive"
      });
    }
  }, [vocabularyHook, toast, t]);

  const renderSearchAndFilters = () => {
    const setSearchTerm = isVocabActive ? vocabularyHook.setSearchTerm : libraryHook.setSearchTerm;
    const searchTerm = isVocabActive ? vocabularyHook.searchTerm : libraryHook.searchTerm;
    
    const setStatusFilter = isVocabActive ? () => {} : (value: string) => libraryHook.setStatusFilter(value as OverallStatus | 'all');
    const statusFilter = isVocabActive ? 'all' : libraryHook.statusFilter;

    return (
      <div className="flex-grow flex flex-col md:flex-row items-center gap-2">
        <div className="relative flex-grow w-full">
          <Icon name="Search" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={isVocabActive ? t('vocabularyPage:searchPlaceholder') : t('searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="font-body pl-9 h-10"
            aria-label={t('searchPlaceholderAria')}
          />
        </div>
        {!isVocabActive && (
             <div className="flex w-full md:w-auto items-center gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-10 w-full" aria-label={t('statusFilters.all')}>
                    <SelectValue placeholder={t('statusFilters.all')} />
                    </SelectTrigger>
                    <SelectContent>
                    {STATUS_FILTERS.map(f => <SelectItem key={f.value} value={f.value}>{t(f.labelKey)}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
        )}
      </div>
    );
  };
  
  const renderCreateButton = () => {
    if (contentType === 'book') {
        return <Button asChild className="font-body h-10 w-full md:w-auto"><Link href="/create?mode=book">{t('createNewContentButton')}</Link></Button>
    }
    if (contentType === 'piece') {
        return <Button asChild className="font-body h-10 w-full md:w-auto"><Link href="/create?mode=piece">{t('createNewContentButton')}</Link></Button>
    }
    if (contentType === 'vocabulary') {
        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button className="font-body h-10 w-full md:w-auto">
                        <Icon name="PlusSquare" className="mr-2 h-5 w-5" />
                        {t('vocabularyPage:addNewTermButton')}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setIsAddDialogOpen(true)}>
                        <Icon name="ListChecks" className="mr-2 h-4 w-4" />
                        {t('vocabularyPage:addVocabDialog.title')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setIsAddFolderDialogOpen(true)}>
                        <Icon name="FolderPlus" className="mr-2 h-4 w-4" />
                        {t('vocabularyPage:addFolderDialog.title')}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        )
    }
    return null;
  }

  const renderContent = () => {
    const isLoading = isVocabActive ? vocabularyHook.isLoading : isLibraryLoading;

    if (isLoading) {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
          {[...Array(6)].map((_, i) => (
             <div key={i} className="bg-card p-4 rounded-lg shadow-md animate-pulse">
                <Skeleton className="h-48 bg-muted rounded-md mb-4" />
                <Skeleton className="h-6 w-3/4 bg-muted rounded-md mb-2" />
            </div>
          ))}
        </div>
      );
    }
    
    if (isVocabActive) {
      return <VocabularyView hook={vocabularyHook} />;
    }
    
    if (filteredItems.length === 0) {
      return (
        <div className="text-center py-12">
          <Icon name="SearchX" className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-xl font-headline font-medium mb-2">{t('noItemsFound')}</h3>
          <p className="text-muted-foreground font-body">{t('noItemsHint')}</p>
        </div>
      );
    }
    
    const shouldShowLoadMore = filteredItems.length >= INITIAL_LOAD_THRESHOLD && hasMoreLibrary;

    const bookItems = filteredItems.filter(item => item.type === 'book') as Book[];
    const pieceItems = filteredItems.filter(item => item.type === 'piece') as Piece[];

    return (
      <>
        {contentType === 'book' && (
           <BookmarkStyleProvider items={bookItems} availableBookmarks={availableBookmarks}>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
                <AnimatePresence>
                  {bookItems.map((item) => (
                      <motion.div key={item.id} layout animate={{ opacity: 1 }} initial={{ opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                          {item.status === 'processing' 
                            ? <ProcessingBookItemCard book={item} onDelete={confirmDelete}/>
                            : <BookItemCard book={item} />
                          }
                      </motion.div>
                  ))}
                </AnimatePresence>
              </div>
           </BookmarkStyleProvider>
        )}

        {contentType === 'piece' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
              <AnimatePresence>
                {pieceItems.map((item) => (
                    <motion.div key={item.id} layout animate={{ opacity: 1 }} initial={{ opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                        <PieceItemCard work={item} />
                    </motion.div>
                ))}
              </AnimatePresence>
          </div>
        )}

        {shouldShowLoadMore && !isLoadingMoreLibrary && (
          <div className="text-center mt-8">
            <Button 
              variant="link" 
              onClick={loadMoreLibrary} 
              className="text-muted-foreground hover:text-primary"
            >
              {t('common:loadMore')}
              <Icon name="ChevronDown" className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}
        {isLoadingMoreLibrary && (
          <div className="text-center mt-8">
            <Icon name="Loader2" className="h-6 w-6 animate-spin text-primary mx-auto" />
          </div>
        )}
      </>
    );
  };

  return (
    <div>
      <AddVocabDialog
        isOpen={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSuccess={handleAddVocabSuccess}
        allFolders={vocabularyHook.folders}
        initialFolder={vocabularyHook.folderFilter !== 'unorganized' ? vocabularyHook.folderFilter : undefined}
      />
       <AddFolderDialog
        isOpen={isAddFolderDialogOpen}
        onOpenChange={setIsAddFolderDialogOpen}
        onSuccess={handleAddFolderSuccess}
        allFolders={vocabularyHook.folders}
      />
      <div>
        <div className="flex justify-between items-center gap-4">
            <div className="flex items-center gap-4">
                <h2 className="text-xl md:text-2xl font-headline font-semibold">{t('library')}</h2>
                <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleTabChange('book')} 
                      className={cn("lib-tab-button", contentType === 'book' && 'active')}
                    >
                      <div className="lib-tab-content">
                          <div className="lib-tab-text"><p className="font-semibold">{t('libraryBookTitle')}</p></div>
                          <div className="lib-tab-artifact-wrapper"><div className="lib-tab-artifact book-artifact" /></div>
                      </div>
                    </button>
                    <button 
                      onClick={() => handleTabChange('piece')} 
                      className={cn("lib-tab-button", contentType === 'piece' && 'active')}
                    >
                      <div className="lib-tab-content">
                          <div className="lib-tab-text"><p className="font-semibold">{t('libraryPieceTitle')}</p></div>
                          <div className="lib-tab-artifact-wrapper"><div className="lib-tab-artifact piece-artifact" /></div>
                      </div>
                    </button>
                    <button 
                      onClick={() => handleTabChange('vocabulary')}
                      className={cn("lib-tab-button", contentType === 'vocabulary' && 'active')}
                    >
                       <div className="lib-tab-content">
                          <div className="lib-tab-text"><p className="font-semibold">{t('vocabTabTitle', { ns: 'vocabularyPage' })}</p></div>
                          <div className="lib-tab-artifact-wrapper"><div className="lib-tab-artifact vocab-artifact" /></div>
                      </div>
                    </button>
                </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/diary" className="diary-tab-button">
                <div className="lib-tab-content">
                    <div className="lib-tab-text"><p className="font-semibold">{t('diaryButton')}</p></div>
                    <div className="lib-tab-artifact-wrapper"><div className="lib-tab-artifact diary-artifact" /></div>
                </div>
              </Link>
            </div>
        </div>

        <div className="mt-4 p-2 bg-card rounded-lg shadow flex flex-col md:flex-row items-center gap-2">
            {renderSearchAndFilters()}
            {renderCreateButton()}
        </div>

        <div className="mt-6">
            {renderContent()}
        </div>
        
        {itemToDelete && (
          <Suspense fallback={null}>
            <AlertDialog open={!!itemToDelete} onOpenChange={(open) => { if (!open) cancelDelete(); }}>
              <AlertDialogContent className="font-body">
                <AlertDialogHeader>
                  <AlertDialogTitle className="font-headline">{t('common:alertDialog.areYouSure')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('common:alertDialog.deleteWarning', { title: (itemToDelete.title as any).primary || itemToDelete.title[Object.keys(itemToDelete.title)[0]] })}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={cancelDelete} disabled={isDeleting}>{t('common:cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                    {isDeleting && <Icon name="Wand2" className="mr-2 h-4 w-4 animate-pulse" />}
                    {t('common:alertDialog.delete')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </Suspense>
        )}
      </div>
    </div>
  );
}

export default function LibraryView(props: LibraryViewProps) {
  const { availableBookmarks, isLoading: bookmarksLoading } = useBookmarks();
  const libraryHook = useLibrary({ contentType: props.contentType, enabled: false });

  const libraryContextValue = useMemo(() => ({
    availableBookmarks,
    onBookmarkChange: libraryHook.handleBookmarkChange,
    onDelete: libraryHook.confirmDelete,
  }), [availableBookmarks, libraryHook.handleBookmarkChange, libraryHook.confirmDelete]);

  if (bookmarksLoading) {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6 mt-6">
          {[...Array(6)].map((_, i) => (
             <div key={i} className="bg-card p-4 rounded-lg shadow-md animate-pulse">
                <Skeleton className="h-48 bg-muted rounded-md mb-4" />
                <Skeleton className="h-6 w-3/4 bg-muted rounded-md mb-2" />
            </div>
          ))}
        </div>
      );
  }

  return (
    <LibraryContext.Provider value={libraryContextValue}>
      <LibraryViewContent {...props} />
    </LibraryContext.Provider>
  );
}
