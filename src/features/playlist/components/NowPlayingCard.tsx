'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { PlaylistItem as TPlaylistItem, Book } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useAudioPlayer } from '@/contexts/audio-player-context';
import CoverImage from '@/features/library/components/CoverImage';


export function NowPlayingCard({ item, onRemove, onPlay }: { item: TPlaylistItem | null; onRemove: (item: TPlaylistItem) => void; onPlay: (item: TPlaylistItem) => void; }) {
  const { t } = useTranslation(['playlist', 'bookCard']);
  const { currentPlayingItem, isPlaying, pauseAudio, resumeAudio } = useAudioPlayer();
  
  if (!item) {
     return (
      <div className="text-center text-muted-foreground p-4">
          <Icon name="ListMusic" className="mx-auto h-12 w-12 mb-2" />
          <p className="text-body-base">{t('nowPlaying.selectItem')}</p>
      </div>
    );
  }

  const itemId = item.id;
  const itemTitle = item.title;
  const itemAuthor = (item.data as Book)?.author || '';

  const isThisItemPlaying = currentPlayingItem?.id === itemId && isPlaying;
  
  const handlePlayPauseFromPlaylist = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (currentPlayingItem?.id === itemId) {
      if (isPlaying) {
        pauseAudio();
      } else {
        resumeAudio();
      }
    } else {
      onPlay(item);
    }
  };
  const playButtonIcon = isThisItemPlaying ? 'Pause' : 'Play';


  const handleConfirmRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove(item);
  };

  const isBook = item.type === 'book';

  const renderVisuals = () => {
    if (isBook) {
      const bookData = item.data as Book;
      return (
        <div className="relative w-64 h-auto aspect-[3/4] shadow-2xl rounded-lg overflow-hidden bg-muted cover-shadow-overlay">
            <CoverImage
                title={itemTitle}
                author={itemAuthor}
                coverStatus={bookData.coverStatus}
                cover={bookData.cover}
                imageHint={bookData.imageHint}
                isRetrying={false}
            />
        </div>
      );
    } else {
      // Static UI for Vocabulary Sets
      return (
        <div className="relative w-60 h-auto aspect-[3/4] shadow-2xl rounded-lg overflow-hidden bg-primary flex items-center justify-center p-4">
            <div className="relative">
                <Icon name="PackageOpen" className="h-32 w-32 text-primary-foreground opacity-80" />
                <span className="absolute -top-4 -left-4 text-3xl font-bold font-serif text-foreground transform -rotate-12">A</span>
                <span className="absolute -top-2 right-10 text-4xl font-bold font-serif text-foreground transform rotate-12">字</span>
                <span className="absolute top-16 -left-10 text-2xl font-bold font-serif text-foreground transform rotate-6">ü</span>
                <span className="absolute bottom-2 -right-8 text-3xl font-bold font-serif text-foreground transform -rotate-6">Ñ</span>
                <span className="absolute bottom-10 left-2 text-2xl font-bold font-serif text-foreground transform rotate-12">가</span>
            </div>
        </div>
      );
    }
  };
  
  return (
      <div
          key={itemId}
          className="flex flex-col items-center justify-center text-center gap-2"
      >
          {renderVisuals()}
          <div>
              <h3 className="text-headline-2">{itemTitle}</h3>
              {isBook && <p className="text-body-sm">{t('bookCard:byAuthor', { author: itemAuthor })}</p>}
              {!isBook && <p className="text-body-sm">{t('vocabFolder')}</p>}
          </div>
          <div className="flex items-center gap-4">
              <Button onClick={handlePlayPauseFromPlaylist} size="lg" className="rounded-full h-16 w-16 p-0 shadow-lg">
                  <Icon name={playButtonIcon} className="h-8 w-8" />
              </Button>
              <AlertDialog>
                  <AlertDialogTrigger asChild>
                     <Button variant="outline" size="icon" className="rounded-full h-12 w-12" onClick={e => e.stopPropagation()}>
                        <Icon name="Trash2" className="h-5 w-5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                      <AlertDialogHeader>
                      <AlertDialogTitle className="text-headline-2">{t('common:alertDialog.areYouSure')}</AlertDialogTitle>
                      <AlertDialogDescription>
                          {t('removeFromPlaylistConfirmation', { title: itemTitle })}
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
          </div>
      </div>
  )
}
