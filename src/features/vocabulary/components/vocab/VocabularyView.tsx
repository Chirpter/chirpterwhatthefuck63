
"use client";

import React, { useState, useCallback, useMemo, memo, useRef, useEffect } from "react";
import dynamic from 'next/dynamic';
import type { VocabularyItem as VocabItemType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icons";
import Link from "next/link";
import { VocabularyFolderCard } from "./VocabularyFolderCard";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useAudioPlayer } from "@/contexts/audio-player-context";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/useToast";
import type { useVocabulary } from '../../hooks/useVocabulary';
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { VocabularyItemCard } from './VocabularyItemCard';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { resolveFolderForDisplay } from '../../utils/folder.utils';
import { FOLDER_CONSTANTS } from '../../constants';

// Import dialogs statically to prevent UI flash
import AddVocabDialog from '../dialogs/AddVocabDialog';
import EditVocabDialog from '../dialogs/EditVocabDialog';
import DeleteVocabAlert from '../dialogs/DeleteVocabAlert';
import AddFolderDialog from "../dialogs/AddFolderDialog";
import { ViewModeToggle } from "./ViewModeToggle";
import { VocabularyTable } from "./VocabularyTable";

const AddVocabCard = ({ onClick }: { onClick: () => void }) => {
  const { t } = useTranslation('vocabularyPage');
  return (
    <Card 
      onClick={onClick}
      className="flex h-full min-h-[190px] cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 text-muted-foreground transition-all hover:border-primary hover:bg-primary/5 hover:text-primary"
    >
      <div className="text-center">
        <Icon name="Plus" className="mx-auto h-8 w-8" />
        <p className="mt-2 font-semibold">{t('quickAdd.title')}</p>
      </div>
    </Card>
  );
};

const VocabularyGridSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
    <Skeleton className="h-48 w-full" />
    {Array.from({ length: 7 }, (_, i) => (
      <Skeleton key={i} className="h-48 w-full" />
    ))}
  </div>
);

const VocabularyTableSkeleton = () => (
  <div className="space-y-2">
    <Skeleton className="h-12 w-full" />
    {Array.from({ length: 5 }, (_, i) => (
      <Skeleton key={i} className="h-10 w-full" />
    ))}
  </div>
);

const EmptyVocabularyState = ({ t }: { t: (key: string) => string }) => (
  <div className="text-center py-12">
    <Icon name="ListChecks" className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
    <h3 className="text-xl font-headline font-medium mb-2">{t('noVocabularySaved')}</h3>
    <p className="text-muted-foreground font-body">{t('noVocabularyHint')}</p>
  </div>
);

const EmptySearchState = ({ t }: { t: (key: string) => string }) => (
  <div className="text-center py-12">
    <Icon name="SearchX" className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
    <h3 className="text-xl font-headline font-medium mb-2">{t('noMatchingItems')}</h3>
    <p className="text-muted-foreground font-body">{t('noMatchingItemsHint')}</p>
  </div>
);

interface VocabularyViewProps {
  hook: ReturnType<typeof useVocabulary>;
}

export default function VocabularyView({ hook }: VocabularyViewProps) {
  const { t } = useTranslation(['vocabularyPage', 'common', 'toast']);
  const audioPlayer = useAudioPlayer();
  const { toast } = useToast();
  
  const {
    vocabulary,
    isLoading,
    searchTerm,
    folderFilter,
    setFolderFilter,
    folders,
    folderCounts,
    deleteItem,
    error,
    clearError,
    loadMore,
    hasMore,
    addItem,
    addTransientFolder,
  } = hook;

  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [itemToDelete, setItemToDelete] = useState<VocabItemType | null>(null);
  const [itemToEdit, setItemToEdit] = useState<VocabItemType | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  
  const [isAddFolderOpen, setIsAddFolderOpen] = useState(false);
  const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(null);
  const [showScrollButtons, setShowScrollButtons] = useState(false);

  const sentinelRef = useRef<HTMLDivElement>(null);
  
  // Debounced load more function to prevent race conditions
  const debouncedLoadMore = useMemo(() => {
    let timeoutId: NodeJS.Timeout;
    return () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (hasMore && !isLoading) {
          loadMore();
        }
      }, 300); // 300ms debounce
    };
  }, [hasMore, isLoading, loadMore]);

  // Fixed useEffect for infinite scroll with proper cleanup
  useEffect(() => {
    if (!sentinelRef.current) return;
    
    const currentSentinel = sentinelRef.current; // Capture in closure
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          debouncedLoadMore();
        }
      },
      { threshold: 0.1, rootMargin: '50px' }
    );
    
    observer.observe(currentSentinel);
    
    return () => {
      observer.unobserve(currentSentinel);
      observer.disconnect(); // Also disconnect the observer
    };
  }, [debouncedLoadMore]);

  const handleEditSuccess = useCallback((updatedItem: VocabItemType) => {
    setItemToEdit(null);
  }, []);

  const handleDeleteSuccess = useCallback(() => {
    if (itemToDelete) {
      deleteItem(itemToDelete.id);
      setItemToDelete(null);
    }
  }, [itemToDelete, deleteItem]);

  const handleAddSuccess = useCallback(async (itemData: any) => {
    try {
      // Manually added items get the 'manual' context
      await addItem({ ...itemData, context: 'manual' });
      setIsAddDialogOpen(false);
      toast({ 
        title: t('toast:vocabAddedTitle'), 
        description: t('toast:vocabAddedDesc', { term: itemData.term }) 
      });
    } catch (error: any) {
      toast({ 
        title: t('common:error'), 
        description: t('toast:addErrorDesc'), 
        variant: "destructive" 
      });
    }
  }, [addItem, toast, t]);

  const handleAddFolderSuccess = useCallback((newFolderName: string) => {
    addTransientFolder(newFolderName);
    setFolderFilter(newFolderName);
    setIsAddFolderOpen(false);
  }, [addTransientFolder, setFolderFilter]);

  const handlePronounce = useCallback((term: string, lang?: string) => {
    audioPlayer.speakTextSnippet(term, lang || 'en');
  }, [audioPlayer]);
  
  const handleScroll = useCallback((direction: 'left' | 'right') => {
    if (scrollContainer) {
      const scrollAmount = scrollContainer.clientWidth * 0.8;
      scrollContainer.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  }, [scrollContainer]);
  
  // Fixed useEffect for scroll container with proper cleanup
  useEffect(() => {
    const currentContainer = scrollContainer; // Capture in closure
    if (!currentContainer) return;

    const checkOverflow = () => {
      setShowScrollButtons(currentContainer.scrollWidth > currentContainer.clientWidth);
    };

    checkOverflow();
    const resizeObserver = new ResizeObserver(checkOverflow);
    resizeObserver.observe(currentContainer);
    
    return () => {
      resizeObserver.unobserve(currentContainer);
      resizeObserver.disconnect(); // Properly cleanup
    };
  }, [scrollContainer]);

  // Updated currentHeader with FOLDER_CONSTANTS
  const currentHeader = useMemo(() => {
    if (searchTerm) return t('common:searchResultFor', { term: searchTerm });
    if (folderFilter === FOLDER_CONSTANTS.UNORGANIZED) return t('common:unorganized');
    return folderFilter;
  }, [folderFilter, searchTerm, t]);

  const getFolderItemCount = useCallback((folder: string): number => {
    return (folderCounts as Record<string, number>)?.[folder] ?? 0;
  }, [folderCounts]);

  // Updated folder filter logic with FOLDER_CONSTANTS
  const showAddCard = useMemo(() => 
    viewMode === 'card' && 
    folderFilter !== FOLDER_CONSTANTS.UNORGANIZED && 
    !searchTerm
  , [viewMode, folderFilter, searchTerm]);

  const renderContent = () => {
    if (isLoading && vocabulary.length === 0) {
      return viewMode === 'card' ? <VocabularyGridSkeleton /> : <VocabularyTableSkeleton />;
    }
    
    if (vocabulary.length === 0 && folderFilter === FOLDER_CONSTANTS.UNORGANIZED && !searchTerm) {
      return <EmptyVocabularyState t={t} />;
    }
    
    if (vocabulary.length === 0 && !showAddCard) {
      return <EmptySearchState t={t} />;
    }

    if (vocabulary.length === 0 && showAddCard) {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <AddVocabCard onClick={() => setIsAddDialogOpen(true)} />
        </div>
      );
    }

    return (
      <>
        {viewMode === 'card' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {showAddCard && (
              <AddVocabCard onClick={() => setIsAddDialogOpen(true)} />
            )}
            {vocabulary.map(item => (
                <VocabularyItemCard
                    key={item.id}
                    item={item}
                    onPronounce={handlePronounce}
                    onEdit={setItemToEdit}
                    onDelete={setItemToDelete}
                />
            ))}
          </div>
        ) : (
          <VocabularyTable
            items={vocabulary}
            onPronounce={handlePronounce}
            onEdit={setItemToEdit}
            onDelete={setItemToDelete}
          />
        )}
        
        {hasMore && <div ref={sentinelRef} className="h-4" />}
        
        {isLoading && vocabulary.length > 0 && (
          <div className="flex justify-center py-4">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        )}
      </>
    );
  };

  if (error) {
    return (
      <div className="text-center py-12">
        <Icon name="AlertCircle" className="mx-auto h-16 w-16 text-destructive mb-4" />
        <h3 className="text-xl font-headline font-medium mb-2">Error Loading Vocabulary</h3>
        <p className="text-muted-foreground font-body">{error.message}</p>
        <Button onClick={clearError} className="mt-4">Try Again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-headline font-semibold">{t('foldersTitle')}</h3>
          <Button asChild variant="outline" size="sm">
            <Link href="/library/vocabulary/flashcard-dashboard">
              {t('flashcardsButton')} <Icon name="ChevronRight" className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {/* Updated to use FOLDER_CONSTANTS.UNORGANIZED */}
          <VocabularyFolderCard
            folderName={t('common:unorganized')}
            itemCount={getFolderItemCount(FOLDER_CONSTANTS.UNORGANIZED)}
            onClick={() => setFolderFilter(FOLDER_CONSTANTS.UNORGANIZED)}
            onDirectPlay={() => audioPlayer.playVocabFolder(FOLDER_CONSTANTS.UNORGANIZED, t('common:unorganized'))}
            onPlaylistAdd={() => audioPlayer.addVocabFolderToPlaylist(FOLDER_CONSTANTS.UNORGANIZED, t('common:unorganized'))}
            isSelected={folderFilter === FOLDER_CONSTANTS.UNORGANIZED && !searchTerm}
            isPlaying={audioPlayer.currentPlayingItem?.itemId === FOLDER_CONSTANTS.UNORGANIZED && audioPlayer.isPlaying}
            isUncategorized={true}
          />
          
          <Separator orientation="vertical" className="h-10" />
          
          <div className="relative flex-1 min-w-0">
            <div 
              ref={setScrollContainer}
              className="flex items-center overflow-x-auto space-x-2 p-2 scrollbar-hide"
            >
              {hook.folders.map(folder => (
                <VocabularyFolderCard
                  key={folder}
                  folderName={folder}
                  itemCount={getFolderItemCount(folder)}
                  onClick={() => setFolderFilter(folder)}
                  onDirectPlay={() => audioPlayer.playVocabFolder(folder, folder)}
                  onPlaylistAdd={() => audioPlayer.addVocabFolderToPlaylist(folder, folder)}
                  isSelected={folderFilter === folder && !searchTerm}
                  isPlaying={audioPlayer.currentPlayingItem?.itemId === folder && audioPlayer.isPlaying}
                />
              ))}
            </div>
            {showScrollButtons && (
              <>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => handleScroll('left')}
                  className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full h-9 w-9 z-10 bg-background/80 backdrop-blur-sm shadow-md"
                >
                  <Icon name="ChevronLeft" className="h-5 w-5" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => handleScroll('right')}
                  className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full h-9 w-9 z-10 bg-background/80 backdrop-blur-sm shadow-md"
                >
                  <Icon name="ChevronRight" className="h-5 w-5" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <Separator className="my-8" />

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-headline font-semibold">{currentHeader}</h3>
          <ViewModeToggle viewMode={viewMode} setViewMode={setViewMode} />
        </div>
        {renderContent()}
      </div>

      <AddVocabDialog
        isOpen={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSuccess={handleAddSuccess}
        allFolders={hook.folders}
        // Updated to use FOLDER_CONSTANTS.UNORGANIZED
        initialFolder={folderFilter !== FOLDER_CONSTANTS.UNORGANIZED ? folderFilter : undefined}
      />
      
      {itemToEdit && (
        <EditVocabDialog
          isOpen={!!itemToEdit}
          onOpenChange={() => setItemToEdit(null)}
          item={itemToEdit}
          onSuccess={handleEditSuccess}
          allFolders={hook.folders}
        />
      )}
      
      {itemToDelete && (
        <DeleteVocabAlert
          isOpen={!!itemToDelete}
          onOpenChange={() => setItemToDelete(null)}
          item={itemToDelete}
          onSuccess={handleDeleteSuccess}
        />
      )}
    </div>
  );
}
