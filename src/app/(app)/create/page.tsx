// FILE 2: src/app/(app)/create/page.tsx - ULTRA SIMPLIFIED
// ============================================================================
"use client";

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

    return (
        <>
            <CreationDebugPanel />
            
            {/* Container: Full height, flex layout */}
            <div className="h-[calc(100vh-64px)] flex">
                
                {/* Sidebar: Form + Button */}
                <aside className="w-full md:w-96 flex-shrink-0 bg-card md:border-r flex flex-col">
                    
                    {/* Header */}
                    <div className="p-3 border-b flex-shrink-0">
                        <h2 className="text-lg md:text-xl font-headline font-semibold text-center md:text-left">
                            {t('createContentTitle')}
                        </h2>
                    </div>
                    
                    <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col overflow-hidden">
                        {/* Tabs */}
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

                        {/* Scrollable Form Area */}
                        <div className="flex-1 overflow-y-auto">
                            <TabsContent value={activeTab} className="p-3 md:p-4 pb-32 mt-0">
                                <CreationForm job={job} formId={formId} type={activeTab} />
                            </TabsContent>
                        </div>
                    </Tabs>
                    
                    {/* Sticky Generate Button */}
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
                
                {/* Preview: Desktop only */}
                <main className="hidden md:flex flex-1 bg-muted/30 items-center justify-center p-4">
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
