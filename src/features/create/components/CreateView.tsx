// src/features/create/components/CreateView.tsx

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
import { CreationForm } from './CreationForm';
import { BookGenerationAnimation } from '@/features/create/components/BookGenerationAnimation';
import { useCreationJob } from '@/features/create/hooks/useCreationJob';
import { PieceItemCardRenderer } from '@/features/library/components/PieceItemCardRenderer';

export default function CreateView() {
  const { t } = useTranslation(['createPage', 'common', 'toast', 'presets']);
  const isMobile = useMobile();
  const { user } = useUser();
  const audioPlayer = useAudioPlayer();
  const isPlayerVisible = !!audioPlayer.currentPlayingItem;

  const [activeTab, setActiveTab] = useState<'book' | 'piece'>('book');
  
  // The single, unified hook that manages the "Creation Job"
  const job = useCreationJob({
    type: activeTab,
  });

  const handleTabChange = useCallback((newTab: string) => {
    const tabValue = newTab as 'book' | 'piece';
    setActiveTab(tabValue);
    // Reset the job state for the new type
    job.reset(tabValue); 
  }, [job]);

  const pageTitle = t('createContentTitle');
  
  const { isBusy, validationMessage, canGenerate, creditCost, finalizedId, isRateLimited } = job;

  // A stable ID for the form
  const formId = "creation-form";
  
  const submitButtonText = isRateLimited ? t('common:pleaseWait') : t('generateButton.default');
  const showCreditBadge = !isBusy && !finalizedId && !isRateLimited;
  const isSubmitDisabled = isBusy || !!validationMessage || !canGenerate || isRateLimited;
  
  const handleSubmitClick = () => {
    document.getElementById(formId)?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  };

  const renderDesktopPreview = () => {
    if (activeTab === 'book') {
        return (
            <BookGenerationAnimation
                isFormBusy={job.isBusy}
                bookJobData={job.jobData as any}
                finalizedBookId={finalizedId}
                bookFormData={job.formData}
                onViewBook={job.handleViewResult}
                onCreateAnother={() => job.reset('book')}
            />
        );
    }
    return (
        <PieceItemCardRenderer
          item={job.jobData}
          isPreview={false}
        />
    );
  };

  return (
    <div className="md:pl-96">
      <div className={cn(
          "w-full md:w-96 bg-card border-r-0 md:border-r shadow-lg z-10 flex flex-col md:fixed md:top-16 md:left-0 transition-[bottom] duration-300 ease-in-out",
          isPlayerVisible ? "md:bottom-[68px]" : "md:bottom-0"
        )}>
        <div className="p-3 border-b">
           <h2 className="text-xl md:text-2xl font-headline font-semibold text-center md:text-left">{pageTitle}</h2>
        </div>
        
        {/* The Tabs component now only controls the active tab state */}
        <Tabs
          onValueChange={handleTabChange}
          value={activeTab}
          className="flex flex-col flex-grow overflow-hidden"
        >
          <div className="p-4 border-b">
            <TabsList className="grid w-full grid-cols-2 font-body">
              <TabsTrigger value="book">{t('tabs.book')}</TabsTrigger>
              <TabsTrigger value="piece">{t('tabs.piece')}</TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-grow">
            <div className="p-4">
              {/* A single CreationForm handles rendering for both tabs */}
              <CreationForm 
                job={job} 
                formId={formId} 
                type={activeTab}
              />
            </div>
          </ScrollArea>
        </Tabs>
        
        <div className="p-4 border-t bg-card mt-auto space-y-2 fixed bottom-0 left-0 right-0 md:static">
            {!isBusy && validationMessage && (
                <div className="flex items-center justify-center text-xs text-destructive font-medium">
                    <Icon name="Info" className="mr-1 h-3.5 w-3.5" />
                    {t(validationMessage)}
                </div>
            )}
            <Button
                type="button"
                onClick={handleSubmitClick}
                className="w-full font-body bg-primary hover:bg-primary/90 text-primary-foreground relative"
                disabled={isSubmitDisabled}
            >
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
      </div>
      
      <div className="hidden md:block bg-muted/30 md:fixed md:top-16 md:left-96 md:right-0 md:bottom-0">
        {renderDesktopPreview()}
      </div>
    </div>
  );
}
