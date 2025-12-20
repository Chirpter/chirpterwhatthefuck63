// src/features/learning/components/vocab-videos/VocabVideosView.tsx

import React, { useCallback, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUser } from '@/contexts/user-context';
import { useMobile } from '@/hooks/useMobile';
import type { Piece } from '@/lib/types';

import { useVocabVideosContext } from '../../contexts/VocabVideosContext';
import { LearningToolLayout } from '../layout/LearningToolLayout'; // ✅ IMPORT a shared layout
import { VocabVideoPlayer, type VocabVideoPlayerHandle } from './VocabVideoPlayer';
import { ControlBar } from './ControlBar';
import { ContextSentences } from './ContextSentences';
import { ActivitiesPanel } from '../activities/ActivitiesPanel';
import { MiniVocabView } from '@/features/learning/components/vocab-videos/MiniVocabView';
import LookupPopover from '@/features/lookup/components/LookupPopover';

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
            contextData: { startTime: selectedResult.start, endTime: selectedResult.end },
            isBilingual: false,
        };
        handleTextSelection(event, sourceItem, selectedResult.context);
    }
  };

  // ✅ RENDER LOGIC FOR EACH SLOT
  
  const renderPageTitle = () => (
    <div className="space-y-1">
      <h1 className="text-headline-1">{t('vocabVideos.pageTitle')}</h1>
      <p className="text-body-sm text-muted-foreground">{t('vocabVideos.description')}</p>
    </div>
  );

  const renderSearchAndVideoPanel = () => (
    <>
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
            <Button type="submit" disabled={isLoading || !query.trim()} className="h-10 px-4">
              {isLoading ? <Icon name="Loader2" className="animate-spin h-5 w-5" /> : t('common:search')}
            </Button>
          </form>
        </CardContent>
      </Card>
      <VocabVideoPlayer ref={playerRef} onVideoEnd={handleVideoEnd} />
    </>
  );

  const renderContentPanel = () => {
    const renderContextState = () => {
      if (isLoading && !selectedResult) return <div className="p-4 space-y-3"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-5 w-full" /><Skeleton className="h-5 w-2/3" /></div>;
      if (error && !selectedResult) return <div className="flex items-center justify-center h-full p-4"><Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert></div>;
      if (selectedResult) return <ContextSentences context={selectedResult.context} searchTerm={query} currentSentence={selectedResult.text} />;
      return <div className="flex items-center justify-center h-full p-4 text-center text-muted-foreground"><div><Icon name="Search" className="h-12 w-12 mx-auto mb-3 opacity-30" /><p className="text-body-base">{t('vocabVideos.searchPrompt')}</p></div></div>;
    };

    return (
      <Card className="md:col-span-1 flex flex-col h-full bg-reader-grid">
        <CardHeader className="p-3 border-b flex-shrink-0">
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
        <CardContent className="flex-1 min-h-0" onMouseUp={handleSelectionWithContext}>
          <ScrollArea className="h-full p-4 prose-on-grid">
            {renderContextState()}
          </ScrollArea>
        </CardContent>
      </Card>
    );
  };
  
  const renderRightColumn = () => (
    <Card className="h-full">
      <MiniVocabView />
    </Card>
  );
  
  return (
    <>
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
      <LearningToolLayout
        pageTitle={renderPageTitle()}
        searchAndVideoPanel={renderSearchAndVideoPanel()}
        activityPanel={<ActivitiesPanel />}
        contentPanel={renderContentPanel()}
        rightColumnPanel={renderRightColumn()}
      />
    </>
  );
}

export default VocabVideosView;
