"use client";

import React, { useCallback, useState, useMemo, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Icon } from '@/components/ui/icons';
import { Skeleton } from '@/components/ui/skeleton';
import { useLibrary } from '@/features/library/hooks/useLibrary';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { STATUS_FILTERS } from '@/lib/constants';
import Link from 'next/link';
import type { Book, Piece, OverallStatus } from '@/lib/types';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { LibraryContext } from '../contexts/LibraryContext';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
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
const VocabularyView = dynamic(() => import('@/features/vocabulary/components/vocab/VocabularyView'), { ssr: false });
const AddVocabDialog = dynamic(() => import('@/features/vocabulary/components/dialogs/AddVocabDialog'), { ssr: false });
const AddFolderDialog = dynamic(() => import('@/features/vocabulary/components/dialogs/AddFolderDialog'), { ssr: false });

interface LibraryViewProps {
  contentType: 'book' | 'piece' | 'vocabulary';
}

function LibraryViewContent({ contentType }: LibraryViewProps) {
  const { t } = useTranslation(['libraryPage', 'common', 'vocabularyPage', 'toast']);
  const router = useRouter();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isAddFolderDialogOpen, setIsAddFolderDialogOpen] = useState(false);
  
  const isVocabActive = contentType === 'vocabulary';
  
  // Hooks
  const libraryHook = useLibrary({ 
    contentType: isVocabActive ? undefined : contentType,
    enabled: !isVocabActive,
  });
  
  const vocabularyHook = useVocabulary({ enabled: isVocabActive });
  
  const {
    filteredItems,
    itemToDelete,
    isDeleting,
    handleDelete,
    cancelDelete,
    confirmDelete,
    isLoading,
    loadMoreItems,
    hasMore,
    isLoadingMore,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
  } = libraryHook;

  const { availableBookmarks } = useContext(LibraryContext);

  const handleTabChange = (value: string) => {
    router.push(`/library/${value}`);
  };

  const bookItems = useMemo(() => 
    filteredItems.filter((item): item is Book => 'type' in item && item.type === 'book'), 
    [filteredItems]
  );
  
  const pieceItems = useMemo(() => 
    filteredItems.filter((item): item is Piece => 'type' in item && item.type === 'piece'), 
    [filteredItems]
  );

  // Render Functions
  const renderTabButton = (type: 'book' | 'piece' | 'vocabulary', label: string, artifactClass: string) => (
    <button 
      onClick={() => handleTabChange(type)} 
      className={cn("lib-tab-button", contentType === type && 'active')}
    >
      <div className="lib-tab-content">
        <div className="lib-tab-text">
          <p className="font-semibold text-sm md:text-base">{label}</p>
        </div>
        <div className="lib-tab-artifact-wrapper">
          <div className={cn("lib-tab-artifact", artifactClass)} />
        </div>
      </div>
    </button>
  );

  const renderSearchAndFilters = () => (
    <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
      {/* Search */}
      <div className="relative flex-1">
        <Icon name="Search" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder={isVocabActive ? t('vocabularyPage:searchPlaceholder') : t('searchPlaceholder')}
          value={isVocabActive ? vocabularyHook.searchTerm : searchTerm}
          onChange={(e) => isVocabActive ? vocabularyHook.setSearchTerm(e.target.value) : setSearchTerm(e.target.value)}
          className="font-body pl-9 h-10"
        />
      </div>
      
      {/* Status Filter (only for books/pieces) */}
      {!isVocabActive && (
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as OverallStatus | 'all')}>
          <SelectTrigger className="h-10 w-full sm:w-[180px]">
            <SelectValue placeholder={t('statusFilters.all')} />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map(f => (
              <SelectItem key={f.value} value={f.value}>
                {t(f.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
  
  const renderCreateButton = () => {
    if (contentType === 'book') {
      return (
        <Button asChild className="h-10 w-full sm:w-auto">
          <Link href="/create?mode=book">{t('createNewContentButton')}</Link>
        </Button>
      );
    }
    
    if (contentType === 'piece') {
      return (
        <Button asChild className="h-10 w-full sm:w-auto">
          <Link href="/create?mode=piece">{t('createNewContentButton')}</Link>
        </Button>
      );
    }
    
    if (contentType === 'vocabulary') {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="h-10 w-full sm:w-auto">
              <Icon name="PlusSquare" className="mr-2 h-4 w-4" />
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
      );
    }
    
    return null;
  };

  const renderContent = () => {
    const currentIsLoading = isVocabActive ? vocabularyHook.isLoading : isLoading;

    if (currentIsLoading) {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
          {[...Array(12)].map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] w-full rounded-lg" />
          ))}
        </div>
      );
    }
    
    if (isVocabActive) {
      return <VocabularyView hook={vocabularyHook} />;
    }
    
    if (filteredItems.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Icon name="SearchX" className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-xl font-headline font-medium mb-2">{t('noItemsFound')}</h3>
          <p className="text-muted-foreground font-body max-w-md">{t('noItemsHint')}</p>
        </div>
      );
    }

    return (
      <>
        {contentType === 'book' && (
          <BookmarkStyleProvider items={bookItems} availableBookmarks={availableBookmarks}>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
              <AnimatePresence>
                {bookItems.map((item) => (
                  <motion.div 
                    key={item.id} 
                    layout 
                    initial={{ opacity: 0, scale: 0.9 }} 
                    animate={{ opacity: 1, scale: 1 }} 
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                  >
                    {item.status === 'processing' 
                      ? <ProcessingBookItemCard book={item} onDelete={confirmDelete}/>
                      : <BookItemCard book={item} onDelete={confirmDelete} />
                    }
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </BookmarkStyleProvider>
        )}

        {contentType === 'piece' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
            <AnimatePresence>
              {pieceItems.map((item) => (
                <motion.div 
                  key={item.id} 
                  layout 
                  initial={{ opacity: 0, scale: 0.9 }} 
                  animate={{ opacity: 1, scale: 1 }} 
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                >
                  <PieceItemCard work={item} onDelete={confirmDelete} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Load More Button */}
        {hasMore && !isLoadingMore && filteredItems.length >= 20 && (
          <div className="flex justify-center mt-8">
            <Button 
              variant="outline" 
              onClick={loadMoreItems}
            >
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
      {/* Header with Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
          <h2 className="text-lg md:text-2xl font-headline font-semibold hidden sm:block mr-2">
            {t('library')}
          </h2>
          {renderTabButton('book', t('libraryBookTitle'), 'book-artifact')}
          {renderTabButton('piece', t('libraryPieceTitle'), 'piece-artifact')}
          {renderTabButton('vocabulary', t('vocabTabTitle', { ns: 'vocabularyPage' }), 'vocab-artifact')}
        </div>
        
        {/* Diary Button (Desktop) */}
        <Link href="/diary" className="diary-tab-button hidden sm:flex">
          <div className="lib-tab-content">
            <div className="lib-tab-text">
              <p className="font-semibold text-sm md:text-base">{t('diaryButton')}</p>
            </div>
            <div className="lib-tab-artifact-wrapper">
              <div className="lib-tab-artifact diary-artifact" />
            </div>
          </div>
        </Link>
      </div>

      {/* Search, Filters & Create Button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 bg-card rounded-lg shadow">
        {renderSearchAndFilters()}
        {renderCreateButton()}
      </div>

      {/* Content */}
      <div className="min-h-[400px]">
        {renderContent()}
      </div>
      
      {/* Delete Dialog */}
      {itemToDelete && (
        <AlertDialog open={!!itemToDelete} onOpenChange={(open) => !open && cancelDelete()}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('common:alertDialog.areYouSure')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('common:alertDialog.deleteWarning', { 
                  title: (itemToDelete.title as any).primary || itemToDelete.title[Object.keys(itemToDelete.title)[0]] 
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={cancelDelete} disabled={isDeleting}>
                {t('common:cancel')}
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDelete} 
                disabled={isDeleting}
                className="bg-destructive hover:bg-destructive/90"
              >
                {isDeleting && <Icon name="Loader2" className="mr-2 h-4 w-4 animate-spin" />}
                {t('common:alertDialog.delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      
      {/* Vocabulary Dialogs */}
      <AddVocabDialog
        isOpen={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSuccess={(data) => {
          vocabularyHook.addItem(data);
          setIsAddDialogOpen(false);
        }}
        allFolders={vocabularyHook.folders}
      />
      
      <AddFolderDialog
        isOpen={isAddFolderDialogOpen}
        onOpenChange={setIsAddFolderDialogOpen}
        onSuccess={(folderName) => {
          vocabularyHook.addTransientFolder(folderName);
          setIsAddFolderDialogOpen(false);
        }}
        allFolders={vocabularyHook.folders}
      />
    </div>
  );
}

export default function LibraryView(props: LibraryViewProps) {
  const { availableBookmarks, isLoading: bookmarksLoading } = useBookmarks();
  const libraryHook = useLibrary({ 
    contentType: props.contentType === 'vocabulary' ? undefined : props.contentType, 
    enabled: false 
  });

  const libraryContextValue = useMemo(() => ({
    availableBookmarks,
    onBookmarkChange: libraryHook.handleBookmarkChange,
    onDelete: libraryHook.confirmDelete,
  }), [availableBookmarks, libraryHook.handleBookmarkChange, libraryHook.confirmDelete]);

  if (bookmarksLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
        {[...Array(12)].map((_, i) => (
          <Skeleton key={i} className="aspect-[3/4] w-full rounded-lg" />
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