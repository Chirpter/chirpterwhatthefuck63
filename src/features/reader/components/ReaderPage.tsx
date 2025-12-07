
'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import type { Book, Piece, LibraryItem, BookProgress, Page, Segment, BilingualFormat, Chapter, BilingualViewMode } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icons';
import { useToast } from '@/hooks/useToast';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { useAudioPlayer, AudioPlayerProvider } from '@/contexts/audio-player-context';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';
import { useUser } from '@/contexts/user-context';
import { useSettings } from '@/contexts/settings-context';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ReaderToolbar } from '@/features/reader/components/ReaderToolbar';
import { useEditorSettings } from '@/hooks/useEditorSettings';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PieceItemCardRenderer } from '@/features/library/components/PieceItemCardRenderer';
import { PageCalculator } from '@/lib/pagination/PageCalculator';
import { SegmentCalibrator } from '@/lib/pagination/SegmentCalibrator';
import { getItemSegments } from '@/services/MarkdownParser';
import { motion } from 'framer-motion';
import { useMobile } from '@/hooks/useMobile';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { getLibraryItemById } from '@/services/library-service';
import { PageContentRenderer } from './PageContentRenderer';

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

function ReaderView({ isPreview = false }: { isPreview?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const idFromUrl = params.id as string;
  const { authUser } = useAuth();
  const { user } = useUser();
  const { toast } = useToast();
  const { t, i18n } = useTranslation(['readerPage', 'common']);
  const audioPlayer = useAudioPlayer();
  const { wordLookupEnabled } = useSettings();
  const isMobile = useMobile();

  const [item, setItem] = useState<LibraryItem | null>(null);
  const id = useMemo(() => item?.id || idFromUrl, [item, idFromUrl]);
  const [isLoadingItem, setIsLoadingItem] = useState(true);
  const [lookupState, setLookupState] = useState<LookupState>({ isOpen: false, text: '', rect: null, sourceLang: '', sourceItem: null, sentenceContext: '' });
  
  const [isEditing, setIsEditing] = useState(false);
  const [editorSettings, setEditorSettings] = useEditorSettings(id);
  
  const [isTocOpen, setIsTocOpen] = useState(false);
  const contentContainerRef = useRef<HTMLDivElement>(null);

  const [pages, setPages] = useState<Page[]>([]);
  const [chapterStartPages, setChapterStartPages] = useState<number[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  
  const [isCalculatingPages, setIsCalculatingPages] = useState(true);
  const readerPageInitializedRef = useRef(false);

  // --- NEW MULTI-LANGUAGE STATE ---
  const [displayLang1, setDisplayLang1] = useState(item?.primaryLanguage || 'en');
  const [displayLang2, setDisplayLang2] = useState('none'); // 'none' means monolingual view
  
  const availableLanguages = useMemo(() => {
    if (!item?.content) return [];
    // Assuming segments have consistent language keys
    const firstSegment = getItemSegments(item, 0)[0];
    if (!firstSegment) return [item.primaryLanguage].filter(Boolean) as string[];
    return Object.keys(firstSegment.content);
  }, [item]);

  useEffect(() => {
    if (item) {
        setDisplayLang1(item.primaryLanguage || 'en');
        const secondLang = availableLanguages.find(l => l !== item.primaryLanguage);
        setDisplayLang2(item.isBilingual && secondLang ? secondLang : 'none');
    }
  }, [item, availableLanguages]);
  
  // --- END NEW MULTI-LANGUAGE STATE ---
  
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

        const docRef = doc(db, `users/${user.uid}/libraryItems`, idFromUrl);
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

  useEffect(() => {
    if (!isPreview) {
        calculatePages();
    }
  }, [calculatePages, editorSettings, isPreview]);

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
        
        let sourceLang = item?.primaryLanguage || i18n.language;
        let segmentId: string | undefined = undefined;
        let sentenceContext = `...${selectedText}...`;

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
        });
    } else if (lookupState.isOpen) {
      setLookupState(s => ({...s, isOpen: false}));
    }
  }, [isPreview, wordLookupEnabled, item, i18n.language, currentChapterIndex, lookupState.isOpen]);

  const handlePlayPause = useCallback(() => {
    if (!item || !user) return;
    
    if (audioPlayer.isPlaying && audioPlayer.currentPlayingItem?.id === item.id) {
        audioPlayer.pauseAudio();
    } else if (!audioPlayer.isPlaying && audioPlayer.currentPlayingItem?.id === item.id) {
        audioPlayer.resumeAudio();
    } else {
        const isBook = item.type === 'book';
        const chapterIdx = isBook ? currentChapterIndex : 0;
        
        let segmentIndexToStart = 0;
        
        audioPlayer.startPlayback(item, { chapterIndex: chapterIdx, segmentIndex: segmentIndexToStart });
    }
  }, [item, user, audioPlayer, currentChapterIndex]);
  
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

  const currentPlayingSegmentId = useMemo(() => {
    if (audioPlayer.currentPlayingItem?.id === id) {
        return audioPlayer.currentSpokenSegmentId;
    }
    return null;
  }, [audioPlayer, id]);

  const getPageForSegment = useCallback((segmentId: string): number => {
    for (let i = 0; i < pages.length; i++) {
        if (pages[i].items.some(item => item.id === segmentId)) {
            return i;
        }
    }
    return -1;
  }, [pages]);

  useEffect(() => {
    if (isCalculatingPages || isPreview) return;
    
    if (currentPlayingSegmentId) {
        const pageIndex = getPageForSegment(currentPlayingSegmentId);
        if (pageIndex !== -1 && pageIndex !== currentPageIndex) {
            setCurrentPageIndex(pageIndex);
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
             const chapterIndex = item?.type === 'book' ? (item as Book).chapters.findIndex(c => c.id === chapterIdFromUrl) : -1;
             if (chapterIndex !== -1 && chapterStartPages[chapterIndex] !== undefined) {
                 setCurrentPageIndex(chapterStartPages[chapterIndex]);
             }
        }
        readerPageInitializedRef.current = true;
    }
  }, [currentPlayingSegmentId, currentPageIndex, getPageForSegment, searchParams, isCalculatingPages, isPreview, item, chapterStartPages]);


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
            sourceItem={item}
            targetLanguage={i18n.language}
            onOpenChange={(open) => setLookupState(s => ({...s, isOpen: open}))}
            context="reader"
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
                                    <SheetTitle className="font-headline text-lg text-primary truncate">{item.title[item.primaryLanguage]}</SheetTitle>
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
                                                <span className="truncate">{chapter.title[chapter.metadata?.primaryLanguage || item.primaryLanguage]}</span>
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
                    {item.presentationStyle !== 'book' && (
                        <Button variant="outline" size="icon" className="h-9 w-9 bg-background/70 backdrop-blur-sm" onClick={() => setIsEditing(true)}>
                            <Icon name="PenLine" className="h-4 w-4" />
                        </Button>
                    )}
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
                          availableLanguages={availableLanguages}
                          displayLang1={displayLang1}
                          displayLang2={displayLang2}
                          onDisplayLang1Change={setDisplayLang1}
                          onDisplayLang2Change={setDisplayLang2}
                      />
                    </div>
                  )}

                  {item.type === 'book' && (
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

            {item.type === 'piece' ? (
                <PieceItemCardRenderer item={item} isPreview={isPreview} chapterIndex={0} />
            ) : (
                <motion.div
                    ref={contentContainerRef}
                    className="w-full max-w-3xl h-full shadow-xl bg-background overflow-hidden"
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
                        <PageContentRenderer 
                                page={currentPageData}
                                presentationStyle='book'
                                editorSettings={editorSettings}
                                itemData={item}
                                currentPlayingItemId={currentPlayingSegmentId}
                                displayLang1={displayLang1}
                                displayLang2={displayLang2}
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full text-center text-muted-foreground p-8">
                           <p>No content to display.</p>
                        </div>
                    )}
                </motion.div>
            )}
          </div>
      </div>
    </div>
  );
}

export const ReaderPage = (props: { isPreview?: boolean }) => {
  return (
    <AudioPlayerProvider>
      <ReaderView {...props} />
    </AudioPlayerProvider>
  );
}
