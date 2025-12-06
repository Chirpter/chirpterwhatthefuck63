// src/features/learning/components/shadowing/ShadowingView.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getTranscriptFromUrl, type TranscriptResult } from '@/features/learning/services/shadowing.service';
import { useToast } from '@/hooks/useToast';
import { Card, CardContent } from '@/components/ui/card';
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
import { useAuth } from '@/contexts/auth-context';
import { ActivitiesPanel } from '../activities/ActivitiesPanel';
import { Progress } from '@/components/ui/progress';
import { ShadowingHistory } from './ShadowingHistory';
import { ShadowingAnalysis } from './ShadowingAnalysis';
import { useShadowingTracking } from '@/features/learning/hooks/useShadowingTracking';
import { useVideoHistory } from '@/features/learning/hooks/useVideoHistory';
import { ShadowingPlayer, type ShadowingPlayerHandle } from './ShadowingPlayer';

interface HistoryItem {
  videoId: string;
  url: string;
  title: string;
  thumbnail?: string;
  totalLines?: number;
  progress?: number[];
  lastAccessed?: number;
}

const isValidYouTubeUrl = (url: string) => {
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const u = new URL(trimmed);
    const host = u.hostname;
    return host === 'youtu.be' || host.includes('youtube.com') || host.includes('youtu.be');
  } catch {
    return false;
  }
};

export default function ShadowingView() {
  const { t } = useTranslation(['learningPage', 'common', 'toast']);
  const { toast } = useToast();
  const { user } = useAuth();

  const [url, setUrl] = useState('');
  const [transcriptResult, setTranscriptResult] = useState<TranscriptResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isShadowingMode, setIsShadowingMode] = useState(false);
  const [completedLinesCount, setCompletedLinesCount] = useState(0);
  const [correctlyCompletedLines, setCorrectlyCompletedLines] = useState<Set<number>>(new Set());
  const [currentPlayingLine, setCurrentPlayingLine] = useState<number | null>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  const [hideMode, setHideMode] = useState<'block' | 'blur' | 'hidden'>('block');
  const [checkMode, setCheckMode] = useState<'strict' | 'gentle'>('gentle');

  const playerRef = useRef<ShadowingPlayerHandle>(null);
  const [openBoxIndex, setOpenBoxIndex] = useState<number | null>(0);

  const videoId = useMemo(() => {
    const trimmed = url.trim();
    if (!trimmed) return null;
    try {
      const u = new URL(trimmed);
      if (u.hostname === 'youtu.be') return u.pathname.slice(1);
      if (u.hostname.includes('youtube.com')) return u.searchParams.get('v');
    } catch {
      return null;
    }
    return null;
  }, [url]);

  const { history, addToHistory, updateHistoryProgress, clearHistory } = useVideoHistory();
  
  const tracking = useShadowingTracking(videoId);

  const [progress, setProgress] = useState<number[]>([]);
  
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

  const clearProgress = useCallback(() => {
    if (!videoId) return;
    setProgress([]);
    try {
      localStorage.removeItem(`shadowing-progress-${videoId}`);
    } catch (e) {
      console.error(e);
    }
  }, [videoId]);

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

  useEffect(() => {
    if (!videoId || progress.length === 0) return;
    
    const timer = setTimeout(() => {
      updateHistoryProgress(videoId, progress);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [videoId, progress.length, updateHistoryProgress]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('shadowing-hideMode');
      if (saved) setHideMode(saved as 'block' | 'blur' | 'hidden');
      const savedCheck = localStorage.getItem('shadowing-checkMode');
      if (savedCheck) setCheckMode(savedCheck as 'strict' | 'gentle');
    } catch (e) {
      // Ignore
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('shadowing-hideMode', hideMode);
  }, [hideMode]);

  useEffect(() => {
    localStorage.setItem('shadowing-checkMode', checkMode);
  }, [checkMode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
        e.preventDefault();
        if (transcriptResult) setIsShadowingMode(prev => !prev);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [transcriptResult]);

  const handleFetchTranscript = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;

    if (!user) {
      toast({
        title: t('toast:authErrorTitle'),
        description: t('toast:authErrorDesc'),
        variant: 'destructive'
      });
      return;
    }

    if (!isValidYouTubeUrl(trimmed)) {
      setError('invalid_url');
      return;
    }

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

      const vid = videoId!;
      addToHistory({
        videoId: vid,
        url,
        title: result.title,
        thumbnail: result.thumbnail,
        totalLines: result.transcript.length
      });
    } catch (err: any) {
      const msg = err?.message ?? 'An unknown error occurred. Please try again.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [url, user, t, toast, videoId, addToHistory]);

  const formatTime = useCallback((seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }, []);

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

  const handleReveal = useCallback(() => {
    tracking.onReveal();
  }, [tracking]);

  const handleVideoEnd = useCallback(() => setCurrentPlayingLine(null), []);
  const handleVideoPlay = useCallback(() => setIsVideoPlaying(true), []);
  const handleVideoPause = useCallback(() => setIsVideoPlaying(false), []);

  const handleCopyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: t('toast:copySuccessTitle'),
        description: t('toast:copySuccessDesc')
      });
    }).catch(() => {
      toast({ title: 'Copy failed', description: '' });
    });
  }, [toast, t]);

  const handleLineComplete = useCallback((isCorrect: boolean, result: ShadowingResult) => {
    const { lineIndex } = result;

    // Track submission - use session index for tracking
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

    // Only show next box if current box is correct
    // Box sau chỉ hiện khi submit box trước (và box trước phải đúng)
    if (isCorrect) {
      setOpenBoxIndex(lineIndex + 1);
    } else {
      setOpenBoxIndex(lineIndex);
    }
  }, [tracking, updateProgress]);

  const handleHistoryItemClick = useCallback((item: HistoryItem) => {
    setUrl(item.url);
    setTimeout(() => void handleFetchTranscript(), 100);
  }, [handleFetchTranscript]);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    toast({
      title: 'History Cleared',
      description: 'All video history has been removed.'
    });
  }, [clearHistory, toast]);

  const wordsToDisplay = useMemo(() => {
    return tracking.getWordsNeedingAttention();
  }, [tracking]);

  const progressPercentage = transcriptResult ?
    Math.round((completedLinesCount / transcriptResult.transcript.length) * 100) : 0;

  const transcriptContent = useMemo(() => {
    if (isLoading) return (
      <div className="text-center py-10 space-y-4">
        <div className="flex justify-center">
          <div className="relative">
            <Icon name="Wand2" className="h-12 w-12 text-primary animate-pulse" />
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-lg text-muted-foreground font-medium">Loading transcript</p>
          <p className="text-sm text-muted-foreground/70">Fetching transcript data...</p>
        </div>
      </div>
    );

    if (error) {
      const isInvalid = error === 'invalid_url';
      const isLimit = typeof error === 'string' && error.includes('limit');
      return (
        <Alert variant="default" className="mt-6 border-destructive/50">
          <AlertTitle className="font-heading text-destructive">
            {isInvalid ? 'Invalid YouTube URL' : isLimit ? 'Error Loading Transcript' : 'Could Not Get Transcript'}
          </AlertTitle>
          <AlertDescription className="font-body text-destructive/90">
            {isInvalid ? (
              <div>
                <p className="mb-3">The URL you entered is not a valid YouTube link.</p>
                <p className="font-medium mb-1">Example:</p>
                <p className="font-mono text-sm bg-destructive/10 px-2 py-1 rounded">
                  youtube.com/watch?v=VIDEO_ID
                </p>
              </div>
            ) : isLimit ? error : (
              <div>
                <p>{error}</p>
                <br />
                <p>This could mean:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>The video doesn't have captions enabled (CC)</li>
                  <li>The video is private, restricted, or doesn't allow embedding</li>
                  <li>The video is not available in your region</li>
                  <li>A technical issue occurred while processing</li>
                </ul>
              </div>
            )}
          </AlertDescription>
        </Alert>
      );
    }

    if (!transcriptResult) return null;

    const { transcript } = transcriptResult;

    if (isShadowingMode) {
      return (
        <div className="space-y-3">
          {transcript.map((line, index) => {
            // Show only current box and next box (if current is correct)
            const shouldShow = index <= completedLinesCount;
            if (!shouldShow) return null;

            const isPlaying = currentPlayingLine === index && isVideoPlaying;
            const isCompleted = index < completedLinesCount;
            const isCorrect = correctlyCompletedLines.has(index);
            
            return (
              <Card key={index} className={cn(
                'transition-all duration-200',
                isPlaying && 'ring-2 ring-red-500 ring-opacity-50',
                isCompleted && 'opacity-70'
              )}>
                <CardContent className="p-3">
                  <ShadowingBox
                    line={line.text}
                    startTime={line.start}
                    hideMode={hideMode}
                    checkMode={checkMode}
                    onComplete={(isCorrect, res) => handleLineComplete(isCorrect, { ...res, lineIndex: index })}
                    isCorrect={isCorrect}
                    onPlay={() => handleBoxPlay(line.start, line.end, index)}
                    onReveal={handleReveal}
                    isPlaying={isPlaying}
                    mode="shadowing"
                    isOpen={openBoxIndex === index}
                    onToggleOpen={(isOpen) => setOpenBoxIndex(isOpen ? index : null)}
                    disabled={isCompleted && isCorrect}
                  />
                </CardContent>
              </Card>
            );
          })}

          {completedLinesCount >= transcript.length && (
            <div className="text-center py-8 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-lg border border-green-200 dark:border-green-800">
              <Icon name="Check" className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-green-800 dark:text-green-400 mb-2">
                All Exercises Completed
              </h3>
              <p className="text-green-600 dark:text-green-300 mb-4">
                Great job! You have finished all shadowing exercises.
              </p>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {transcript.map((line, index) => {
          const isPlaying = currentPlayingLine === index && isVideoPlaying;
          return (
            <Card key={index} className={cn(
              'group/line transition-all duration-200',
              isPlaying && 'ring-2 ring-red-500 ring-opacity-50'
            )}>
              <CardContent className="p-3">
                <div className="grid grid-cols-[40px_1fr] gap-3 items-start">
                  <div className="flex flex-col items-center space-y-2">
                    <div className="text-xs font-mono text-primary">
                      {formatTime(line.start)}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleBoxPlay(line.start, line.end, index)}
                      className={cn(
                        'h-7 w-7 transition-colors',
                        isPlaying ? 'text-red-600 bg-red-50' : 'text-foreground hover:text-red-600'
                      )}
                    >
                      <Icon name={isPlaying ? 'Pause' : 'Play'} className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="relative">
                    <div className="text-[15px] leading-relaxed font-light">
                      {line.text}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCopyToClipboard(line.text)}
                      className="absolute right-0 top-0 h-7 w-7 opacity-0 group-hover/line:opacity-100 transition-opacity"
                      aria-label={t('common:copy')}
                    >
                      <Icon name="Copy" className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }, [
    isLoading,
    error,
    transcriptResult,
    isShadowingMode,
    completedLinesCount,
    currentPlayingLine,
    isVideoPlaying,
    correctlyCompletedLines,
    hideMode,
    checkMode,
    openBoxIndex,
    handleLineComplete,
    handleBoxPlay,
    handleReveal,
    handleCopyToClipboard,
    formatTime,
    t
  ]);

  return (
    <div className="learningtool-style space-y-6">
      <h2 className="text-xl md:text-2xl font-headline font-semibold">
        {t('shadowing.title')}
      </h2>

      {/* UPDATED: Changed from xl:grid-cols-3 to md:grid-cols-3 to match VideoVocab */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column - Natural height */}
        <div className="md:col-span-1 flex flex-col gap-4">
          <Card>
            <CardContent className="p-3">
              <form onSubmit={handleFetchTranscript} className="flex items-center gap-2">
                <div className="relative flex-grow w-full">
                  <Icon name="Youtube" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder={t('shadowing.urlPlaceholder')}
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleFetchTranscript()}
                    className="font-body pl-9 h-10 transition-colors"
                    disabled={isLoading}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isLoading || !url}
                  className="h-10 px-4 transition-colors"
                >
                  {isLoading ? (
                    <>
                      <Icon name="Loader2" className="animate-spin h-4 w-4 mr-2" />
                      {t('common:loading')}...
                    </>
                  ) : t('shadowing.getTranscriptButton')}
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
                <p className="font-semibold text-foreground">
                  {t('shadowing.videoPlaceholderTitle')}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t('shadowing.videoPlaceholderDescription')}
                </p>
              </div>
            )}
          </div>

          <ActivitiesPanel />
        </div>

        {/* Middle Column - FIXED HEIGHT with internal scroll */}
        <div className="md:col-span-1">
          <Card className="flex flex-col h-[70vh] min-h-[500px] max-h-[800px] bg-reader-grid">
            <div className="p-3 flex-shrink-0">
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant={isShadowingMode ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => {
                    if (!transcriptResult) return;
                    setIsShadowingMode(prev => !prev);
                  }}
                  disabled={!transcriptResult}
                  className="h-11 w-11 transition-colors"
                  title={isShadowingMode ? t('shadowing.exitMode') : `${t('shadowing.startMode')} (Ctrl + M)`}
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
                    <DropdownMenuRadioGroup
                      value={hideMode}
                      onValueChange={(v) => setHideMode(v as 'block' | 'blur' | 'hidden')}
                    >
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
                    <DropdownMenuRadioGroup
                      value={checkMode}
                      onValueChange={(v) => setCheckMode(v as 'strict' | 'gentle')}
                    >
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
            </div>

            {/* Transcript with FIXED height and internal scroll */}
            <div className="flex-1 min-h-0 p-4">
              <ScrollArea className="h-full">
                {transcriptContent}
              </ScrollArea>
            </div>
          </Card>
        </div>

        {/* Right Column - FIXED HEIGHT with internal scroll */}
        <div className="md:col-span-1 flex flex-col gap-4">
          {/* Analysis - FIXED height with scroll */}
          <div className="h-[45vh] min-h-[350px] max-h-[500px]">
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
          
          {/* History - FIXED height */}
          <div className="h-[25vh] min-h-[200px] max-h-[300px]">
            <ShadowingHistory
              history={history}
              currentVideoId={videoId}
              onItemClick={handleHistoryItemClick}
              onClearHistory={handleClearHistory}
            />
          </div>
        </div>
      </div>
    </div>
  );
}