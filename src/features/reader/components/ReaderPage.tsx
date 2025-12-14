// src/features/reader/components/ReaderPage.tsx

'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import type { Book, Piece, LibraryItem, Page, PresentationMode, Chapter, BilingualFormat } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icons';
import { useToast } from '@/hooks/useToast';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { useAudioPlayer } from '@/contexts/audio-player-context';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';
import { useUser } from '@/contexts/user-context';
import { useSettings } from '@/contexts/settings-context';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ReaderToolbar } from '@/features/reader/components/ReaderToolbar';
import { useEditorSettings } from '@/hooks/useEditorSettings';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PageCalculator } from '@/lib/pagination/PageCalculator';
import { SegmentCalibrator } from '@/lib/pagination/SegmentCalibrator';
import { getItemSegments } from '@/services/shared/MarkdownParser';
import { motion } from 'framer-motion';
import { useMobile } from '@/hooks/useMobile';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { getLibraryItemById } from '@/services/client/library-service';
import { regenerateBookContent } from '@/services/server/book-creation.service';
import { BookRenderer } from './BookRenderer';
import { PieceRenderer } from './PieceRenderer';

const LookupPopover = dynamic(() => import('@/features/reader/components/LookupPopover'), { ssr: false });
const AudioSettingsPopover = dynamic(() => import('@/features/player/components/AudioSettingsPopover').then(mod => mod.AudioSettingsPopover), { ssr: false });

interface LookupState {
  isOpen: boolean;
  text: string;
  rect: DOMRect | null;
  sourceLang: string;
  sourceItem: LibraryItem | null;
  chapterId?: string;
  segmentId?: string;
  sentenceContext: string;
}

const getStorageKey = (itemId: string) => `chirpter_reader_prefs_${'${itemId}'}`;

const getStoredPresentationIntent = (itemId: string): string | null => {
    try {
        const stored = localStorage.getItem(getStorageKey(itemId));
        if (stored) {
            const data = JSON.parse(stored);
            return typeof data === 'string' ? data : null;
        }
    } catch (e) {
        console.error("Failed to read presentation mode from localStorage", e);
    }
    return null;
};

const setStoredPresentationIntent = (itemId: string, presentationIntent: string) => {
    try {
        localStorage.setItem(getStorageKey(itemId), JSON.stringify(presentationIntent));
    } catch (e) {
        console.error("Failed to save presentation mode to localStorage", e);
    }
};


function ReaderView({ isPreview = false }: { isPreview?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const idFromUrl = params.id as string;
  const { authUser } = useAuth();
  const { user } = useUser();
  const { toast } = useToast();
  const { t, i18n } = useTranslation(['readerPage', 'common', 'toast']);
  const audioPlayer = useAudioPlayer();
  const { wordLookupEnabled } = useSettings();
  const isMobile = useMobile();

  const [item, setItem] = useState<LibraryItem | null>(null);
  const id = useMemo(() => item?.id || idFromUrl, [item, idFromUrl]);
  const [isLoadingItem, setIsLoadingItem] = useState(true);
  const [lookupState, setLookupState] = useState<LookupState>({ isOpen: false, text: '', rect: null, sourceLang: '', sourceItem: null, sentenceContext: '', context: 'reader' });
  
  const [isEditing, setIsEditing] = useState(false);
  const [editorSettings, setEditorSettings] = useEditorSettings(id);
  
  const [isTocOpen, setIsTocOpen] = useState(false);
  const contentContainerRef = useRef<HTMLDivElement>(null);

  const [pages, setPages] = useState<Page[]>([]);
  const [chapterStartPages, setChapterStartPages] = useState<number[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  
  const [isCalculatingPages, setIsCalculatingPages] = useState(true);
  const readerPageInitializedRef = useRef(false);

  const [displayLang1, setDisplayLang1] = useState('en');
  const [displayLang2, setDisplayLang2] = useState('none');
  const [isGeneratingChapters, setIsGeneratingChapters] = useState(false);
  
  const bilingualFormat: BilingualFormat = useMemo(() => {
    if (!item || !item.origin) return 'sentence';
    return item.origin.endsWith('-ph') ? 'phrase' : 'sentence';
  }, [item]);

  const availableLanguages = useMemo(() => item?.langs || ['en'], [item]);
  
  useEffect(() => {
    if (item) {
        const userOverride = getStoredPresentationIntent(item.id);
        const intentToParse = userOverride || item.origin;
        
        const parts = intentToParse.split('-');
        const lang1 = parts[0] || 'en';
        const lang2 = parts[1] || 'none';
        
        setDisplayLang1(lang1);
        setDisplayLang2(lang2);
    }
  }, [item]);

  const updatePresentationIntent = useCallback((newDisplayLang1: string, newDisplayLang2: string) => {
    if (!item) return;

    let newIntent: string;
    if (newDisplayLang2 !== 'none') {
        newIntent = `${'${newDisplayLang1}'}-${'${newDisplayLang2}'}`;
    } else {
        newIntent = newDisplayLang1;
    }
    
    if (bilingualFormat === 'phrase') {
      newIntent += '-ph';
    }

    setStoredPresentationIntent(item.id, newIntent);
    setDisplayLang1(newDisplayLang1);
    setDisplayLang2(newDisplayLang2);
  }, [item, bilingualFormat]);
  
  const handleDisplayLang1Change = useCallback((lang: string) => {
    updatePresentationIntent(lang, displayLang2);
  }, [displayLang2, updatePresentationIntent]);

  const handleDisplayLang2Change = useCallback((lang: string) => {
    updatePresentationIntent(displayLang1, lang);
  }, [displayLang1, updatePresentationIntent]);
  
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    const controller = new AbortController();

    async function loadAndListen() {
        if (!idFromUrl || !user) {
            setIsLoadingItem(false);
            return;
        }

        setIsLoadingItem(true);
        try {
            const initialItem = await getLibraryItemById(user.uid, idFromUrl);
            
            if (controller.signal.aborted) return;

            if (initialItem) {
                setItem(initialItem);
            } else {
                toast({ title: t('common:error'), description: t('notFoundDescription'), variant: "destructive" });
                setItem(null);
            }
        } catch (error) {
            console.error("Error fetching initial library item:", error);
            toast({ title: t('common:error'), description: t('failedToLoadContent'), variant: "destructive" });
            setItem(null);
        } finally {
            if (!controller.signal.aborted) {
                setIsLoadingItem(false);
            }
        }

        const docRef = doc(db, `users/${'${user.uid}'}/libraryItems`, idFromUrl);
        unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const serverItem = { id: docSnap.id, ...docSnap.data() } as LibraryItem;
                setItem(serverItem);
            }
        }, (error) => {
            console.error("Error with real-time listener:", error);
        });
    }

    loadAndListen();

    return () => {
        controller.abort();
        if (unsubscribe) {
            unsubscribe();
        }
    };
}, [idFromUrl, user, toast, t]);


  const allBookSegments = useMemo((): Segment[] => {
    if (!item) return [];
    if (item.type === 'book') {
        const book = item as Book;
        return (book.chapters || []).flatMap((chapter, index) => getItemSegments(item, index));
    }
    // For Pieces, all segments are in generatedContent
    return getItemSegments(item);
  }, [item]);

  const segmentCalibrator = useMemo(() => {
    if (!contentContainerRef.current) return null;
    return new SegmentCalibrator(contentContainerRef.current);
  }, [contentContainerRef.current]);

  const pageCalculator = useMemo(() => {
    if (!segmentCalibrator) return null;
    return new PageCalculator(segmentCalibrator);
  }, [segmentCalibrator]);
  
  const calculatePages = useCallback(async () => {
     if (allBookSegments.length > 0 && pageCalculator) {
      setIsCalculatingPages(true);
      try {
        const { pages: calculatedPages, chapterStartPages: calculatedChapterStarts } = await pageCalculator.calculatePagesForBook(allBookSegments);
        setPages(calculatedPages);
        setChapterStartPages(calculatedChapterStarts);
      } catch (error) {
          console.error("Failed to calculate pages:", error);
          setPages([]);
          setChapterStartPages([]);
      } finally {
        setIsCalculatingPages(false);
      }
    } else {
        setPages([]);
        setChapterStartPages([]);
        setIsCalculatingPages(false);
    }
  }, [allBookSegments, pageCalculator]);

  // Determine pagination mode based on presentation style
  const needsPagination = useMemo(() => 
    !isPreview && item && (item.presentationStyle === 'book' || item.presentationStyle === 'doc')
  , [isPreview, item]);

  useEffect(() => {
    if (needsPagination) {
      calculatePages();
    } else if (item && item.presentationStyle === 'card') {
      // For 'card' mode, create a single page with all segments
      setPages([{ pageIndex: 0, items: allBookSegments, estimatedHeight: 0 }]);
      setChapterStartPages([]);
      setIsCalculatingPages(false);
    } else {
      setIsCalculatingPages(false);
      setPages([]);
    }
  }, [calculatePages, needsPagination, item, allBookSegments]);


  const currentChapterIndex = useMemo(() => {
    if (!item || item.type !== 'book' || chapterStartPages.length === 0) return 0;
    return chapterStartPages.findLastIndex(startPage => currentPageIndex >= startPage) ?? 0;
  }, [item, currentPageIndex, chapterStartPages]);

  
  const handleTextSelection = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (isPreview || !wordLookupEnabled || !item) return;

    if (lookupState.isOpen) {
      setLookupState(prev => ({...prev, isOpen: false}));
    }

    const selection = window.getSelection();
    const selectedText = selection?.toString().trim() ?? '';

    if (selectedText.length > 0 && selectedText.length < 150 && selection) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        let sourceLang = displayLang1;
        let segmentId: string | undefined = undefined;
        let sentenceContext = `...${'${selectedText}'}...`;

        const startContainer = range.startContainer;
        const segmentElement = (startContainer.nodeType === 3 ? startContainer.parentElement : startContainer as HTMLElement)?.closest<HTMLElement>('[data-segment-id]');

        if (segmentElement) {
            segmentId = segmentElement.dataset.segmentId;
            const spanElement = (startContainer.nodeType === 3 ? startContainer.parentElement : startContainer as HTMLElement)?.closest<HTMLElement>('span[lang]');
            
            if (spanElement) {
                sentenceContext = spanElement.textContent || '';
                sourceLang = spanElement.lang || sourceLang;
            } else {
                sentenceContext = segmentElement.textContent || '';
            }
        }
        
        if (sourceLang === i18n.language) {
          setLookupState(s => ({...s, isOpen: false}));
          return;
        }

        const currentChapterData = item.type === 'book' ? (item as Book).chapters?.[currentChapterIndex] : undefined;

        setLookupState({ 
            isOpen: true, 
            text: selectedText, 
            rect, 
            sourceLang,
            sourceItem: item,
            chapterId: currentChapterData?.id,
            segmentId,
            sentenceContext,
            context: 'reader',
        });
    } else if (lookupState.isOpen) {
      setLookupState(s => ({...s, isOpen: false}));
    }
  }, [isPreview, wordLookupEnabled, item, i18n.language, currentChapterIndex, lookupState.isOpen, displayLang1]);

  const handlePlayPause = useCallback(() => {
    if (!item || !user) return;

    const playbackLanguages = [displayLang1];
    if (displayLang2 !== 'none') {
        playbackLanguages.push(displayLang2);
    }
    
    if (audioPlayer.isPlaying && audioPlayer.currentPlayingItem?.id === item.id) {
        audioPlayer.pauseAudio();
    } else if (!audioPlayer.isPlaying && audioPlayer.currentPlayingItem?.id === item.id) {
        audioPlayer.resumeAudio();
    } else {
        const isBook = item.type === 'book';
        const chapterIdx = isBook ? currentChapterIndex : 0;
        
        let segmentIndexToStart = 0;
        
        audioPlayer.startPlayback(item, { chapterIndex: chapterIdx, segmentIndex: segmentIndexToStart, playbackLanguages });
    }
  }, [item, user, audioPlayer, currentChapterIndex, displayLang1, displayLang2]);
  
  const isThisBookPlaying = audioPlayer.currentPlayingItem?.id === item?.id;
  const showPauseIcon = audioPlayer.isPlaying && isThisBookPlaying;
  const playButtonIcon: IconName = showPauseIcon ? "Pause" : "Play";
  
  const handleChapterSelect = (chapterIndex: number) => {
    const targetPageIndex = chapterStartPages[chapterIndex];
    if (targetPageIndex !== undefined) {
      setCurrentPageIndex(targetPageIndex);
    }
    setIsTocOpen(false);
  };
  
  const handleDragEnd = (event: any, info: any) => {
    const swipeThreshold = 50;
    if (info.offset.x > swipeThreshold) {
      goToPage(currentPageIndex - 1);
    } else if (info.offset.x < -swipeThreshold) {
      goToPage(currentPageIndex + 1);
    }
  };
  
  const goToPage = (pageIndex: number) => {
    if (isCalculatingPages) return;
    const newIndex = Math.max(0, Math.min(pageIndex, pages.length - 1));
    setCurrentPageIndex(newIndex);
  };

  const getPageForSegment = useCallback((segmentId: string): number => {
    for (let i = 0; i < pages.length; i++) {
        if (pages[i].items.some(item => item.id === segmentId)) {
            return i;
        }
    }
    return -1;
  }, [pages]);

  useEffect(() => {
    if (isCalculatingPages || isPreview || !item) return;
    
    if (audioPlayer.currentPlayingItem?.id === item.id && audioPlayer.position.segmentIndex >= 0) {
        const chapterIndex = audioPlayer.position.chapterIndex ?? 0;
        const segmentIndex = audioPlayer.position.segmentIndex;
        
        if (item.type === 'book' && (item as Book).chapters[chapterIndex]?.segments[segmentIndex]) {
            const segmentId = (item as Book).chapters[chapterIndex].segments[segmentIndex].id;
            const pageIndex = getPageForSegment(segmentId);
            if (pageIndex !== -1 && pageIndex !== currentPageIndex) {
                setCurrentPageIndex(pageIndex);
            }
        }
    } 
    else if (!readerPageInitializedRef.current) {
        const segmentIdFromUrl = searchParams.get('segmentId');
        if (segmentIdFromUrl) {
            const pageIndex = getPageForSegment(segmentIdFromUrl);
            if (pageIndex !== -1) {
                setCurrentPageIndex(pageIndex);
            }
        }
        const chapterIdFromUrl = searchParams.get('chapterId');
        if (chapterIdFromUrl) {
             const chapterIndex = item.type === 'book' ? (item as Book).chapters.findIndex(c => c.id === chapterIdFromUrl) : -1;
             if (chapterIndex !== -1 && chapterStartPages[chapterIndex] !== undefined) {
                 setCurrentPageIndex(chapterStartPages[chapterIndex]);
             }
        }
        readerPageInitializedRef.current = true;
    }
  }, [audioPlayer.currentPlayingItem, audioPlayer.position, currentPageIndex, getPageForSegment, searchParams, isCalculatingPages, isPreview, item, chapterStartPages]);


  const canGenerateNextChapters = useMemo(() => {
    if (!item || item.type !== 'book') return false;
    const book = item as Book;
    const isLongForm = book.length === 'standard-book' || book.length === 'long-book';
    const hasOutline = !!book.outline && book.outline.length > 0;
    const hasMoreChaptersToGenerate = hasOutline && book.chapters.length < book.outline.length;
    return isLongForm && hasMoreChaptersToGenerate;
  }, [item]);

  const handleGenerateNextChapters = useCallback(async () => {
    if (!canGenerateNextChapters || !user || !item || item.type !== 'book') return;

    setIsGeneratingChapters(true);
    toast({
        title: t('toast:regenContentTitle'),
        description: t('toast:regenDesc')
    });

    try {
        const book = item as Book;
        const existingContentSummary = book.chapters
            .map(c => `# ${'${c.title.en}'}\n...`) // Simple summary
            .join('\n');
            
        await regenerateBookContent(user.uid, book.id, `Continue the story from this summary: ${'${existingContentSummary}'}`);
    } catch (error) {
        toast({
            title: t('common:error'),
            description: (error as Error).message || t('toast:regenErrorDesc'),
            variant: "destructive"
        });
    } finally {
        setIsGeneratingChapters(false);
    }
  }, [canGenerateNextChapters, user, item, t, toast]);
  

  const renderLoading = () => (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-4 text-center bg-background">
      <Icon name="BookOpen" className="h-12 w-12 animate-pulse text-primary" />
    </div>
  );
  
  const renderError = () => (
     <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-4 text-center bg-background">
      <h2 className="text-xl font-semibold">{t('common:error')}</h2>
      <p className="text-muted-foreground">{t('failedToLoadContent')}</p>
      <Button asChild className="mt-4"><Link href="/library/book">{t('common:backToLibrary')}</Link></Button>
    </div>
  );

  if (isLoadingItem && !item) {
    return isPreview ? null : renderLoading();
  }

  if (!item) {
    return isPreview ? null : renderError();
  }
  
  const currentPageData = pages[currentPageIndex];
  
  const renderContent = () => {
    const { presentationStyle } = item;

    const pageContent = (
        <BookRenderer
            page={currentPageData}
            presentationStyle={presentationStyle}
            editorSettings={editorSettings}
            itemData={item}
            displayLang1={displayLang1}
            displayLang2={displayLang2}
        />
    );
    
    // For 'card' and 'doc', we wrap the content in the PieceRenderer frame
    if (presentationStyle === 'doc' || presentationStyle === 'card') {
        const pieceItem = item as Piece;
        return (
            <PieceRenderer item={pieceItem} className={editorSettings.background}>
                {isCalculatingPages ? (
                    <div className="flex items-center justify-center h-full"><Icon name="Loader2" className="h-8 w-8 animate-spin"/></div>
                ) : (
                  // 'card' scrolls, 'doc' shows paginated content
                  presentationStyle === 'card' ? <ScrollArea className="h-full">{pageContent}</ScrollArea> : pageContent
                )}
            </PieceRenderer>
        );
    }
    
    // Default 'book' style
    return (
        <motion.div
            ref={contentContainerRef}
            className={cn("w-full max-w-3xl h-full shadow-xl overflow-hidden", editorSettings.background)}
            drag={isMobile ? 'x' : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
        >
            { isCalculatingPages ? (
                <div className="flex items-center justify-center h-full text-center text-muted-foreground p-8">
                   <div>
                        <Icon name="BookOpen" className="h-10 w-10 animate-pulse text-primary mx-auto" />
                        <p className="mt-2">{t('paginating')}</p>
                   </div>
                </div>
            ) : currentPageData ? (
                pageContent
            ) : (
                <div className="flex items-center justify-center h-full text-center text-muted-foreground p-8">
                   {canGenerateNextChapters ? (
                        <div className="space-y-4">
                            <p>{t('generateMoreChaptersPrompt')}</p>
                            <Button onClick={handleGenerateNextChapters} disabled={isGeneratingChapters}>
                                {isGeneratingChapters && <Icon name="Wand2" className="mr-2 h-4 w-4 animate-pulse" />}
                                {t('generateMoreChaptersButton')}
                            </Button>
                        </div>
                   ) : (
                        <p>No content to display.</p>
                   )}
                </div>
            )}
        </motion.div>
    );
  };


  return (
    <div 
      id="reader-veil"
      className={cn("w-full h-full bg-muted/30 backdrop-blur-sm", !isPreview && "fixed inset-0 z-40")}
      onMouseUp={handleTextSelection}
    >
      <Suspense>
        {lookupState.isOpen && lookupState.rect && (
          <LookupPopover 
            {...lookupState}
            onOpenChange={(open) => setLookupState(s => ({...s, isOpen: open}))}
          />
        )}
      </Suspense>
      
      <div id="reader-studio-container" className="w-full h-full flex flex-col items-center justify-center">
          
          <div id="reader-content-wrapper" className="relative w-full h-full flex items-center justify-center min-h-0 p-1 group/reader">
              
              {!isPreview && (
                <>
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1">
                      <Sheet open={isTocOpen} onOpenChange={setIsTocOpen}>
                        <SheetTrigger asChild>
                            <Button variant="outline" size="icon" className="h-9 w-9 bg-background/70 backdrop-blur-sm" disabled={item.type !== 'book'}>
                                <Icon name="List" className="h-4 w-4" />
                            </Button>
                        </SheetTrigger>
                        {item.type === 'book' && (
                            <SheetContent side={isMobile ? "bottom" : "left"} className="w-full max-w-xs p-0 flex flex-col">
                                <SheetHeader className="p-4 border-b">
                                    <SheetTitle className="font-headline text-lg text-primary truncate">{item.title[displayLang1]}</SheetTitle>
                                </SheetHeader>
                                <ScrollArea className="flex-1">
                                    <div className="p-2 font-body">
                                        {(item as Book).chapters?.map((chapter: Chapter, index: number) => (
                                            <Button
                                                key={chapter.id}
                                                variant="ghost"
                                                className={cn(
                                                    "w-full justify-start text-left h-auto py-2",
                                                    index === currentChapterIndex && "bg-accent text-accent-foreground"
                                                )}
                                                onClick={() => handleChapterSelect(index)}
                                            >
                                                <span className="truncate">{chapter.title[displayLang1]}</span>
                                            </Button>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </SheetContent>
                        )}
                      </Sheet>
                    <Button variant="outline" size="icon" className="h-9 w-9 bg-background/70 backdrop-blur-sm" onClick={handlePlayPause}>
                        <Icon name={playButtonIcon} className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-9 w-9 bg-background/70 backdrop-blur-sm" onClick={() => setIsEditing(true)}>
                        <Icon name="PenLine" className="h-4 w-4" />
                    </Button>
                    <Suspense fallback={null}>
                        <AudioSettingsPopover item={item}>
                          <Button variant="outline" size="icon" className="h-9 w-9 bg-background/70 backdrop-blur-sm">
                                <Icon name="Settings" className="h-4 w-4" />
                          </Button>
                        </AudioSettingsPopover>
                    </Suspense>
                  </div>

                  {isEditing && (
                    <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 flex justify-center">
                      <ReaderToolbar
                          settings={editorSettings}
                          onSettingsChange={setEditorSettings}
                          onClose={() => setIsEditing(false)}
                          bookTitle={item.title[displayLang1]}
                          availableLanguages={availableLanguages}
                          displayLang1={displayLang1}
                          displayLang2={displayLang2}
                          onDisplayLang1Change={handleDisplayLang1Change}
                          onDisplayLang2Change={handleDisplayLang2Change}
                      />
                    </div>
                  )}

                  {needsPagination && (
                    <>
                      <Button variant="outline" size="icon" className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full z-20 opacity-0 group-hover/reader:opacity-100 transition-opacity disabled:opacity-0" disabled={currentPageIndex === 0} onClick={() => goToPage(currentPageIndex - 1)}>
                        <Icon name="ChevronLeft" className="h-5 w-5" />
                      </Button>
                      <Button variant="outline" size="icon" className="absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full z-20 opacity-0 group-hover/reader:opacity-100 transition-opacity disabled:opacity-0" disabled={currentPageIndex >= pages.length - 1} onClick={() => goToPage(currentPageIndex + 1)}>
                        <Icon name="ChevronRight" className="h-5 w-5" />
                      </Button>
                      {pages.length > 0 && (
                        <div className="absolute bottom-4 right-8 z-20 text-xs text-muted-foreground font-sans bg-background/50 px-2 py-1 rounded-md opacity-0 group-hover/reader:opacity-100 transition-opacity">
                          {currentPageIndex + 1} / {pages.length}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
              {renderContent()}
          </div>
      </div>
    </div>
  );
}

export const ReaderPage = (props: { isPreview?: boolean }) => {
  return (
      <ReaderView {...props} />
  );
}
