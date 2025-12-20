
"use client";

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'; // ✅ FIX: Import Tabs and TabsContent
import { Icon } from '@/components/ui/icons';
import { useUser } from '@/contexts/user-context';
import { useAudioPlayer } from '@/contexts/audio-player-context';
import { cn } from '@/lib/utils';
import { CreationForm } from '@/features/create/components/CreationForm';
import { BookGenerationAnimation } from '@/features/create/components/book/BookGenerationAnimation';
import type { Piece, Book } from '@/lib/types';
import { useCreationJob } from '@/features/create/hooks/useCreationJob';
import PieceReader from '@/features/reader/components/piece/PieceReader';
import { CreationDebugPanel } from '@/components/debug/CreationDebugPanel';

export default function CreatePage() {
    const { t } = useTranslation(['createPage', 'common', 'toast', 'presets']);
    const { user } = useUser();
    const audioPlayer = useAudioPlayer();
    const isPlayerVisible = !!audioPlayer.currentPlayingItem;

    const [activeTab, setActiveTab] = useState<'book' | 'piece'>('book');
    const job = useCreationJob({ type: activeTab });

    const handleTabChange = useCallback((value: string) => {
        const tabValue = value as 'book' | 'piece';
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

    return (
        <>
            <CreationDebugPanel />
            
            <div className="h-[calc(100vh-64px)] flex overflow-hidden">
                
                {/* ============ SIDEBAR ============ */}
                <aside className="w-full md:w-96 flex-shrink-0 bg-card md:border-r flex flex-col relative">
                    
                    {/* Header */}
                    <div className="flex-shrink-0 p-3 border-b">
                        <h2 className="text-lg md:text-xl font-headline font-semibold text-center md:text-left">
                            {pageTitle}
                        </h2>
                    </div>
                    
                    {/* ✅ FIX: Wrap the entire tab section in the <Tabs> component */}
                    <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col min-h-0">
                        {/* Tabs */}
                        <div className="flex-shrink-0 p-3 md:p-4 border-b">
                            <TabsList className="grid w-full grid-cols-2 font-body h-9 md:h-10">
                                <TabsTrigger 
                                    value="book" 
                                    className={cn(activeTab === 'book' && "data-[state=active]:bg-background")}
                                >
                                    {t('tabs.book')}
                                </TabsTrigger>
                                <TabsTrigger 
                                    value="piece" 
                                    className={cn(activeTab === 'piece' && "data-[state=active]:bg-background")}
                                >
                                    {t('tabs.piece')}
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        {/* ✅ FIX: Use TabsContent to wrap the form */}
                        <TabsContent value={activeTab} className="flex-1 overflow-y-auto overscroll-contain mt-0" style={{ WebkitOverflowScrolling: 'touch' }}>
                            <div className="p-3 md:p-4 pb-32">
                                <CreationForm job={job} formId={formId} type={activeTab} />
                            </div>
                        </TabsContent>
                    </Tabs>
                    
                    {/* ✅ FIX: Sticky button - CSS handles everything */}
                    <div 
                        className={cn(
                            "sticky border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80",
                            "p-3 md:p-4 space-y-2 shadow-lg z-20 mt-auto" // Added mt-auto
                        )}
                        style={{
                            // Dynamic bottom based on audio player
                            bottom: isPlayerVisible ? '68px' : '0',
                            transition: 'bottom 0.3s ease-in-out'
                        }}
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
                            className="w-full font-body h-10 md:h-11 bg-primary hover:bg-primary/90 text-primary-foreground relative" 
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
                                        <span className="absolute -top-2 -right-2 h-5 w-5 rounded-full flex items-center justify-center text-xs shadow-md bg-secondary text-secondary-foreground">
                                            {creditCost}
                                        </span>
                                    )}
                                </>
                            )}
                        </Button>
                    </div>
                </aside>
                
                {/* ============ PREVIEW ============ */}
                <main className="hidden md:flex flex-1 bg-muted/30 items-center justify-center p-4 overflow-hidden">
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
                        <PieceReader
                            piece={job.jobData as Piece}
                            isPreview
                            presentationStyle={formData.presentationStyle as 'doc' | 'card'}
                            aspectRatio={formData.aspectRatio}
                        />
                    )}
                </main>
            </div>
        </>
    );
}
