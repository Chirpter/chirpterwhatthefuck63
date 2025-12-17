

"use client";

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useVocabulary } from '@/features/vocabulary/hooks/useVocabulary';
import { CardHeader, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Icon } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { VocabularyItemCard } from '@/features/vocabulary/components/vocab/VocabularyItemCard';
import { useAudioPlayer } from '@/contexts/audio-player-context';
import { useUser } from '@/contexts/user-context';
import type { VocabularyItem } from '@/lib/types';
import EditVocabDialog from '@/features/vocabulary/components/dialogs/EditVocabDialog';
import DeleteVocabAlert from '@/features/vocabulary/components/dialogs/DeleteVocabAlert';
import { useToast } from '@/hooks/useToast';
import { VocabularyFolderCard } from '@/features/vocabulary/components/vocab/VocabularyFolderCard';
import { Separator } from '@/components/ui/separator';
import { Flashcard } from '@/features/vocabulary/components/flashcards/Flashcard';
import { AnimatePresence } from 'framer-motion';
import * as srsService from "@/services/client/srs.service";
import AddVocabDialog from '@/features/vocabulary/components/dialogs/AddVocabDialog';
import AddFolderDialog from '@/features/vocabulary/components/dialogs/AddFolderDialog';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FOLDER_CONSTANTS } from '@/features/vocabulary/constants';

const trackDailyProgress = (itemId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const key = `chirpter_vocab_progress_${today}`;
    try {
        const progressStr = localStorage.getItem(key);
        const reviewedIds = progressStr ? JSON.parse(progressStr) : [];
        if (Array.isArray(reviewedIds) && !reviewedIds.includes(itemId)) {
            reviewedIds.push(itemId);
            localStorage.setItem(key, JSON.stringify(reviewedIds));
        }
    } catch (e) {
        console.error("Failed to track daily progress", e);
    }
};

const VocabularyGridSkeleton = React.memo(() => (
  <div className="grid grid-cols-2 gap-2 p-2">
    {Array.from({ length: 4 }, (_, i) => (
      <Skeleton key={i} className="h-32 w-full" />
    ))}
  </div>
));
VocabularyGridSkeleton.displayName = "VocabularyGridSkeleton";

export const MiniVocabView: React.FC = () => {
    const { t } = useTranslation(['learningPage', 'common', 'vocabularyPage', 'toast']);
    const { toast } = useToast();
    const audioPlayer = useAudioPlayer();
    const { user } = useUser();
    
    const [mode, setMode] = useState<'vocab' | 'flashcard'>('vocab');
    const [itemToEdit, setItemToEdit] = useState<VocabularyItem | null>(null);
    const [itemToDelete, setItemToDelete] = useState<VocabularyItem | null>(null);
    const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(null);
    const [showScrollButtons, setShowScrollButtons] = useState(false);
    const [isAddVocabOpen, setIsAddVocabOpen] = useState(false);
    const [isAddFolderOpen, setIsAddFolderOpen] = useState(false);
    
    const { 
        vocabulary, 
        isLoading, 
        folders, 
        folderCounts,
        setFolderFilter,
        folderFilter,
        hasMore,
        loadMore,
        deleteItem,
        addItem,
        addTransientFolder,
    } = useVocabulary({ 
        enabled: true, 
        initialFolder: FOLDER_CONSTANTS.UNORGANIZED,
        scope: 'local',
        context: 'vocab-videos',
    });

    // --- FLASHCARD STATE ---
    const [sessionCards, setSessionCards] = useState<VocabularyItem[]>([]);
    const [isAnimating, setIsAnimating] = useState(false);
    const activeIndex = useMemo(() => sessionCards.length - 1, [sessionCards]);
    const topCard = useMemo(() => sessionCards[activeIndex], [sessionCards, activeIndex]);

    // Initialize flashcard session when mode changes
    useEffect(() => {
        if (mode === 'flashcard') {
            const cardsForSession = vocabulary.filter(card => !['long-term'].includes(card.srsState));
            setSessionCards(cardsForSession.sort(() => Math.random() - 0.5));
        }
    }, [mode, vocabulary]);

    // FIXED: Handle flashcard actions - Update SRS BEFORE animation
    const handleFlashcardAction = useCallback(async (
        action: 'remembered' | 'forgot' | 'tested_correct' | 'tested_incorrect'
    ) => {
        if (!user || activeIndex < 0 || isAnimating) return;
        
        const swipedCard = sessionCards[activeIndex];
        const cardIndex = activeIndex; // Capture index for safe removal
        setIsAnimating(true);
        
        try {
            // FIXED: Update SRS FIRST (before removing from UI)
            await srsService.updateSrsItem(user, swipedCard.id, action);
            trackDailyProgress(swipedCard.id);
            
            // SUCCESS: Now animate and remove card
            setTimeout(() => {
                setSessionCards(prev => prev.filter((_, i) => i !== cardIndex));
                setIsAnimating(false);
            }, 300);
            
        } catch (error) {
            // FIXED: If SRS update fails, just stop animation, keep card in place
            console.error("Failed to update SRS:", error);
            setIsAnimating(false);
            
            toast({ 
                title: t('toast:syncErrorTitle'), 
                description: t('toast:syncErrorDesc'), 
                variant: "destructive" 
            });
            
            // Card stays in sessionCards, user can try again
        }
    }, [user, activeIndex, sessionCards, isAnimating, toast, t]);

    // --- END FLASHCARD STATE ---
    
    const sentinelRef = useRef<HTMLDivElement>(null);
    
    // Infinite scroll observer
    useEffect(() => {
        if (!sentinelRef.current || mode !== 'vocab') return;
        
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !isLoading) {
                    loadMore();
                }
            },
            { threshold: 0.1, rootMargin: '50px' }
        );
        
        observer.observe(sentinelRef.current);
        return () => observer.disconnect();
    }, [hasMore, isLoading, loadMore, mode]);
    
    const handleEditSuccess = useCallback(() => { 
        setItemToEdit(null); 
        toast({ title: t('toast:vocabUpdatedTitle') }); 
    }, [t, toast]);
    
    const handleDeleteSuccess = useCallback(() => { 
        if (itemToDelete) {
          deleteItem(itemToDelete.id);
          setItemToDelete(null); 
          toast({ title: t('toast:deleteSuccessTitle') }); 
        }
    }, [itemToDelete, deleteItem, t, toast]);

    const handleAddFolderSuccess = useCallback((newFolderName: string) => {
        addTransientFolder(newFolderName);
        setFolderFilter(newFolderName);
        setIsAddFolderOpen(false);
    }, [addTransientFolder, setFolderFilter]);

    const handleAddVocabSuccess = useCallback(async (newItemData: Omit<VocabularyItem, 'id' | 'userId' | 'createdAt' | 'srsState' | 'memoryStrength' | 'streak' | 'attempts' | 'lastReviewed' | 'dueDate'>) => {
        try {
            // This hook is specifically for 'vocab-videos', so we enforce the context.
            const addedItem = await addItem({ ...newItemData, context: 'vocab-videos' });
            setIsAddVocabOpen(false);
            toast({ 
                title: t('toast:addSuccessTitle'), 
                description: t('toast:addSuccessDesc', { term: newItemData.term }) 
            });
            
            if(addedItem.folder && addedItem.folder !== folderFilter) {
                setFolderFilter(addedItem.folder);
            }
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Failed to add vocabulary item",
                variant: "destructive"
            });
        }
    }, [addItem, toast, t, folderFilter, setFolderFilter]);

    const handlePronounce = useCallback((term: string, lang?: string) => {
        audioPlayer.speakTextSnippet(term, lang || 'en');
    }, [audioPlayer]);
    
    const handleScroll = useCallback((direction: 'left' | 'right') => {
        if (scrollContainer) {
            const scrollAmount = scrollContainer.clientWidth * 0.7;
            scrollContainer.scrollBy({ 
                left: direction === 'left' ? -scrollAmount : scrollAmount, 
                behavior: 'smooth' 
            });
        }
    }, [scrollContainer]);

    // Check if folders overflow
    useEffect(() => {
        const checkOverflow = () => {
          if (scrollContainer) {
              setShowScrollButtons(scrollContainer.scrollWidth > scrollContainer.clientWidth);
          }
        };
        
        checkOverflow();
        const resizeObserver = new ResizeObserver(checkOverflow);
        if (scrollContainer) resizeObserver.observe(scrollContainer);
        
        return () => { 
            if (scrollContainer) resizeObserver.unobserve(scrollContainer);
        };
    }, [scrollContainer, folders]);
    
    const foldersToDisplay = useMemo(() => {
        const folderSet = new Set(folders);
        if (!folderSet.has(FOLDER_CONSTANTS.UNORGANIZED)) {
            return [FOLDER_CONSTANTS.UNORGANIZED, ...folders];
        }
        return folders;
    }, [folders]);

    const renderVocabContent = () => {
        if (isLoading && vocabulary.length === 0) {
            return <VocabularyGridSkeleton />;
        }
        
        if (vocabulary.length === 0) {
            return (
                <div className="text-center text-sm text-muted-foreground h-full flex flex-col items-center justify-center p-4">
                    <Icon name="Inbox" className="h-8 w-8 mb-2" />
                    <p>{t('miniVocab.noItemsInFolder')}</p>
                </div>
            );
        }
        
        return (
            <div className="grid grid-cols-2 gap-2 p-2">
                {vocabulary.map(item => (
                    <VocabularyItemCard 
                        key={item.id}
                        item={item as VocabularyItem} 
                        onPronounce={handlePronounce} 
                        onEdit={setItemToEdit} 
                        onDelete={setItemToDelete} 
                        isLite={true}
                    />
                ))}
                {hasMore && <div ref={sentinelRef} className="h-4 col-span-2" />}
                {isLoading && vocabulary.length > 0 && (
                    <div className="flex justify-center py-4 col-span-2">
                        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                    </div>
                )}
            </div>
        );
    };

    const renderFolderSection = () => (
        <>
            <div className="px-2 pt-2">
                <div className="relative flex-1 min-w-0">
                    <div 
                        ref={setScrollContainer} 
                        className="flex items-center overflow-x-auto space-x-0.5 pb-2 scrollbar-hide"
                    >
                        {foldersToDisplay.map(folder => (
                            <VocabularyFolderCard
                                key={folder}
                                folderName={folder}
                                itemCount={(folderCounts as Record<string, number>)?.[folder] || 0}
                                onClick={() => setFolderFilter(folder)}
                                onDirectPlay={() => audioPlayer.playVocabFolder(folder, folder)}
                                onPlaylistAdd={() => audioPlayer.addVocabFolderToPlaylist(folder, folder)}
                                isSelected={folderFilter === folder}
                                isPlaying={audioPlayer.currentPlayingItem?.itemId === folder && audioPlayer.isPlaying}
                                isUncategorized={folder === FOLDER_CONSTANTS.UNORGANIZED}
                                className="origin-left scale-[0.9]"
                            />
                        ))}
                    </div>
                    {showScrollButtons && (
                      <>
                        <Button 
                            size="icon" 
                            variant="outline" 
                            onClick={() => handleScroll('left')} 
                            className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full h-8 w-8 z-10 bg-background/80 backdrop-blur-sm shadow-md"
                        >
                            <Icon name="ChevronLeft" className="h-4 w-4" />
                        </Button>
                        <Button 
                            size="icon" 
                            variant="outline" 
                            onClick={() => handleScroll('right')} 
                            className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full h-8 w-8 z-10 bg-background/80 backdrop-blur-sm shadow-md"
                        >
                            <Icon name="ChevronRight" className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                </div>
            </div>
            <Separator />
        </>
    );
    
    return (
        <div className="flex flex-col h-full">
            <CardHeader className="p-3">
                <div className="flex justify-between items-center">
                    <Tabs 
                        value={mode} 
                        onValueChange={(value) => setMode(value as 'vocab' | 'flashcard')} 
                        className="w-auto"
                    >
                        <TabsList>
                            <TabsTrigger value="vocab">Vocab</TabsTrigger>
                            <TabsTrigger value="flashcard">Flashcard</TabsTrigger>
                        </TabsList>
                    </Tabs>
                    
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" className="h-8 w-8">
                                <Icon name="Plus" className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => setIsAddVocabOpen(true)}>
                                <Icon name="ListChecks" className="mr-2 h-4 w-4" />
                                {t('vocabularyPage:addVocabDialog.title')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setIsAddFolderOpen(true)}>
                                <Icon name="FolderPlus" className="mr-2 h-4 w-4" />
                                {t('vocabularyPage:addFolderDialog.title')}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </CardHeader>

            {renderFolderSection()}

            {mode === 'vocab' ? (
                <CardContent className="p-0 flex flex-col flex-grow min-h-0">
                    <ScrollArea className="flex-grow h-full min-h-0">
                        {renderVocabContent()}
                    </ScrollArea>
                </CardContent>
            ) : (
                <CardContent className="p-3 flex-grow flex flex-col items-center justify-center">
                    {sessionCards.length === 0 && !isLoading ? (
                        <div className="text-center text-muted-foreground p-4">
                            <Icon name="Trophy" className="h-8 w-8 mx-auto mb-2" />
                            <p className="font-semibold">{t('vocabularyPage:sessionCompleteTitle')}</p>
                            <p className="text-xs">
                                {t('vocabularyPage:noCardsInStage.description', { stage: '' })}
                            </p>
                        </div>
                    ) : (
                        <div className="w-full h-full aspect-[1/1.2] max-w-[240px] relative">
                            <AnimatePresence initial={false}>
                                {topCard && (
                                    <div 
                                        className="absolute inset-0 flex items-center justify-center" 
                                        style={{ transform: 'scale(0.85)', transformOrigin: 'center' }}
                                    >
                                        <div className="w-full aspect-[1/1.2] relative">
                                            <Flashcard
                                                key={topCard.id}
                                                item={topCard}
                                                onSwipe={(dir) => handleFlashcardAction(dir > 0 ? 'remembered' : 'forgot')}
                                                onTest={(isCorrect) => handleFlashcardAction(isCorrect ? 'tested_correct' : 'tested_incorrect')}
                                                isTopCard={true}
                                            />
                                        </div>
                                    </div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}
                </CardContent>
            )}

            <AddVocabDialog
                isOpen={isAddVocabOpen}
                onOpenChange={setIsAddVocabOpen}
                onSuccess={handleAddVocabSuccess}
                allFolders={folders}
                initialFolder={folderFilter !== FOLDER_CONSTANTS.UNORGANIZED ? folderFilter : undefined}
                context="vocab-videos" // Always 'vocab-videos' for this view
            />

            <AddFolderDialog
                isOpen={isAddFolderOpen}
                onOpenChange={setIsAddFolderOpen}
                onSuccess={handleAddFolderSuccess}
                allFolders={folders}
            />

            {itemToEdit && (
                <EditVocabDialog 
                    isOpen={!!itemToEdit} 
                    onOpenChange={() => setItemToEdit(null)} 
                    item={itemToEdit} 
                    onSuccess={handleEditSuccess} 
                    allFolders={folders} 
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
};
