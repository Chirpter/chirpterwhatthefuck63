"use client";

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Icon } from '@/components/ui/icons';
import { useUser } from '@/contexts/user-context';
import { CreationForm } from '@/features/create/components/CreationForm';
import { BookGenerationAnimation } from '@/features/create/components/book/BookGenerationAnimation';
import type { Piece, Book } from '@/lib/types';
import { useCreationJob } from '@/features/create/hooks/useCreationJob';
import PieceReader from '@/features/reader/components/piece/PieceReader';
import { CreationDebugPanel } from '@/components/debug/CreationDebugPanel';
import { useAudioPlayer } from '@/contexts/audio-player-context';

export default function CreatePage() {
  const { t } = useTranslation(['createPage', 'common']);
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
  const formId = `creation-form-${activeTab}`;

  const handleSubmitClick = () => {
    document.getElementById(formId)?.dispatchEvent(
      new Event('submit', { cancelable: true, bubbles: true })
    );
  };

  const submitButtonText = isRateLimited ? t('common:pleaseWait') : t('generateButton.default');
  const showCreditBadge = !isBusy && !finalizedId && !isRateLimited;
  const isSubmitDisabled = isBusy || !!validationMessage || !canGenerate || isRateLimited;

  return (
    <>
      <CreationDebugPanel />
      
      {/* Main Container */}
      <div className="fixed inset-0 top-[var(--header-height-mobile)] md:top-[var(--header-height-desktop)] flex flex-col md:flex-row">
        
        {/* LEFT PANEL - Sidebar with Form */}
        <div className="w-full md:w-96 flex flex-col bg-card md:border-r max-h-full">
          
          {/* Header */}
          <div className="p-4 border-b flex-shrink-0">
            <h2 className="text-headline-2">
              {t('createContentTitle')}
            </h2>
          </div>
          
          {/* Tabs */}
          <div className="p-4 border-b flex-shrink-0">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
              <TabsList className="grid w-full grid-cols-2 h-10">
                <TabsTrigger value="book" className="text-body-base">{t('tabs.book')}</TabsTrigger>
                <TabsTrigger value="piece" className="text-body-base">{t('tabs.piece')}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Scrollable Form Area */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="p-4 pb-16">
              <CreationForm job={job} formId={formId} type={activeTab} />
            </div>
          </div>
          
          {/* Sticky Button */}
          <div 
            className="border-t p-4 bg-card space-y-2 flex-shrink-0"
            style={{ marginBottom: audioPlayerHeight }}
          >
            {!isBusy && validationMessage && (
              <div className="flex items-center justify-center gap-1.5 text-caption font-medium text-destructive">
                <Icon name="Info" className="h-3.5 w-3.5 flex-shrink-0" />
                <span>{t(validationMessage)}</span>
              </div>
            )}
            
            <Button 
              type="button" 
              onClick={handleSubmitClick} 
              className="w-full h-11 relative" 
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
                    <span className="absolute -top-2 -right-2 h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold bg-secondary text-secondary-foreground border-2 border-card">
                      {creditCost}
                    </span>
                  )}
                </>
              )}
            </Button>
          </div>
        </div>
        
        {/* RIGHT PANEL - Desktop Preview */}
        <div className="hidden md:flex flex-1 bg-muted/30 items-center justify-center p-6">
          <div className="w-full h-full max-w-4xl flex items-center justify-center">
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
          </div>
        </div>
      </div>
    </>
  );
}
