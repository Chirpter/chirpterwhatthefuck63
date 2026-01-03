// src/features/learning/components/shadowing/ShadowingView.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getTranscriptFromUrl, type TranscriptResult } from '@/features/learning/services/shadowing-service';
import { useToast } from '@/hooks/useToast';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ShadowingBox, type ShadowingResult } from './ShadowingBox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useUser } from '@/contexts/user-context';
import { ActivitiesPanel } from '../activities/ActivitiesPanel';
import { ShadowingAnalysis } from './ShadowingAnalysis';
import { useShadowingTracking } from '@/features/learning/hooks/useShadowingTracking';
import { useShadowingSettings } from '@/features/learning/hooks/useShadowingSettings';
import { ShadowingPlayer, type ShadowingPlayerHandle } from './ShadowingPlayer';
import { VideoBasedLayout } from '../layout/VideoBasedLayout';
import { ApiServiceError } from '@/lib/errors';


const getVideoIdFromUrl = (url: string): string | null => {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname === 'youtu.be') {
      return urlObj.pathname.slice(1);
    }
    if (urlObj.hostname.includes('youtube.com')) {
      return urlObj.searchParams.get('v');
    }
  } catch (e) {
    if (url.length === 11 && !url.includes(' ')) {
      return url;
    }
    return null;
  }
  return null;
};


export default function ShadowingView() {
  const { t } = useTranslation(['learningPage', 'common', 'toast']);
  const { toast } = useToast();
  const { user } = useUser();
  
  // ✅ REMOVED: useVideoHistory hook and related state
  const { hideMode, checkMode, setHideMode, setCheckMode } = useShadowingSettings();

  const [urlInput, setUrlInput] = useState('');
  const [transcriptResult, setTranscriptResult] = useState<TranscriptResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isShadowingMode, setIsShadowingMode] = useState(false);
  const [completedLinesCount, setCompletedLinesCount] = useState(0);
  const [correctlyCompletedLines, setCorrectlyCompletedLines] = useState<Set<number>>(new Set());
  const [currentPlayingLine, setCurrentPlayingLine] = useState<number | null>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  const playerRef = useRef<ShadowingPlayerHandle>(null);
  const [openBoxIndex, setOpenBoxIndex] = useState<number | null>(0);

  const videoId = useMemo(() => getVideoIdFromUrl(urlInput), [urlInput]);

  const tracking = useShadowingTracking(videoId);
  const [progress, setProgress] = useState<number[]>([]);
  
  // ✅ REFACTORED: Simplified loadVideo without history or caching
  const loadVideo = useCallback(async (url: string) => {
    if (!user) return;
    
    const newVideoId = getVideoIdFromUrl(url);
    if (!newVideoId) {
      setError('invalid_url');
      return;
    }

    // Reset state for new video
    setIsLoading(true);
    setError(null);
    setTranscriptResult(null);
    setIsShadowingMode(false);
    setCurrentPlayingLine(null);
    setIsVideoPlaying(false);
    setCompletedLinesCount(0);
    setCorrectlyCompletedLines(new Set());
    setOpenBoxIndex(0);

    try {
      const result = await getTranscriptFromUrl(url, user.uid);
      if (!result || !result.transcript || result.transcript.length === 0) {
        throw new Error('No transcript available for this video.');
      }
      
      setTranscriptResult(result);
      
      toast({ 
        title: 'Transcript Loaded', 
        description: `Loaded ${result.transcript.length} lines from "${result.title}"` 
      });
    } catch (err: any) {
      const msg = err instanceof ApiServiceError 
        ? err.message 
        : (err.message ?? 'An unknown error occurred.');
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  // ✅ REFACTORED: Simplified fetch handler
  const handleFetchTranscript = useCallback(() => {
    const url = urlInput.trim();
    if (!url) return;
    
    const newVideoId = getVideoIdFromUrl(url);
    if (!newVideoId) {
      setError('invalid_url');
      return;
    }

    loadVideo(url);
  }, [urlInput, loadVideo]);

  // ✅ REMOVED: useEffect for loading from history on mount

  // ✅ OPTIMIZED: Load progress from localStorage
  useEffect(() => {
    if (!videoId) {
      setProgress([]);
      return;
    }
    try {
      const saved = localStorage.getItem(`shadowing-progress-${videoId}`);
      setProgress(saved ? JSON.parse(saved) : []);
    } catch (e) {
      console.error('Failed to read progress', e);
      setProgress([]);
    }
  }, [videoId]);

  // ✅ OPTIMIZED: Single write for progress
  const updateProgress = useCallback((lineIndex: number) => {
    if (!videoId) return;
    
    setProgress(prev => {
      if (prev.includes(lineIndex)) return prev;
      
      const next = Array.from(new Set([...prev, lineIndex])).sort((a, b) => a - b);
      
      try {
        localStorage.setItem(`shadowing-progress-${videoId}`, JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      
      return next;
    });
  }, [videoId]);

  // ✅ REMOVED: useEffect for syncing progress to history

  // Restore progress on load
  useEffect(() => {
    if (transcriptResult && progress.length > 0) {
      setCompletedLinesCount(progress.length);
      setCorrectlyCompletedLines(new Set(progress));
      setOpenBoxIndex(progress.length);
    } else if (transcriptResult) {
      setCompletedLinesCount(0);
      setCorrectlyCompletedLines(new Set());
      setOpenBoxIndex(0);
    }
  }, [transcriptResult, progress]);

  const handlePlaySnippet = useCallback((start: number, end: number, lineIndex?: number) => {
    if (playerRef.current) {
      playerRef.current.loadSnippet(start, end);
      playerRef.current.play();
      setCurrentPlayingLine(lineIndex ?? null);
    }
  }, []);

  const handleBoxPlay = useCallback((start: number, end: number, lineIndex: number) => {
    if (currentPlayingLine === lineIndex && isVideoPlaying) {
      playerRef.current?.pause();
    } else {
      tracking.onReplay();
      handlePlaySnippet(start, end, lineIndex);
    }
  }, [currentPlayingLine, isVideoPlaying, handlePlaySnippet, tracking]);

  const handleReveal = useCallback(() => tracking.onReveal(), [tracking]);
  const handleVideoEnd = useCallback(() => setCurrentPlayingLine(null), []);
  const handleVideoPlay = useCallback(() => setIsVideoPlaying(true), []);
  const handleVideoPause = useCallback(() => setIsVideoPlaying(false), []);

  const handleLineComplete = useCallback((isCorrect: boolean, result: ShadowingResult) => {
    const { lineIndex } = result;
    
    if (lineIndex === tracking.currentSessionIndex) {
      tracking.onResubmit(result);
    } else {
      tracking.onFirstSubmit(result, lineIndex);
    }
    
    if (isCorrect) {
      updateProgress(lineIndex);
      setCorrectlyCompletedLines(prev => new Set(prev).add(lineIndex));
      setCompletedLinesCount(prev => Math.max(prev, lineIndex + 1));
    }
    
    setOpenBoxIndex(isCorrect ? lineIndex + 1 : lineIndex);
  }, [tracking, updateProgress]);

  // ✅ REMOVED: handleHistoryItemClick and handleClearHistory

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleFetchTranscript();
  };

  const wordsToDisplay = useMemo(() => tracking.getWordsNeedingAttention(), [tracking]);
  const progressPercentage = transcriptResult 
    ? Math.round((completedLinesCount / transcriptResult.transcript.length) * 100) 
    : 0;
  
  const renderPageTitle = () => (
    <div className="space-y-1">
      <h1 className="text-headline-1">{t('shadowing.title')}</h1>
      <p className="text-body-sm text-muted-foreground">{t('shadowing.description')}</p>
    </div>
  );

  const renderSearchAndVideoPanel = () => (
    <>
      <Card>
        <CardContent className="p-3">
          <form onSubmit={handleFormSubmit} className="flex items-center gap-2">
            <div className="relative flex-grow w-full">
              <Icon name="Youtube" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder={t('shadowing.urlPlaceholder')}
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className="font-body pl-9 h-10 transition-colors"
                disabled={isLoading}
              />
            </div>
            <Button 
              type="submit" 
              disabled={isLoading || !urlInput} 
              className="h-10 px-4 transition-colors"
            >
              {isLoading ? (
                <>
                  <Icon name="Loader2" className="animate-spin h-4 w-4 mr-2" />
                  {t('common:loading')}...
                </>
              ) : (
                t('shadowing.getTranscriptButton')
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
      
      <div className={cn(isLoading && "animate-pulse")}>
        {isLoading ? (
          <Skeleton className="aspect-video w-full rounded-xl" />
        ) : videoId ? (
          <div className="aspect-video w-full">
            <ShadowingPlayer
              ref={playerRef}
              videoId={videoId}
              onVideoEnd={handleVideoEnd}
              onVideoPlay={handleVideoPlay}
              onVideoPause={handleVideoPause}
            />
          </div>
        ) : (
          <div className="aspect-video w-full rounded-xl bg-muted/30 border-2 border-dashed flex flex-col items-center justify-center p-4 text-center">
            <Icon name="Youtube" className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <p className="text-headline-2 text-foreground">{t('shadowing.videoPlaceholderTitle')}</p>
            <p className="text-body-sm text-muted-foreground">{t('shadowing.videoPlaceholderDescription')}</p>
          </div>
        )}
      </div>
    </>
  );

  const renderContentPanel = () => {
    const listToRender = isShadowingMode && transcriptResult 
      ? transcriptResult.transcript.slice(0, completedLinesCount + 1) 
      : transcriptResult?.transcript || [];

    return (
      <Card className="flex flex-col h-full bg-transparent">
        <CardHeader className="p-3 flex-shrink-0">
          <div className="flex items-center justify-center gap-2">
            <Button 
              variant={isShadowingMode ? 'default' : 'outline'} 
              size="icon" 
              onClick={() => transcriptResult && setIsShadowingMode(prev => !prev)} 
              disabled={!transcriptResult} 
              className="h-11 w-11 transition-colors" 
              title={isShadowingMode ? t('shadowing.exitMode') : t('shadowing.startMode')}
            >
              <Icon name="Shadowing" className="h-5 w-5" />
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-11 w-11 transition-colors" 
                  disabled={!isShadowingMode || !transcriptResult}
                >
                  <Icon name="Settings" className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>{t('shadowing.settings.textDisplay')}</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={hideMode} onValueChange={(v) => setHideMode(v as any)}>
                  <DropdownMenuRadioItem value="block">
                    {t('shadowing.settings.hiddenWords')}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="blur">
                    {t('shadowing.settings.blurredText')}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="hidden">
                    {t('shadowing.settings.completelyHidden')}
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                
                <DropdownMenuSeparator />
                
                <DropdownMenuLabel>{t('shadowing.settings.checkingMode')}</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={checkMode} onValueChange={(v) => setCheckMode(v as any)}>
                  <DropdownMenuRadioItem value="strict">
                    {t('shadowing.settings.strict')}
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="gentle">
                    {t('shadowing.settings.gentle')}
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 min-h-0 p-0">
          <ScrollArea className="h-full">
            <div className="p-4">
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Card key={i} className="bg-card">
                      <CardContent className="p-3">
                        <Skeleton className="h-20 w-full" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : error ? (
                <Card className="bg-card border-destructive">
                  <CardContent className="p-4">
                    <Alert variant="destructive" className="border-0 bg-transparent p-0">
                      <AlertTitle>
                        {error === 'invalid_url' ? 'Invalid YouTube URL' : 'Could Not Get Transcript'}
                      </AlertTitle>
                      <AlertDescription>
                        {error === 'invalid_url' 
                          ? "Please enter a valid YouTube video URL." 
                          : error
                        }
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              ) : transcriptResult ? (
                <div className="space-y-3">
                  {listToRender.map((line, index) => (
                    <Card 
                      key={index} 
                      className={cn(
                        'transition-all duration-200 bg-card',
                        currentPlayingLine === index && isVideoPlaying && 'ring-2 ring-red-500 ring-opacity-50'
                      )}
                    >
                      <CardContent className="p-3">
                        <ShadowingBox 
                          line={line.text} 
                          startTime={line.start} 
                          hideMode={hideMode} 
                          checkMode={checkMode} 
                          onComplete={(isCorrect, res) => handleLineComplete(isCorrect, { ...res, lineIndex: index })} 
                          isCorrect={correctlyCompletedLines.has(index)} 
                          onPlay={() => handleBoxPlay(line.start, line.end, index)} 
                          onReveal={handleReveal} 
                          isPlaying={currentPlayingLine === index && isVideoPlaying} 
                          mode={isShadowingMode ? "shadowing" : "normal"} 
                          isOpen={openBoxIndex === index} 
                          onToggleOpen={(isOpen) => setOpenBoxIndex(isOpen ? index : null)} 
                          disabled={isShadowingMode && index < completedLinesCount && correctlyCompletedLines.has(index)}
                        />
                      </CardContent>
                    </Card>
                  ))}
                  
                  {isShadowingMode && completedLinesCount >= transcriptResult.transcript.length && (
                    <Card className="bg-card border-green-200 dark:border-green-800">
                      <CardContent className="p-6 text-center">
                        <Icon name="Check" className="h-12 w-12 text-green-500 mx-auto mb-4" />
                        <h3 className="text-headline-2 text-green-800 dark:text-green-400 mb-2">
                          All Exercises Completed
                        </h3>
                        <p className="text-body-base text-green-600 dark:text-green-300">
                          Great job! You have finished all shadowing exercises.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <Card className="bg-card">
                  <CardContent className="p-8 text-center">
                    <Icon name="Youtube" className="h-12 w-12 mx-auto mb-3 opacity-30 text-muted-foreground" />
                    <p className="text-body-base text-muted-foreground">
                      Enter a YouTube URL above to get started
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    );
  };
  
  // ✅ REFACTORED: Right column now only shows analysis
  const renderRightColumn = () => (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex-1 min-h-0">
        <ShadowingAnalysis 
          errorStats={tracking.errorStats} 
          wordsNeedingAttention={wordsToDisplay} 
          onConfirmWord={tracking.confirmWord} 
          showChart={tracking.shouldShowChart(openBoxIndex || 0)} 
          progressPercentage={progressPercentage} 
          completedLinesCount={completedLinesCount} 
          totalLines={transcriptResult?.transcript.length || 0} 
          isShadowingMode={isShadowingMode} 
        />
      </div>
    </div>
  );

  return (
    <VideoBasedLayout
      pageTitle={renderPageTitle()}
      searchAndVideoPanel={renderSearchAndVideoPanel()}
      activityPanel={<ActivitiesPanel />}
      contentPanel={renderContentPanel()}
      rightColumnPanel={renderRightColumn()}
    />
  );
}