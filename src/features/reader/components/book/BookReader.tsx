// src/features/reader/components/book/BookReader.tsx
'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useAudioPlayer } from '@/contexts/audio-player-context';
import { useSettings } from '@/contexts/settings-context';
import { useEditorSettings } from '@/hooks/useEditorSettings';
import { usePagination } from '@/features/reader/hooks/usePagination';
import { cn } from '@/lib/utils';
import type { Book, LibraryItem, VocabContext, Segment, LanguageBlock, MultilingualContent } from '@/lib/types';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion } from 'framer-motion';
import { useMobile } from '@/hooks/useMobile';
import { ContentPageRenderer } from '../shared/ContentPageRenderer';
import { ReaderToolbar } from '../shared/ReaderToolbar';
import { FocusModeWrapper } from '../shared/FocusModeWrapper';
import { PaginationDebugPanel } from '@/components/debug/PaginationDebugPanel';

const LookupPopover = dynamic(() => import('@/features/lookup/components/LookupPopover'), { ssr: false });

interface LookupState {
  isOpen: boolean;
  text: string;
  rect: DOMRect | null;
  sourceLang: string;
  targetLanguage: string;
  sourceItem: LibraryItem | null;
  chapterId?: string;
  segmentId?: string;
  sentenceContext: string;
  context: VocabContext;
}

export default function BookReader({ book }: { book: Book }) {
  const { t, i18n } = useTranslation(['readerPage', 'common']);
  const searchParams = useSearchParams();
  const audioPlayer = useAudioPlayer();
  const { wordLookupEnabled } = useSettings();
  const isMobile = useMobile();

  const [editorSettings, setEditorSettings] = useEditorSettings(book.id);
  const [isToolbarOpen, setIsToolbarOpen] = useState(false);
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);

  // Language display state
  const [displayLang1, setDisplayLang1] = useState(() => book.langs[0] || 'en');
  const [displayLang2, setDisplayLang2] = useState(() => book.langs[1] || 'none');

  useEffect(() => {
    const originParts = book.origin.split('-');
    setDisplayLang1(originParts[0] || book.langs[0] || 'en');
    setDisplayLang2(originParts[1] || 'none');
  }, [book.origin, book.langs]);

  const [lookupState, setLookupState] = useState<LookupState>({
    isOpen: false,
    text: '',
    rect: null,
    sourceLang: '',
    targetLanguage: '',
    sourceItem: null,
    sentenceContext: '',
    context: 'reader'
  });

  const contentContainerRef = useRef<HTMLDivElement>(null);
  const allBookSegments = useMemo(() => book.content || [], [book.content]);

  const {
    pages,
    chapterStartPages,
    currentPageIndex,
    setCurrentPageIndex,
    isCalculating,
    goToPage,
    getPageForSegment,
    pageCount
  } = usePagination({
    segments: allBookSegments,
    containerRef: contentContainerRef,
    isEnabled: true,
    presentationStyle: 'book',
    displayLang1,
    displayLang2,
    unit: book.unit || 'sentence',
    itemId: book.id,
    fontSize: editorSettings.fontSize
  });

  const chapters = useMemo(() => {
    const chapterData: { title: MultilingualContent; segmentId: string }[] = [];
    allBookSegments.forEach((segment) => {
      const firstContent = segment.content[0];
      const langBlock = segment.content[1] as LanguageBlock;
      if (typeof firstContent === 'string' && firstContent.startsWith('#')) {
        if (langBlock) {
          chapterData.push({ title: langBlock, segmentId: segment.id });
        }
      }
    });
    // If no headings found, create a default "Chapter 1"
    if (chapterData.length === 0 && allBookSegments.length > 0) {
      return [{ title: { [displayLang1]: 'Chapter 1' }, segmentId: allBookSegments[0].id }];
    }
    return chapterData;
  }, [allBookSegments, displayLang1]);

  const currentChapterIndex = useMemo(() => {
    if (chapterStartPages.length === 0) return 0;
    return chapterStartPages.findLastIndex((startPage) => currentPageIndex >= startPage) ?? 0;
  }, [currentPageIndex, chapterStartPages]);

  // Audio player sync effect
  useEffect(() => {
    if (
      audioPlayer.currentPlayingItem?.id === book.id &&
      audioPlayer.isActive &&
      !isCalculating &&
      audioPlayer.position.originalSegmentId
    ) {
      const targetPage = getPageForSegment(audioPlayer.position.originalSegmentId);
      if (targetPage !== -1 && targetPage !== currentPageIndex) {
        setCurrentPageIndex(targetPage);
      }
    }
  }, [
    audioPlayer.currentPlayingItem,
    audioPlayer.isActive,
    audioPlayer.position,
    currentPageIndex,
    getPageForSegment,
    isCalculating,
    setCurrentPageIndex,
    book.id
  ]);

  const handleTextSelection = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!wordLookupEnabled || !book) return;
      if (lookupState.isOpen) {
        setLookupState((s) => ({ ...s, isOpen: false }));
      }
      const selection = window.getSelection();
      const selectedText = selection?.toString().trim() ?? '';

      if (selectedText.length > 0 && selectedText.length < 150 && selection) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        let sourceLang = displayLang1;
        let segmentId: string | undefined = undefined;
        let sentenceContext = `...${selectedText}...`;
        const startContainer = range.startContainer;
        const segmentElement = (
          startContainer.nodeType === 3 ? startContainer.parentElement : (startContainer as HTMLElement)
        )?.closest<HTMLElement>('[data-segment-id]');

        if (segmentElement) {
          segmentId = segmentElement.dataset.segmentId;
          const langBlockElement = (
            startContainer.nodeType === 3 ? startContainer.parentElement : (startContainer as HTMLElement)
          )?.closest<HTMLElement>('[lang]');
          if (langBlockElement) {
            sentenceContext = langBlockElement.textContent || '';
            sourceLang = langBlockElement.lang || sourceLang;
          } else {
            sentenceContext = segmentElement.textContent || '';
          }
        }

        if (sourceLang === i18n.language) return;

        const currentChapterInfo = chapters?.[currentChapterIndex];

        setLookupState({
          isOpen: true,
          text: selectedText,
          rect,
          sourceLang,
          targetLanguage: i18n.language,
          sourceItem: book,
          chapterId: currentChapterInfo?.segmentId,
          segmentId,
          sentenceContext,
          context: 'reader'
        });
      } else if (lookupState.isOpen) {
        setLookupState((s) => ({ ...s, isOpen: false }));
      }
    },
    [wordLookupEnabled, book, i18n.language, currentChapterIndex, lookupState.isOpen, displayLang1, chapters]
  );

  const handleDragEnd = (event: any, info: any) => {
    const swipeThreshold = 50;
    if (info.offset.x > swipeThreshold) {
      goToPage(currentPageIndex - 1);
    } else if (info.offset.x < -swipeThreshold) {
      goToPage(currentPageIndex + 1);
    }
  };

  const handleChapterSelect = (chapterIndex: number) => {
    const targetPageIndex = chapterStartPages[chapterIndex];
    if (targetPageIndex !== undefined) {
      setCurrentPageIndex(targetPageIndex);
    }
    setIsTocOpen(false);
  };

  const currentPageData = pages[currentPageIndex];

  // Toolbar component
  const toolbar = (
    <ReaderToolbar
      settings={editorSettings}
      onSettingsChange={setEditorSettings}
      onClose={() => setIsToolbarOpen(false)}
      isToolbarOpen={isToolbarOpen}
      onToggleToolbar={() => setIsToolbarOpen((p) => !p)}
      bookTitle={(book.title as any)[displayLang1]}
      availableLanguages={book.langs}
      displayLang1={displayLang1}
      displayLang2={displayLang2}
      onDisplayLang1Change={setDisplayLang1}
      onDisplayLang2Change={setDisplayLang2}
      presentationStyle="book"
      onToggleFocusMode={() => setIsFocusMode(true)}
    />
  );

  return (
    <div
      id="reader-veil"
      className="w-full h-full fixed inset-0 z-40"
      onMouseUp={handleTextSelection}
    >
      <Suspense fallback={null}>
        {lookupState.isOpen && lookupState.rect && (
          <LookupPopover {...lookupState} sourceLanguage={lookupState.sourceLang} targetLanguage={lookupState.targetLanguage} onOpenChange={(open) => setLookupState((s) => ({ ...s, isOpen: open }))} />
        )}
      </Suspense>

      <FocusModeWrapper
        isActive={isFocusMode}
        onToggle={() => setIsFocusMode(false)}
        isMobile={isMobile}
        toolbar={toolbar}
      >
        <div id="reader-studio-container" className="w-full h-full flex flex-col items-center justify-center">
          {/* Main content area with proper height calculation */}
          <div
            id="reader-content-wrapper"
            className="relative w-full flex items-center justify-center min-h-0 p-1 group/reader"
            style={{
              height: isFocusMode ? '100%' : 'calc(100vh - 56px - 56px)'
            }}
          >
            {/* Toolbar and TOC - only show when not in focus mode */}
            {!isFocusMode && (
              <>
                <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1">
                  {toolbar}
                  <Sheet open={isTocOpen} onOpenChange={setIsTocOpen}>
                    <SheetTrigger asChild>
                      <Button variant="outline" size="icon" className="h-9 w-9 bg-background/70 backdrop-blur-sm">
                        <Icon name="List" className="h-4 w-4" />
                      </Button>
                    </SheetTrigger>
                    <SheetContent side={isMobile ? 'bottom' : 'left'} className="w-full max-w-xs p-0 flex flex-col">
                      <SheetHeader className="p-4 border-b">
                        <SheetTitle className="font-headline text-lg text-primary truncate">
                          {(book.title as any)[displayLang1]}
                        </SheetTitle>
                      </SheetHeader>
                      <ScrollArea className="flex-1">
                        <div className="p-2 font-body">
                          {chapters?.map((chapter, index) => (
                            <Button
                              key={chapter.segmentId}
                              variant="ghost"
                              className={cn(
                                'w-full justify-start text-left h-auto py-2',
                                index === currentChapterIndex && 'bg-accent text-accent-foreground'
                              )}
                              onClick={() => handleChapterSelect(index)}
                            >
                              <span className="truncate">{(chapter.title as any)[displayLang1]}</span>
                            </Button>
                          ))}
                        </div>
                      </ScrollArea>
                    </SheetContent>
                  </Sheet>
                </div>

                {/* Navigation buttons */}
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full z-20 opacity-0 group-hover/reader:opacity-100 transition-opacity disabled:opacity-0"
                  disabled={currentPageIndex === 0}
                  onClick={() => goToPage(currentPageIndex - 1)}
                >
                  <Icon name="ChevronLeft" className="h-5 w-5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full z-20 opacity-0 group-hover/reader:opacity-100 transition-opacity disabled:opacity-0"
                  disabled={currentPageIndex >= pageCount - 1}
                  onClick={() => goToPage(currentPageIndex + 1)}
                >
                  <Icon name="ChevronRight" className="h-5 w-5" />
                </Button>

                {/* Page counter */}
                {pageCount > 0 && (
                  <div className="absolute bottom-4 right-8 z-20 text-xs text-muted-foreground font-sans bg-background/50 px-2 py-1 rounded-md opacity-0 group-hover/reader:opacity-100 transition-opacity">
                    {currentPageIndex + 1} / {pageCount}
                  </div>
                )}
              </>
            )}

            {/* Book content */}
            <motion.div
              ref={contentContainerRef}
              className={cn('w-full max-w-3xl h-full shadow-xl overflow-hidden', editorSettings.background)}
              drag={isMobile && !isFocusMode ? 'x' : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={handleDragEnd}
            >
              {isCalculating ? (
                <div className="flex items-center justify-center h-full text-center text-muted-foreground p-8">
                  <div>
                    <Icon name="BookOpen" className="h-10 w-10 animate-pulse text-primary mx-auto" />
                    <p className="mt-2">{t('paginating')}</p>
                  </div>
                </div>
              ) : currentPageData ? (
                <ContentPageRenderer
                  page={currentPageData}
                  presentationStyle="book"
                  editorSettings={editorSettings}
                  itemData={book}
                  displayLang1={displayLang1}
                  displayLang2={displayLang2}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-center text-muted-foreground p-8">
                  <p>No content to display.</p>
                </div>
              )}
            </motion.div>
          </div>

          {/* Footer reserve space - empty but maintains layout */}
          {!isFocusMode && <div className="h-14 md:h-16 w-full" />}
        </div>
      </FocusModeWrapper>

      <PaginationDebugPanel
        item={book}
        segments={allBookSegments}
        pages={pages}
        currentPageIndex={currentPageIndex}
        isCalculating={isCalculating}
        containerRef={contentContainerRef}
        displayLang1={displayLang1}
        displayLang2={displayLang2}
        unit={book.unit || 'sentence'}
      />
    </div>
  );
}