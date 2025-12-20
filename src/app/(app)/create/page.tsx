// src/app/(app)/create/page.tsx - COMPLETELY FIXED
"use client";

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Icon } from '@/components/ui/icons';
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

    // Calculate button bottom position based on audio player
    const buttonBottomClass = isPlayerVisible ? "bottom-[68px]" : "bottom-0";

    // Desktop Preview
    const renderDesktopPreview = () => (
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
    );

    return (
        <>
            <CreationDebugPanel />
            
            {/* ✅ Container: Fixed on mobile, relative on desktop */}
            <div className="fixed inset-0 top-[64px] md:static md:h-[calc(100vh-64px)] md:flex -mx-4 sm:-mx-6 md:mx-0">
                
                {/* ✅ Sidebar: Full height, internal scroll */}
                <aside className="relative w-full md:w-96 md:flex-shrink-0 bg-card border-r-0 md:border-r shadow-lg z-10 h-full flex flex-col">
                    
                    {/* Header - Fixed at top */}
                    <div className="flex-shrink-0 p-3 border-b bg-card">
                        <h2 className="text-lg md:text-xl font-headline font-semibold text-center md:text-left">
                            {pageTitle}
                        </h2>
                    </div>
                    
                    {/* Tabs - Fixed below header */}
                    <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-shrink-0 p-3 md:p-4 border-b bg-card">
                        <TabsList className="grid w-full grid-cols-2 font-body h-9 md:h-10">
                            <TabsTrigger value="book">
                                {t('tabs.book')}
                            </TabsTrigger>
                            <TabsTrigger value="piece">
                                {t('tabs.piece')}
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>

                    {/* ✅ Scrollable content area */}
                    <div 
                        className="flex-1 overflow-y-auto overscroll-contain"
                        style={{
                            // Reserve space for button: button height (44px/48px) + padding (12px*2) + validation (if any)
                            paddingBottom: '120px'
                        }}
                    >
                        <div className="p-3 md:p-4">
                            <CreationForm job={job} formId={formId} type={activeTab} />
                        </div>
                    </div>
                    
                    {/* ✅ Fixed button at bottom of sidebar */}
                    <div className={cn(
                        "absolute left-0 right-0 p-3 md:p-4 bg-card border-t shadow-lg z-20",
                        "transition-bottom duration-300",
                        // Mobile: always at bottom of screen
                        "md:bottom-0",
                        // Desktop: adjust for audio player
                        `md:${buttonBottomClass}`
                    )}>
                        {!isBusy && validationMessage && (
                            <div className="flex items-center justify-center text-xs text-destructive font-medium mb-2">
                                <Icon name="Info" className="mr-1 h-3.5 w-3.5" />
                                {t(validationMessage)}
                            </div>
                        )}
                        <Button 
                            type="button" 
                            onClick={handleSubmitClick} 
                            className="w-full font-body h-10 md:h-11 bg-primary hover:bg-primary/90 text-primary-foreground relative shadow-lg" 
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
                                        <span className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs shadow-md bg-secondary text-secondary-foreground">
                                            {creditCost}
                                        </span>
                                    )}
                                </>
                            )}
                        </Button>
                    </div>
                </aside>
                
                {/* ✅ Preview area */}
                {renderDesktopPreview()}
            </div>
        </>
    );
}
