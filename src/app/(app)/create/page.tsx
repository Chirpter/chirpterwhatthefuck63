
"use client";

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'; // ✅ IMPORTED Tabs and TabsContent
import { Icon } from '@/components/ui/icons';
import { useUser } from '@/contexts/user-context';
import { cn } from '@/lib/utils';
import { CreationForm } from '@/features/create/components/CreationForm';
import { BookGenerationAnimation } from '@/features/create/components/book/BookGenerationAnimation';
import type { Piece, Book } from '@/lib/types';
import { useCreationJob } from '@/features/create/hooks/useCreationJob';
import PieceReader from '@/features/reader/components/piece/PieceReader';
import { CreationDebugPanel } from '@/components/debug/CreationDebugPanel';
import { useAudioPlayer } from '@/contexts/audio-player-context';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function CreatePage() {
    const { t } = useTranslation(['createPage', 'common', 'toast', 'presets']);
    const { user } = useUser();
    const audioPlayer = useAudioPlayer();
    const audioPlayerHeight = audioPlayer.currentPlayingItem ? 68 : 0;

    const [activeTab, setActiveTab] = useState<'book' | 'piece'>('book');
    const job = useCreationJob({ type: activeTab });

    const handleTabChange = useCallback((value: string) => {
        const tabValue = value as 'book' | 'piece';
        setActiveTab(tabValue);
        job.reset(tabValue);
    }, [job]);

    const { isBusy, validationMessage, canGenerate, creditCost, finalizedId, isRateLimited, formData } = job;
    const formId = "creation-form";

    const handleSubmitClick = () => {
        document.getElementById(formId)?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    };

    const submitButtonText = isRateLimited ? t('common:pleaseWait') : t('generateButton.default');
    const showCreditBadge = !isBusy && !finalizedId && !isRateLimited;
    const isSubmitDisabled = isBusy || !!validationMessage || !canGenerate || isRateLimited;

    // ✅ WRAP content in a single Tabs component
    return (
        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex h-full flex-col md:flex-row" style={{ height: 'calc(100vh - (var(--header-height-desktop) + 1px))' }}>
            <CreationDebugPanel />
            
            <aside className="w-full md:w-96 flex-shrink-0 bg-card md:border-r flex flex-col">
                
                <div className="p-3 border-b flex-shrink-0">
                    <h2 className="text-lg md:text-xl font-headline font-semibold text-center md:text-left">
                        {t('createContentTitle')}
                    </h2>
                </div>
                
                <div className="p-3 md:p-4 border-b flex-shrink-0">
                    <TabsList className="grid w-full grid-cols-2 font-body h-9 md:h-10">
                        <TabsTrigger value="book">
                            {t('tabs.book')}
                        </TabsTrigger>
                        <TabsTrigger value="piece">
                            {t('tabs.piece')}
                        </TabsTrigger>
                    </TabsList>
                </div>

                <ScrollArea className="flex-grow overflow-y-auto">
                    <div className="p-3 md:p-4 pb-32">
                        {/* ✅ Use TabsContent for each form */}
                        <TabsContent value="book" forceMount={true} className={cn(activeTab !== 'book' && 'hidden')}>
                           <CreationForm job={job} formId={`${formId}-book`} type="book" />
                        </TabsContent>
                         <TabsContent value="piece" forceMount={true} className={cn(activeTab !== 'piece' && 'hidden')}>
                           <CreationForm job={job} formId={`${formId}-piece`} type="piece" />
                        </TabsContent>
                    </div>
                </ScrollArea>
                
                <div 
                    className="sticky bg-card border-t p-3 md:p-4 space-y-2 mt-auto"
                    style={{ bottom: `${audioPlayerHeight}px` }}
                >
                    {!isBusy && validationMessage && (
                        <div className="flex items-center justify-center text-xs text-destructive font-medium">
                            <Icon name="Info" className="mr-1 h-3.5 w-3.5" />
                            {t(validationMessage)}
                        </div>
                    )}
                    <Button 
                        type="button" 
                        onClick={handleSubmitClick} 
                        className="w-full h-10 md:h-11 relative" 
                        disabled={isSubmitDisabled}
                    >
                        {isBusy ? (
                            <>
                                <Icon name="Wand2" className="mr-2 h-4 w-4 animate-pulse" /> 
                                {t('status.conceptualizing')}
                            </>
                        ) : !canGenerate && !validationMessage && user && !isRateLimited ? (
                            <>
                                <Icon name="Info" className="mr-2 h-4 w-4" /> 
                                {t('common:insufficientCreditsTitle')}
                            </>
                        ) : (
                            <>
                                {submitButtonText}
                                {showCreditBadge && user && (
                                    <span className="absolute -top-2 -right-2 h-5 w-5 rounded-full flex items-center justify-center text-xs bg-secondary text-secondary-foreground">
                                        {creditCost}
                                    </span>
                                )}
                            </>
                        )}
                    </Button>
                </div>
            </aside>
            
            <main className="hidden md:flex flex-1 bg-muted/30 items-center justify-center p-4">
                <TabsContent value="book" className="w-full h-full m-0">
                    <BookGenerationAnimation
                        isFormBusy={job.isBusy}
                        bookJobData={job.jobData as Book | null}
                        finalizedBookId={finalizedId}
                        bookFormData={job.formData}
                        onViewBook={job.handleViewResult}
                        onCreateAnother={() => job.reset('book')}
                    />
                </TabsContent>
                <TabsContent value="piece" className="w-full h-full m-0">
                    <PieceReader
                        piece={job.jobData as Piece}
                        isPreview
                        presentationStyle={formData.presentationStyle as 'doc' | 'card'}
                        aspectRatio={formData.aspectRatio}
                    />
                </TabsContent>
            </main>
        </Tabs>
    );
}
