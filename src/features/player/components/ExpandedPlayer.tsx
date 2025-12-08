
'use client';

import React, { useMemo } from 'react';
import { useAudioPlayer } from '@/contexts/audio-player-context';
import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icons';
import { Progress } from '@/components/ui/progress';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { useMobile } from '@/hooks/useMobile';
import { AudioSettingsPopover } from '@/features/player/components/AudioSettingsPopover';
import { motion } from "framer-motion";
import type { PlaylistItem as TPlaylistItem, Book, RepeatMode, ChapterTitle, PlaylistRepeatMode } from '@/lib/types';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";


export function ExpandedPlayer() {
    const audioPlayer = useAudioPlayer();
    const { t } = useTranslation(['miniAudioPlayer', 'common', 'readerPage']);
    const isMobile = useMobile();

    const {
        isPlaying,
        isLoading,
        currentPlayingItem,
        playlist,
        canGoNext,
        canGoPrevious,
        pauseAudio,
        resumeAudio,
        skipToNextItem,
        skipToPreviousItem,
        seekToSegment,
        skipForward,
        skipBackward,
        startPlayback,
        setPlayerState,
        repeatMode,
        setRepeatMode,
        sleepTimerDuration,
        setSleepTimer,
        stopAudio,
        overallProgressPercentage,
        position,
        playlistRepeatMode,
        setPlaylistRepeatMode,
    } = audioPlayer;
    
    if (!currentPlayingItem) return null;

    const handlePlayPause = () => {
        if (isPlaying) {
            pauseAudio();
        } else {
            resumeAudio();
        }
    };

    const handleProgressClick = (event: React.MouseEvent<HTMLDivElement>) => {
        // This logic is now simplified as the engine handles the details
        // A more advanced implementation could be done inside the engine
    };

    const [primaryLang] = currentPlayingItem.originLanguages.split('-');
    const bookTitleToShow = currentPlayingItem.title;
    
    const chapterTitleToShow = useMemo(() => {
        if (currentPlayingItem.type !== 'book') return '';
        const chapter = (currentPlayingItem.data as Book)?.chapters[position.chapterIndex ?? 0];
        if (!chapter) return t('common:loading');
        
        const titleObj = chapter.title;
        if (typeof titleObj === 'object' && titleObj !== null) {
             return (titleObj as ChapterTitle)[chapter.metadata?.primaryLanguage || primaryLang] || Object.values(titleObj)[0] || t('common:untitled');
        }
        return String(titleObj);
    }, [currentPlayingItem, position.chapterIndex, t, primaryLang]);


    const readerPageHref = currentPlayingItem
        ? `/read/${currentPlayingItem.id}`
        : "/library";

    const chaptersForMenu = (currentPlayingItem?.type === 'book') ? (currentPlayingItem.data as Book).chapters : null;

    const handleChapterSelect = async (chapterIndex: number) => {
        if (isLoading || !currentPlayingItem || currentPlayingItem.type !== 'book') return;
        if (position?.chapterIndex !== chapterIndex) {
            startPlayback(currentPlayingItem, { chapterIndex });
        }
    }
    
    const handleRepeatToggle = () => {
        const nextMode: RepeatMode = repeatMode === 'item' ? 'off' : 'item';
        setRepeatMode(nextMode);
    };

    const getRepeatIconName = (): IconName => {
        return repeatMode === 'item' ? 'Repeat1' : 'Repeat';
    };

    const repeatButtonTooltip = repeatMode === 'item' ? t('audioSettings.repeatItem') : t('audioSettings.repeatOff');
    
    const handlePlaylistRepeatToggle = () => {
      const newMode: PlaylistRepeatMode = playlistRepeatMode === 'all' ? 'off' : 'all';
      setPlaylistRepeatMode(newMode);
    };

    const sleepTimerOptions = [
        { labelKey: 'sleepTimer.off', value: null },
        { labelKey: 'sleepTimer.option10min', value: 10 },
        { labelKey: 'sleepTimer.option15min', value: 15 },
        { labelKey: 'sleepTimer.option30min', value: 30 },
        { labelKey: 'sleepTimer.option60min', value: 60 },
    ];


    return (
        <motion.div
            className="fixed bottom-0 left-0 right-0 bg-card border-t p-3 shadow-lg z-50 print:hidden flex flex-col justify-center"
            drag="y"
            dragConstraints={{ top: 0, bottom: 100 }}
            dragElastic={{ top: 0.1, bottom: 1 }}
            onDragEnd={(event, info) => {
                if (info.offset.y > 50) { 
                    setPlayerState('collapsed');
                }
            }}
            initial={{ y: 68 }}
            animate={{ y: 0 }}
            exit={{ y: 68 }}
            transition={{ type: 'spring', stiffness: 400, damping: 40 }}
        >
            <div className="container mx-auto flex items-center justify-between gap-1 md:gap-4 px-2 sm:px-4">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <div className="flex items-center gap-2 md:gap-3 overflow-hidden flex-shrink min-w-0 md:w-1/3 lg:w-1/4 hover:opacity-80 transition-opacity cursor-pointer">
                            {isLoading && currentPlayingItem ? (
                            <Icon name="BookOpen" className="h-7 w-7 md:h-8 md:w-8 text-primary animate-pulse flex-shrink-0" />
                            ) : (
                            <Icon name="BookOpen" className="h-7 w-7 md:h-8 md:w-8 text-primary flex-shrink-0" />
                            )}
                            <div className="flex-grow overflow-hidden">
                            <p className="text-sm md:text-base font-semibold truncate font-body" title={bookTitleToShow}>
                                {bookTitleToShow}
                            </p>
                            <p className="text-xs text-muted-foreground truncate font-body" title={chapterTitleToShow}>
                                {chapterTitleToShow}
                            </p>
                            </div>
                        </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-72 font-body mb-2" side="top" align="start">
                        {chaptersForMenu && chaptersForMenu.length > 0 ? chaptersForMenu.map((chapter, index) => {
                            const isCurrent = position?.chapterIndex === index;
                            return (
                                <DropdownMenuItem key={chapter.id} onSelect={() => handleChapterSelect(index)} disabled={isLoading} className={cn("cursor-pointer", isCurrent && "bg-accent/50")}>
                                    <div className="flex items-center justify-between w-full">
                                        <span className={cn(isCurrent && "font-bold text-primary")}>
                                            {t('chapterIndicator', { ns: 'readerPage', chapterNum: index + 1, chapterTitle: chapter.title[chapter.metadata?.primaryLanguage || primaryLang] })}
                                        </span>
                                        {isCurrent && (
                                            <Link href={readerPageHref} onClick={(e) => e.stopPropagation()} className="p-1 -mr-1 rounded-sm hover:bg-accent">
                                            <Icon name="BookOpen" className="h-4 w-4 text-primary" />
                                            </Link>
                                        )}
                                    </div>
                                </DropdownMenuItem>
                            );
                        }) : (
                            <DropdownMenuItem asChild>
                                <Link href={readerPageHref} className="font-semibold text-primary">
                                    <Icon name="BookOpen" className="mr-2 h-4 w-4" /> 
                                    {t('common:goToReader')}
                                </Link>
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>

                <div className="flex items-center gap-0 flex-shrink-0">
                {!isMobile && (
                    <Button variant="ghost" size="icon" onClick={skipToPreviousItem} disabled={!canGoPrevious || isLoading} title={t('previousItem')} aria-label={t('previousItem')} className="h-10 w-10 md:h-11 md:w-11">
                    <Icon name="SkipBack" className="h-6 w-6" />
                    </Button>
                )}
                <Button variant="ghost" size="icon" onClick={skipBackward} disabled={isLoading || !currentPlayingItem} title={t('skipBackwardTooltip')} aria-label={t('skipBackwardTooltip')} className="h-10 w-10 md:h-11 md:w-11">
                    <Icon name="RotateCw" className="h-6 w-6" />
                </Button>

                <Button variant="default" size="icon" onClick={handlePlayPause} className="h-11 w-11 md:h-12 md:w-12 p-0 rounded-full shadow-lg" title={isPlaying ? t('audioSettings.pause') : t('audioSettings.play')} aria-label={isPlaying ? t('audioSettings.pause') : t('audioSettings.play')} disabled={isLoading || (!currentPlayingItem && audioPlayer.playlist.length === 0 )}>
                    {isLoading ? <Icon name="Wand2" className="h-6 w-6 md:h-7 md:w-7 animate-pulse" /> : <Icon name={isPlaying ? "Pause" : "Play"} className="h-6 w-6 md:h-7 md:w-7" />}
                </Button>

                <Button variant="ghost" size="icon" onClick={skipForward} disabled={isLoading || !currentPlayingItem} title={t('skipForwardTooltip')} aria-label={t('skipForwardTooltip')} className="h-10 w-10 md:h-11 md:w-11">
                    <Icon name="IterationCw" className="h-6 w-6" />
                </Button>
                
                {!isMobile && (
                    <Button variant="ghost" size="icon" onClick={skipToNextItem} disabled={!canGoNext || isLoading} title={t('nextItem')} aria-label={t('nextItem')} className="h-10 w-10 md:h-11 md:w-11">
                    <Icon name="SkipForward" className="h-6 w-6" />
                    </Button>
                )}
                </div>

                <div className={cn("flex items-center gap-1 flex-shrink-0 justify-end", isMobile ? "w-auto" : "md:w-1/3 lg:w-1/4")}>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button onClick={handleRepeatToggle} variant="ghost" size="icon" aria-label={repeatButtonTooltip} className={cn("h-8 w-8 md:h-9 md:w-9", isLoading && "opacity-50 cursor-not-allowed", repeatMode === 'item' && "bg-primary/20 text-primary hover:bg-primary/30")} disabled={isLoading}>
                                    <Icon name={getRepeatIconName()} className="h-4 w-4 md:h-5 md:w-5"/>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top"><p>{repeatButtonTooltip}</p></TooltipContent>
                        </Tooltip>
                         <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={cn("h-8 w-8 md:h-9 md:w-9", playlistRepeatMode === 'all' && 'text-primary bg-primary/20')}
                                  onClick={handlePlaylistRepeatToggle}
                                  disabled={isLoading}
                                >
                                  <Icon name="Repeat" className="h-4 w-4 md:h-5 md:w-5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{playlistRepeatMode === 'all' ? t('repeatPlaylistOn') : t('repeatPlaylistOff')}</p>
                            </TooltipContent>
                        </Tooltip>
                        <DropdownMenu>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" aria-label={t('sleepTimer.title')} className={cn("h-8 w-8 md:h-9 md:w-9", sleepTimerDuration && "bg-primary/20 text-primary ring-1 ring-primary/50")} disabled={isLoading}>
                                            <Icon name="Clock" className="h-4 w-4 md:h-5 md:w-5" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                </TooltipTrigger>
                                <TooltipContent side="top"><p>{t('sleepTimer.title')}</p></TooltipContent>
                            </Tooltip>
                            <DropdownMenuContent className="w-48 font-body mb-2" side="top" align="end">
                                {sleepTimerOptions.map(option => (
                                    <DropdownMenuItem key={option.value === null ? 'off' : option.value} onClick={() => setSleepTimer(option.value)} className={cn(sleepTimerDuration === option.value && "bg-accent")}>
                                        {t(option.labelKey as any)}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </TooltipProvider>

                    <AudioSettingsPopover disabled={isLoading || audioPlayer.availableSystemVoices.length === 0}>
                        <Button variant="ghost" size="icon" title={t('audioSettings.title')} aria-label={t('audioSettings.title')} className="h-8 w-8 md:h-9 md:w-9">
                            <Icon name="Settings" className="h-4 w-4 md:h-5 md:w-5" />
                        </Button>
                    </AudioSettingsPopover>
                    
                    <Button variant="ghost" size="icon" onClick={stopAudio} disabled={isLoading} title={t('common:close')} aria-label={t('common:close')} className="text-destructive hover:text-destructive-foreground hover:bg-destructive/90 h-8 w-8 md:h-9 md:w-9">
                        <Icon name="X" className="h-4 w-4 md:h-5 md:w-5" />
                    </Button>
                </div>
            </div>
            <div
                className="w-full h-1 bg-muted cursor-pointer group absolute bottom-0 left-0 right-0 hover:h-1.5 transition-all duration-150"
                onClick={handleProgressClick}
                title={t('progressTooltip')}
                aria-label={t('progressTooltip')}
            >
                <Progress value={isLoading ? undefined : overallProgressPercentage} className="h-full w-full rounded-none" indicatorClassName={cn("group-hover:bg-primary bg-primary/70 transition-colors", isLoading && "animate-pulse")} />
            </div>
        </motion.div>
    );
}
