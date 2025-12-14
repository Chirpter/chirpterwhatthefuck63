



"use client";

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useSearchParams } from 'next/navigation';
import { ActivitiesPanel } from '../activities/ActivitiesPanel';
import { ControlBar } from './ControlBar';
import { ContextSentences } from './ContextSentences';
import { MiniVocabView } from '@/features/learning/components/vocab-videos/MiniVocabView';
import { useVocabVideosContext } from '../../contexts/VocabVideosContext';
import LookupPopover from '@/features/lookup/components/LookupPopover';
import { VocabVideoPlayer, type VocabVideoPlayerHandle } from './VocabVideoPlayer';
import type { Piece } from '@/lib/types';
import { useUser } from '@/contexts/user-context';
import { Logo } from '@/components/ui/Logo';

function VocabVideosView() {
  const { t, i18n } = useTranslation(['learningPage', 'common', 'toast']);
  const searchParams = useSearchParams();
  const playerRef = useRef<VocabVideoPlayerHandle>(null);
  const { user } = useUser();

  const {
    query,
    setQuery,
    clips,
    selectedIndex,
    isLoading,
    error,
    isAutoSkipping,
    setIsAutoSkipping,
    repeatCount,
    isRepeating,
    handleSearch,
    handleNext,
    handlePrevious,
    handleReplay,
    handleVideoEnd,
    jumpToClip,
    registerReplayTrigger,
    lookupState,
    handleTextSelection,
    closeLookup,
  } = useVocabVideosContext();
  
  const selectedResult = useMemo(() => clips[selectedIndex] || null, [clips, selectedIndex]);
  
  const urlProcessedRef = useRef(false);
  const clipJumpedRef = useRef(false);
  
  useEffect(() => {
    if (playerRef.current && registerReplayTrigger) {
      registerReplayTrigger(() => {
        playerRef.current?.replay();
      });
    }
  }, [registerReplayTrigger, selectedResult]);
  
  useEffect(() => {
    if (urlProcessedRef.current) return;
    
    const queryFromUrl = searchParams.get('q');
    
    if (queryFromUrl) {
      urlProcessedRef.current = true;
      setQuery(queryFromUrl);
      handleSearch(queryFromUrl);
    }
  }, [searchParams, setQuery, handleSearch]);
  
  useEffect(() => {
    if (clipJumpedRef.current || clips.length === 0) return;
    
    const videoIdFromUrl = searchParams.get('videoId');
    const startTimeFromUrl = searchParams.get('startTime');
    
    if (videoIdFromUrl && startTimeFromUrl && jumpToClip) {
      clipJumpedRef.current = true;
      jumpToClip(videoIdFromUrl, parseFloat(startTimeFromUrl));
    }
  }, [clips, searchParams, jumpToClip]);
  
  useEffect(() => {
    if (selectedResult && playerRef.current) {
      playerRef.current.loadAndPlay(selectedResult);
    }
  }, [selectedResult]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed) {
      clipJumpedRef.current = false;
      handleSearch(trimmed);
    }
  }, [query, handleSearch]);

  const renderContextState = useMemo(() => {
    if (isLoading && !selectedResult) {
      return (
        <div className="p-4 space-y-3">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-2/3" />
        </div>
      );
    }
    
    if (error && !selectedResult) {
      return (
        <div className="flex items-center justify-center h-full p-4">
          <Alert variant="destructive" className="m-4 max-w-md">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      );
    }
    
    if (selectedResult) {
      return (
        <ContextSentences
          context={selectedResult.context}
          searchTerm={query}
          currentSentence={selectedResult.text}
        />
      );
    }
    
    return (
      <div className="flex items-center justify-center h-full p-4 text-center text-muted-foreground">
        <div>
          <Icon name="Search" className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{t('vocabVideos.searchPrompt', { defaultValue: 'Search for a word to see video clips' })}</p>
        </div>
      </div>
    );
  }, [selectedResult, query, isLoading, error, t]);

  const handleSelectionWithContext = (event: React.MouseEvent<HTMLDivElement>) => {
    if (selectedResult && user) {
        const sourceItem: Piece = {
            id: selectedResult.videoId,
            type: 'piece',
            userId: user.uid,
            contentState: 'ready',
            title: { primary: '' },
            origin: 'en',
            langs: ['en'],
            status: 'draft',
            presentationStyle: 'card',
            generatedContent: [],
            contextData: {
                startTime: selectedResult.start,
                endTime: selectedResult.end,
            },
            isBilingual: false,
        };
        handleTextSelection(event, sourceItem, selectedResult.context);
    }
};


  return (
    <div className="learningtool-style space-y-6">
      <LookupPopover 
        isOpen={lookupState.isOpen}
        onOpenChange={(open) => !open && closeLookup()}
        rect={lookupState.rect}
        text={lookupState.text}
        sourceLanguage={lookupState.sourceLang}
        targetLanguage={i18n.language}
        sourceItem={lookupState.sourceItem}
        sentenceContext={lookupState.sentenceContext}
        context={lookupState.context}
      />
      
      <h2 className="text-xl md:text-2xl font-headline font-semibold">
        {t('vocabVideos.pageTitle')}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 flex flex-col gap-6">
          <Card>
            <CardContent className="p-3">
              <form className="flex items-center gap-2" onSubmit={handleSubmit}>
                <div className="relative flex-grow w-full">
                  <Icon name="Search" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t('vocabVideos.searchPlaceholder')}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="font-body pl-9 h-10"
                  />
                </div>
                <Button 
                  type="submit"
                  disabled={isLoading || !query.trim()} 
                  className="h-10 px-4"
                >
                  {isLoading ? (
                    <Icon name="Loader2" className="animate-spin h-5 w-5" />
                  ) : (
                    t('common:search')
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
          
          <VocabVideoPlayer 
            ref={playerRef}
            onVideoEnd={handleVideoEnd}
          />

          <ActivitiesPanel />
        </div>
        
        <Card className="md:col-span-1 flex flex-col h-[calc(100vh-12rem)] min-h-[500px] bg-reader-grid">
          <CardHeader className="p-3 border-b">
            <ControlBar
              onPrevious={handlePrevious}
              onRepeat={handleReplay}
              isRepeating={isRepeating}
              onNext={handleNext}
              isAutoSkipping={isAutoSkipping}
              onAutoSkipChange={setIsAutoSkipping}
              hasPrevious={selectedIndex > 0}
              hasNext={selectedIndex < clips.length - 1}
              repeatCount={repeatCount}
              totalRepeats={3}
            />
          </CardHeader>
          <div 
            onMouseUp={handleSelectionWithContext} 
            className="p-4 pt-0 flex-grow flex flex-col gap-2 prose-on-grid overflow-y-auto"
          >
            {renderContextState}
          </div>
        </Card>
        
        <Card className="md:col-span-1 flex flex-col h-[calc(100vh-12rem)] min-h-[500px]">
          <MiniVocabView />
        </Card>
      </div>
    </div>
  );
}

// REMOVED: VocabVideosProvider is now global
// The main export is just the view component now.
export default VocabVideosView;
