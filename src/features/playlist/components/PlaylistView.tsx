

"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useAudioPlayer } from '@/contexts/audio-player-context';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Book, PlaylistRepeatMode, PlaylistItem as TPlaylistItem } from '@/lib/types';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { NowPlayingCard } from '@/features/playlist/components/NowPlayingCard';
import { CoverImage } from '@/features/library/components/CoverImage';
import Link from 'next/link';


export default function PlaylistView() {
  const { 
    playlist, 
    removePlaylistItem, 
    clearPlaylist, 
    currentPlayingItem, 
    isPlaying, 
    startPlayback, 
    pauseAudio,
    playlistRepeatMode,
    setPlaylistRepeatMode
  } = useAudioPlayer();
  const { t } = useTranslation(['playlist', 'common', 'toast']);
  const { toast } = useToast();

  const [itemToRemove, setItemToRemove] = useState<TPlaylistItem | null>(null);
  const [isClearingPlaylist, setIsClearingPlaylist] = useState(false);
  const [activeDisplayId, setActiveDisplayId] = useState<string | null>(null);

  const itemForDisplay = useMemo(() => {
    const currentPlayingId = currentPlayingItem?.itemId;
    if (currentPlayingId) {
        const playingItem = playlist.find(p => p.id === currentPlayingId);
        if (playingItem) return playingItem;
    }
    if (activeDisplayId) {
        const activeItem = playlist.find(p => p.id === activeDisplayId);
        if (activeItem) return activeItem;
    }
    return playlist.length > 0 ? playlist[0] : null;
  }, [currentPlayingItem, playlist, activeDisplayId]);


  useEffect(() => {
    const currentPlayingId = currentPlayingItem?.itemId;
    if (currentPlayingId) {
        setActiveDisplayId(currentPlayingId);
    }
  }, [currentPlayingItem?.itemId]);

  const handlePlayFromPlaylist = (item: TPlaylistItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (currentPlayingItem?.itemId === item.id && isPlaying) {
      pauseAudio();
    } else {
      startPlayback(item);
    }
  };

  const handleConfirmRemove = () => {
    if (itemToRemove) {
      removePlaylistItem(itemToRemove.id);
      toast({
        title: t('toast:removedFromPlaylist'),
        description: t('toast:removedFromPlaylistDesc', { title: itemToRemove.title }),
      });
      setItemToRemove(null);
    }
  };
  
  const handleConfirmClearPlaylist = () => {
    setIsClearingPlaylist(true);
    clearPlaylist();
    toast({
        title: t('toast:playlistCleared'),
        description: t('toast:playlistClearedDesc'),
    });
    setIsClearingPlaylist(false);
  };

  const openRemoveDialog = (item: TPlaylistItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setItemToRemove(item);
  };

  const handlePlaylistRepeatToggle = () => {
    const newMode: PlaylistRepeatMode = playlistRepeatMode === 'all' ? 'off' : 'all';
    setPlaylistRepeatMode(newMode);
  };

  if (playlist.length === 0) {
    return (
      <div className="flex items-center justify-center pt-20">
        <Card className="w-full max-w-lg text-center shadow-lg">
          <CardHeader className="pt-10">
              <Icon name="ListMusic" className="mx-auto h-16 w-16 text-primary mb-4" />
              <CardTitle className="font-headline text-2xl">{t('emptyPlaylist')}</CardTitle>
              <CardDescription className="font-body max-w-sm mx-auto">
              {t('emptyPlaylistHint')}
              </CardDescription>
          </CardHeader>
          <CardContent className="pb-8">
              <Button asChild>
                  <Link href="/library/book">
                      <Icon name="Library" className="mr-2 h-4 w-4"/>
                      {t('goToLibraryButton')}
                  </Link>
              </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="md:col-span-1 bg-card flex flex-col h-[calc(100vh-140px)] overflow-hidden">
                <CardHeader className="p-4">
                    <div className="flex justify-between items-start">
                        <CardTitle className="font-headline text-xl md:text-2xl">{t('pageTitle')}</CardTitle>
                        <div className="flex items-center gap-1">
                            <TooltipProvider>
                               <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                          variant={playlistRepeatMode === 'all' ? 'secondary' : 'ghost'}
                                          size="icon"
                                          className="h-8 w-8"
                                          onClick={handlePlaylistRepeatToggle}
                                          aria-pressed={playlistRepeatMode === 'all'}
                                        >
                                            <Icon name="Repeat" className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>{t('repeatPlaylistButton')}</p></TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isClearingPlaylist}>
                                                    <Icon name="Trash2" className="h-4 w-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>{t('common:alertDialog.areYouSure')}</AlertDialogTitle>
                                                <AlertDialogDescription>{t('clearPlaylistConfirmation')}</AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
                                                <AlertDialogAction onClick={handleConfirmClearPlaylist} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                                                {isClearingPlaylist && <Icon name="Wand2" className="mr-2 h-4 w-4 animate-pulse" />}
                                                {t('common:alertDialog.delete')}
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TooltipTrigger>
                                    <TooltipContent><p>{t('clearAllButton')}</p></TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="flex-1 p-0 min-h-0">
                    <ScrollArea className="h-full">
                        <div className="space-y-1 p-2">
                            {playlist.map((item) => {
                                const itemId = item.id;
                                const itemTitle = (item.data as Book)?.title?.primary || item.title;
                                
                                const isCurrentlyPlaying = currentPlayingItem?.itemId === itemId && isPlaying;
                                const selectedId = itemForDisplay?.id;
                                const isSelected = selectedId === itemId;

                                const isBook = item.type === 'book';
                                const bookData = isBook ? (item.data as Book) : null;
                                
                                return (
                                    <div
                                        key={itemId}
                                        onClick={() => setActiveDisplayId(itemId)}
                                        className={cn(
                                            "p-2 rounded-lg flex items-center gap-3 cursor-pointer transition-colors duration-200",
                                            isSelected ? "bg-primary/10" : "hover:bg-muted"
                                        )}
                                    >
                                        <div className={cn(
                                            "relative w-12 h-16 rounded-md overflow-hidden flex-shrink-0 flex items-center justify-center cover-shadow-overlay",
                                            isBook ? 'bg-muted' : 'bg-primary'
                                        )}>
                                            {isBook && bookData ? (
                                                 <CoverImage
                                                    title={itemTitle}
                                                    coverStatus={bookData.coverStatus}
                                                    cover={bookData.cover}
                                                    imageHint={bookData.imageHint}
                                                    isRetrying={false}
                                                />
                                            ) : (
                                                <Icon name="PackageOpen" className="h-8 w-8 text-primary-foreground" />
                                            )}

                                            {isCurrentlyPlaying && (
                                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                                    <Icon name="Volume2" className="h-6 w-6 text-white" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0 grid grid-cols-1">
                                            <p className={cn("font-semibold truncate", isSelected ? "text-primary" : "text-foreground")}>{itemTitle}</p>
                                            {isBook && <p className="text-sm text-muted-foreground truncate">{bookData?.author}</p>}
                                            {!isBook && <p className="text-sm text-muted-foreground truncate">{t('vocabFolder')}</p>}
                                        </div>
                                        <div className="flex-shrink-0 flex items-center">
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => handlePlayFromPlaylist(item, e)}>
                                                <Icon name={isCurrentlyPlaying ? 'Pause' : 'Play'} className="h-5 w-5" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={(e) => openRemoveDialog(item, e)}>
                                                <Icon name="X" className="h-5 w-5" />
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>
            
            <div className="md:col-span-2 hidden md:flex items-center justify-center h-[calc(100vh-140px)]">
                <NowPlayingCard item={itemForDisplay} onRemove={(item) => setItemToRemove(item)} onPlay={handlePlayFromPlaylist} />
            </div>
        </div>
      
      {itemToRemove && (
        <AlertDialog open={!!itemToRemove} onOpenChange={() => setItemToRemove(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('common:alertDialog.areYouSure')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('removeFromPlaylistConfirmation', { title: itemToRemove.title })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmRemove} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                {t('common:remove')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
