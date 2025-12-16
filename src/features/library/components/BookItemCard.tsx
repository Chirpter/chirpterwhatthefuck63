

"use client";

import type { Book, LibraryItem, BookmarkType, SystemBookmark } from "@/lib/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/icons";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useTranslation } from 'react-i18next';
import { useAudioPlayer } from '@/contexts/audio-player-context';
import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy, useRef, useContext } from "react";
import { cn } from "@/lib/utils";
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { useUser } from '@/contexts/user-context';
import CoverImage from './CoverImage';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { regenerateBookContent, editBookCover } from '@/services/server/book-creation.service';
import { useToast } from '@/hooks/useToast';
import { DynamicBookmark } from "./DynamicBookmark";
import { BookmarkCard } from "@/features/user/components/BookmarkCard";
import { useItemCardProgress } from "../hooks/useItemCardProgress";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { MAX_PROMPT_LENGTH } from "@/lib/constants";
import { LibraryContext } from "../contexts/LibraryContext";
import { ProFeatureWrapper } from '@/features/user/components/ProFeatureWrapper';
import { CreditIcon } from "@/components/ui/CreditIcon";

const RegeneratePromptDialog = lazy(() => import('./RegeneratePromptDialog'));

interface BookItemCardProps {
    book: Book;
    onPurchase?: (item: Book) => void;
    onDelete?: (item: Book) => void;
}

// Internal component for handling the new cover generation UI inside the dropdown
const GenerateCoverUI: React.FC<{
    newPrompt: string;
    onPromptChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    onGenerate: () => void;
    onCancel: () => void;
    isSubmitting: boolean;
}> = ({ newPrompt, onPromptChange, onGenerate, onCancel, isSubmitting }) => {
    const { t } = useTranslation(['bookCard', 'common']);
    return (
        <div className="p-2 space-y-2">
            <Textarea
                placeholder={t('coverPromptPlaceholder')}
                value={newPrompt}
                onChange={onPromptChange}
                className="text-sm h-20"
                maxLength={MAX_PROMPT_LENGTH}
                onClick={(e) => e.stopPropagation()}
                autoFocus
            />
            <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={onCancel}>{t('common:cancel')}</Button>
                <Button size="sm" onClick={onGenerate} disabled={isSubmitting || !newPrompt.trim()}>
                    {isSubmitting && <Icon name="Wand2" className="mr-2 h-4 w-4 animate-pulse" />}
                    {t('common:generate')}
                </Button>
            </div>
        </div>
    );
};


export function BookItemCard({ book, onPurchase, onDelete }: BookItemCardProps) {
  const { t } = useTranslation(['bookCard', 'presets', 'common', 'toast']);
  const { user } = useUser();
  const { toast } = useToast();
  const { startPlayback, isPlaying, currentPlayingItem, overallProgressPercentage, addBookToPlaylist, pauseAudio, resumeAudio } = useAudioPlayer();
  const audioProgress = useItemCardProgress(book.id, book);
  const { availableBookmarks, onBookmarkChange } = useContext(LibraryContext);
  const [isBookmarkSelectorOpen, setIsBookmarkSelectorOpen] = useState(false);

  const [itemToRegenerateContent, setItemToRegenerateContent] = useState<Book | null>(null);
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  
  const [isRetryingCover, setIsRetryingCover] = useState(false);
  const [isRetryingContent, setIsRetryingContent] = useState(false);
  const coverUploadInputRef = useRef<HTMLInputElement>(null);
  
  const isProUser = user?.plan === 'pro';

  const currentBookmark = useMemo(() => {
    const selectedBookmarkId = book.selectedBookmark || 'default';
    const selectedBookmarkData = availableBookmarks?.find(b => b.id === selectedBookmarkId);

    if (selectedBookmarkData?.unlockType === 'pro' && !isProUser) {
        return availableBookmarks?.find(b => b.id === 'default');
    }
    
    return selectedBookmarkData || availableBookmarks?.find(b => b.id === 'default');
  }, [book.selectedBookmark, availableBookmarks, isProUser]);

  
  const progressPercentage = useMemo(() => {
    if (currentPlayingItem?.id === book.id) {
        return overallProgressPercentage;
    }
    return audioProgress.overallProgress;
  }, [currentPlayingItem, book.id, overallProgressPercentage, audioProgress]);
  
  const handleCoverUploadRetry = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) return;
    const file = e.target.files?.[0];
    if (!file) return;

    setIsRetryingCover(true);
    try {
      await editBookCover(user.uid, book.id, 'upload', file);
      toast({ title: t('toast:regenCoverTitle'), description: t('toast:regenDesc') });
    } catch (err) {
      toast({ title: t('common:error'), description: (err as Error).message, variant: 'destructive' });
    } finally {
      setIsRetryingCover(false);
    }
  };

  const isContentPromptError = useMemo(() =>
    book.contentError && /safety|invalid|blocked|prompt/i.test(book.contentError),
    [book.contentError]
  );
  
  const handleContentRetry = () => {
    if (isRetryingContent || !user) return;
    
    setIsRetryingContent(true);
    
    if (isContentPromptError) {
        setItemToRegenerateContent(book);
        setIsRetryingContent(false); 
    } else {
        regenerateBookContent(user.uid, book.id)
            .then(() => toast({ title: t('toast:regenContentTitle'), description: t('toast:regenDesc') }))
            .catch(err => toast({ title: t('common:error'), description: (err as Error).message, variant: 'destructive'}))
            .finally(() => setIsRetryingContent(false));
    }
  };

  const isCoverPromptError = useMemo(() =>
    book.coverError && /safety|invalid|blocked|prompt/i.test(book.coverError),
    [book.coverError]
  );
  
  const handleCoverRetry = () => {
    if (isRetryingCover || !user) return;
    
    if (book.cover?.type === 'upload') {
        coverUploadInputRef.current?.click();
        return;
    }
    
    setIsRetryingCover(true);
    editBookCover(user.uid, book.id, 'ai', book.cover?.inputPrompt || book.prompt || '')
        .then(() => toast({ title: t('toast:regenCoverTitle'), description: t('toast:regenDesc') }))
        .catch(err => toast({ title: t('common:error'), description: (err as Error).message, variant: 'destructive'}))
        .finally(() => setIsRetryingCover(false));
  };
  
  const [newCoverPrompt, setNewCoverPrompt] = useState('');
  const [isSubmittingNewCover, setIsSubmittingNewCover] = useState(false);

  const handleGenerateNewCover = async () => {
    if (!user || !newCoverPrompt.trim()) return;
    setIsSubmittingNewCover(true);
    try {
        await editBookCover(user.uid, book.id, 'ai', newCoverPrompt);
        toast({ title: t('toast:regenCoverTitle'), description: t('toast:regenDesc') });
        handleCancelGenerateCover();
    } catch (err) {
        toast({ title: t('common:error'), description: (err as Error).message, variant: 'destructive' });
    } finally {
        setIsSubmittingNewCover(false);
    }
  };

  const handleCancelGenerateCover = () => {
    setIsGeneratingCover(false);
    setNewCoverPrompt('');
  };

  const isReadable = book.contentState === 'ready';
  const ReaderLinkWrapper = (isReadable && !onPurchase) ? Link : 'div';
  const readerLinkProps = (isReadable && !onPurchase) ? { href: `/read/${book.id}` } : {};
  
  const authorNameToDisplay = book.author || user?.displayName;

  const ownedBookmarkIds = new Set(user?.ownedBookmarkIds || []);
  
  const bookmarksForSelector = useMemo(() => {
    return availableBookmarks.filter(bm => {
        if (ownedBookmarkIds.has(bm.id)) return true;
        if (isProUser && bm.unlockType === 'pro') return true;
        return false;
    });
  }, [availableBookmarks, ownedBookmarkIds, isProUser]);

  const [primaryLang] = book.origin.split('-');
  const titleToDisplay = book.title[primaryLang] || Object.values(book.title)[0] || t('untitled');
  
  const renderProgressIndicator = () => {
      if (currentBookmark?.id === 'default') {
          return (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-8 h-8">
                      <CircularProgressbar
                          value={progressPercentage}
                          text={`${Math.round(progressPercentage)}%`}
                          strokeWidth={10}
                          styles={buildStyles({
                              pathColor: `rgba(255, 255, 255, 0.7)`,
                              trailColor: 'transparent',
                              textColor: '#fff',
                              textSize: '28px',
                              backgroundColor: 'transparent',
                          })}
                      />
                  </div>
              </div>
          );
      }
      return null;
  };

  const renderProgressBar = () => {
      if (currentBookmark?.id !== 'default' && progressPercentage > 0) {
          return (
              <div className="px-3 pb-3">
                  <Progress value={progressPercentage} className="h-2" />
              </div>
          );
      }
      return null;
  };

  const handlePlayClick = () => {
    if (currentPlayingItem?.id === book.id) {
        if (isPlaying) {
            pauseAudio();
        } else {
            resumeAudio();
        }
    } else {
        startPlayback(book);
    }
  };


  return (
    <>
    <div className="flex flex-col break-inside-avoid">
      <div className="relative group/cover"> 
        <ReaderLinkWrapper {...readerLinkProps} className={cn("relative block w-full aspect-[3/4] rounded-lg overflow-hidden shadow-lg transition-shadow duration-300 z-10 cover-shadow-overlay", isReadable && "hover:shadow-xl")}>
          <CoverImage 
            title={titleToDisplay}
            author={authorNameToDisplay}
            coverStatus={book.coverState}
            cover={book.cover}
            imageHint={book.imageHint}
            className="w-full h-full"
            onRegenerate={handleCoverRetry}
            isRetrying={isRetryingCover}
            isPromptError={isCoverPromptError}
            retryCount={book.coverRetries || 0}
          />
        </ReaderLinkWrapper>
        {!onPurchase && (
          <>
            <div className="absolute top-0 left-0 w-12 h-full bg-gradient-to-r from-black/50 to-transparent opacity-0 group-hover/cover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-2 z-20">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={handlePlayClick}>
                <Icon name={isPlaying && currentPlayingItem?.id === book.id ? 'Pause' : 'Play'} className="h-5 w-5"/>
              </Button>
              <DropdownMenu modal={false} onOpenChange={(open) => { if (!open) handleCancelGenerateCover(); }}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20">
                    <Icon name="MoreVertical" className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="font-body w-56">
                    {isGeneratingCover ? (
                        <GenerateCoverUI 
                            newPrompt={newCoverPrompt}
                            onPromptChange={(e) => setNewCoverPrompt(e.target.value)}
                            onGenerate={handleGenerateNewCover}
                            onCancel={handleCancelGenerateCover}
                            isSubmitting={isSubmittingNewCover}
                        />
                    ) : (
                        <>
                            <DropdownMenuItem onClick={() => addBookToPlaylist(book)}>
                                <Icon name="ListMusic" className="mr-2 h-4 w-4" />
                                <span>{t('addToPlaylist')}</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setIsBookmarkSelectorOpen(true); }}>
                                <Icon name="Bookmark" className="mr-2 h-4 w-4" />
                                <span>{t('changeBookmark')}</span>
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />
                             <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setIsGeneratingCover(true); }}>
                                <Icon name="Sparkles" className="mr-2 h-4 w-4" />
                                <span>{t('generateNewCover')}</span>
                            </DropdownMenuItem>
                            <ProFeatureWrapper isProUser={isProUser}>
                                <DropdownMenuItem onSelect={() => coverUploadInputRef.current?.click()}>
                                    <Icon name="Upload" className="mr-2 h-4 w-4" />
                                    <span>{t('uploadCover')}</span>
                                </DropdownMenuItem>
                            </ProFeatureWrapper>
                            <DropdownMenuSeparator />
                             {onDelete && (
                                <DropdownMenuItem className="text-destructive focus:text-destructive-foreground" onClick={() => onDelete(book)}>
                                    <Icon name="Trash2" className="mr-2 h-4 w-4" />
                                    {t('deleteBook')}
                                </DropdownMenuItem>
                            )}
                        </>
                    )}
                </DropdownMenuContent>
              </DropdownMenu>
              <input type="file" ref={coverUploadInputRef} onChange={handleCoverUploadRetry} accept="image/*" className="hidden" />
            </div>
          </>
        )}
      </div>
      
      <div className="w-[96%] -mt-4 self-end">
        <Card className="bg-card shadow-lg hover:shadow-xl transition-shadow duration-300 rounded-lg">
          <CardContent className="p-3 pt-6 relative pb-1">
             {currentBookmark && (
                <div className="absolute top-0 right-2 w-12 h-16 z-[5]">
                    <div className="w-full h-full">
                         <DynamicBookmark bookmark={currentBookmark} isComplete={!!book.completedAt} isInteractive={false} />
                    </div>
                    {renderProgressIndicator()}
                </div>
             )}
            <div className="flex flex-col gap-1 min-h-[42px] justify-end">
              <div className="min-h-[22px] flex flex-nowrap gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  {(book.tags && book.tags.length > 0) && book.tags.map(tag => (
                      <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                  ))}
                  {book.contentState === 'error' && (
                    <Badge variant="destructive" asChild>
                      <button onClick={handleContentRetry} disabled={isRetryingContent || (book.contentRetries || 0) >= 3}>
                        {isRetryingContent ? <Icon name="Wand2" className="mr-1 h-3 w-3 animate-pulse" /> : <Icon name="RotateCw" className="mr-1 h-3 w-3" />}
                        {isContentPromptError ? t('fixAndRetryContent') : t('retryContent')}
                        {(book.contentRetries || 0) > 1 && !isContentPromptError && ` (${book.contentRetries || 0}/3)`}
                      </button>
                    </Badge>
                  )}
              </div>
               <CardTitle className="font-headline text-base font-bold leading-snug truncate" title={titleToDisplay}>
                  <ReaderLinkWrapper {...readerLinkProps}>
                    {titleToDisplay}
                  </ReaderLinkWrapper>
              </CardTitle>
            </div>
          </CardContent>
           {renderProgressBar()}
          {onPurchase && (
            <CardFooter className="p-2">
                <Button onClick={() => onPurchase(book)} className="w-full font-body" size="sm">
                    <CreditIcon className="mr-2 h-4 w-4 text-yellow-400" />
                    {book.price || 0} {t('common:credits')}
                </Button>
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
    {itemToRegenerateContent && (
      <Suspense fallback={null}>
        <RegeneratePromptDialog
          isOpen={!!itemToRegenerateContent}
          onOpenChange={() => setItemToRegenerateContent(null)}
          item={itemToRegenerateContent}
        />
      </Suspense>
    )}
    <Dialog open={isBookmarkSelectorOpen} onOpenChange={setIsBookmarkSelectorOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('selectBookmarkTitle')}</DialogTitle>
        </DialogHeader>
        <div className="py-4 flex flex-wrap gap-4 justify-center">
            {bookmarksForSelector.map((bm) => (
                <BookmarkCard
                    key={bm.id}
                    bookmark={bm}
                    status={bm.unlockType === 'pro' ? 'locked' : 'owned'}
                    isSelected={bm.id === (book.selectedBookmark || 'default')}
                    onCardClick={() => {
                        onBookmarkChange?.(book.id, bm.id);
                        setIsBookmarkSelectorOpen(false);
                    }}
                    className="w-24 md:w-28" 
                />
            ))}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
