// src/app/(app)/create/page.tsx - REFACTORED
"use client";

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Icon } from '@/components/ui/icons';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMobile } from '@/hooks/useMobile';
import { useUser } from '@/contexts/user-context';
import { useAudioPlayer } from '@/contexts/audio-player-context';
import { cn } from '@/lib/utils';
import { CreationForm } from '@/features/create/components/CreationForm';
import { BookGenerationAnimation } from '@/features/create/components/book/BookGenerationAnimation';
import type { Piece, Book } from '@/lib/types';
import { useCreationJob } from '@/features/create/hooks/useCreationJob';
import PieceReader from '@/features/reader/components/piece/PieceReader';
import { CreationDebugPanel } from '@/components/debug/CreationDebugPanel';

// The page now uses a simpler flexbox layout for desktop.
export default function CreatePage() {
    const { t } = useTranslation(['createPage', 'common', 'toast', 'presets']);
    const { user } = useUser();
    const audioPlayer = useAudioPlayer();
    const isPlayerVisible = !!audioPlayer.currentPlayingItem;

    const [activeTab, setActiveTab] = useState<'book' | 'piece'>('book');
    const job = useCreationJob({ type: activeTab });

    const handleTabChange = useCallback((newTab: string) => {
        const tabValue = newTab as 'book' | 'piece';
        setActiveTab(tabValue);
        job.reset(tabValue);
    }, [job]);

    const pageTitle = t('createContentTitle');
    const { isBusy, validationMessage, canGenerate, creditCost, finalizedId, isRateLimited, formData } = job;
    const formId = "creation-form";

    const submitButtonText = isRateLimited ? t('common:pleaseWait') : t('generateButton.default');
    const showCreditBadge = !isBusy && !finalizedId && !isRateLimited;
    const isSubmitDisabled = isBusy || !!validationMessage || !canGenerate || isRateLimited;

    const handleSubmitClick = () => {
        document.getElementById(formId)?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    };

    // The Preview component, now semantically a <main> element.
    const renderDesktopPreview = () => (
        <main className="hidden md:block flex-1 bg-muted/30 relative">
            {activeTab === 'book' ? (
                <BookGenerationAnimation
                    isFormBusy={job.isBusy}
                    bookJobData={job.jobData as Book | null}
                    finalizedBookId={finalizedId}
                    bookFormData={job.formData}
                    onViewBook={job.handleViewResult}
                    onCreateAnother={() => job.reset('book')}
                />
            ) : (
                <div className="w-full h-full flex items-center justify-center p-4">
                    <PieceReader
                        piece={job.jobData as Piece}
                        isPreview
                        presentationStyle={formData.presentationStyle as 'doc' | 'card'}
                        aspectRatio={formData.aspectRatio}
                    />
                </div>
            )}
        </main>
    );

    return (
        <>
            <CreationDebugPanel />
            {/* The root container now uses flexbox on medium screens and up */}
            <div className="h-full md:flex">
                {/* The sidebar is now an <aside> element */}
                <aside className={cn(
                    "w-full md:w-96 md:flex-shrink-0 bg-card border-r-0 md:border-r shadow-lg z-10 flex flex-col transition-[height] duration-300 ease-in-out",
                    // On desktop, height adjusts based on audio player visibility
                    "md:h-auto", // Let flexbox handle height
                    isPlayerVisible ? "md:pb-[68px]" : ""
                )}>
                    <div className="p-3 border-b">
                        <h2 className="text-lg md:text-xl font-headline font-semibold text-center md:text-left">{pageTitle}</h2>
                    </div>
                    
                    <Tabs onValueChange={handleTabChange} value={activeTab} className="flex flex-col flex-grow overflow-hidden">
                        <div className="p-3 md:p-4 border-b">
                            <TabsList className="grid w-full grid-cols-2 font-body h-9 md:h-10">
                                <TabsTrigger value="book">{t('tabs.book')}</TabsTrigger>
                                <TabsTrigger value="piece">{t('tabs.piece')}</TabsTrigger>
                            </TabsList>
                        </div>

                        <ScrollArea className="flex-grow">
                            <div className="p-3 md:p-4">
                                <CreationForm job={job} formId={formId} type={activeTab} />
                            </div>
                        </ScrollArea>
                    </Tabs>
                    
                    <div className="p-3 md:p-4 border-t bg-card mt-auto space-y-2">
                        {!isBusy && validationMessage && (
                            <div className="flex items-center justify-center text-xs text-destructive font-medium">
                                <Icon name="Info" className="mr-1 h-3.5 w-3.5" />
                                {t(validationMessage)}
                            </div>
                        )}
                        <Button type="button" onClick={handleSubmitClick} className="w-full font-body h-10 md:h-11 bg-primary hover:bg-primary/90 text-primary-foreground relative" disabled={isSubmitDisabled}>
                            {isBusy ? (
                                <><Icon name="Wand2" className="mr-2 h-4 w-4 animate-pulse" /> {t('status.conceptualizing')}</>
                            ) : !canGenerate && !validationMessage && user && !isRateLimited ? (
                                <><Icon name="Info" className="mr-2 h-4 w-4" /> {t('common:insufficientCreditsTitle')}</>
                            ) : (
                                <>
                                    {submitButtonText}
                                    {showCreditBadge && user && (
                                        <span className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs shadow-md bg-secondary text-secondary-foreground">
                                            {creditCost}
                                        </span>
                                    )}
                                </>
                            )}
                        </Button>
                    </div>
                </aside>
                
                {renderDesktopPreview()}
            </div>
        </>
    );
}
