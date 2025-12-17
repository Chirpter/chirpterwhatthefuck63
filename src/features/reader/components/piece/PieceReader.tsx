// src/features/reader/components/piece/PieceReader.tsx
'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useTranslation } from 'react-i18next';
import { useSettings } from '@/contexts/settings-context';
import { useEditorSettings } from '@/hooks/useEditorSettings';
import { usePagination } from '@/features/reader/hooks/usePagination';
import { cn } from '@/lib/utils';
import type { Piece, LibraryItem, VocabContext, Segment } from '@/lib/types';

import { ReaderToolbar } from '../shared/ReaderToolbar';
import { ContentPageRenderer } from '../shared/ContentPageRenderer';
import { Icon } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { useMobile } from '@/hooks/useMobile';
import { PaginationDebugPanel } from '@/components/debug/PaginationDebugPanel';

const LookupPopover = dynamic(() => import('@/features/lookup/components/LookupPopover'), { ssr: false });

interface LookupState {
  isOpen: boolean;
  text: string;
  rect: DOMRect | null;
  sourceLang: string;
  targetLanguage: string;
  sourceItem: LibraryItem | null;
  sentenceContext: string;
  context: VocabContext;
}

const getAspectRatioClass = (ratio?: '1:1' | '3:4' | '4:3'): string => {
    switch (ratio) {
        case '1:1': return 'aspect-square';
        case '4:3': return 'aspect-[4/3]';
        case '3:4':
        default: return 'aspect-[3/4]';
    }
};

interface PieceReaderProps {
  piece: Piece | null;
  isPreview?: boolean;
}

export default function PieceReader({
  piece,
  isPreview = false,
}: PieceReaderProps) {
  const { t, i18n } = useTranslation(['readerPage', 'common']);
  const { wordLookupEnabled } = useSettings();
  const [editorSettings, setEditorSettings] = useEditorSettings(piece?.id ?? null);
  const [isToolbarOpen, setIsToolbarOpen] = useState(false);
  const isMobile = useMobile();
  
  // --- STATE FOR DYNAMIC LANGUAGE DISPLAY ---
  const [displayLang1, setDisplayLang1] = useState(() => piece?.langs[0] || 'en');
  const [displayLang2, setDisplayLang2] = useState(() => piece?.langs[1] || 'none');

  useEffect(() => {
    if (piece) {
        const originParts = piece.origin.split('-');
        setDisplayLang1(originParts[0] || piece.langs[0] || 'en');
        setDisplayLang2(originParts[1] || 'none');
    }
  }, [piece]);
  // --- END LANGUAGE STATE ---

  const [lookupState, setLookupState] = useState<LookupState>({ 
    isOpen: false, text: '', rect: null, sourceLang: '', targetLanguage: '', 
    sourceItem: null, sentenceContext: '', context: 'reader' 
  });

  const contentContainerRef = useRef<HTMLDivElement>(null);

  const allSegments = piece?.generatedContent || [];
  
  const finalPresentationStyle = piece?.presentationStyle || 'card';
  const finalAspectRatio = piece?.aspectRatio || '3:4';

  const {
    pages,
    currentPageIndex,
    isCalculating,
    goToPage,
    pageCount,
  } = usePagination({
    segments: allSegments,
    containerRef: contentContainerRef,
    isEnabled: !isPreview,
    presentationStyle: finalPresentationStyle,
    aspectRatio: finalAspectRatio,
    displayLang1,
    displayLang2,
    unit: piece?.unit || 'sentence',
  });

  const handleTextSelection = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!wordLookupEnabled || isPreview || !piece) return;
    if (lookupState.isOpen) {
      setLookupState(s => ({...s, isOpen: false}));
    }
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim() ?? '';

    if (selectedText.length > 0 && selectedText.length < 150 && selection) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        let sourceLang = displayLang1;
        let sentenceContext = `...${selectedText}...`;
        const startContainer = range.startContainer;
        const segmentElement = (startContainer.nodeType === 3 ? startContainer.parentElement : startContainer as HTMLElement)?.closest<HTMLElement>('[data-segment-id]');

        if (segmentElement) {
            const spanElement = (startContainer.nodeType === 3 ? startContainer.parentElement : startContainer as HTMLElement)?.closest<HTMLElement>('span[lang]');
            if (spanElement) {
                sentenceContext = spanElement.textContent || '';
                sourceLang = spanElement.lang || sourceLang;
            } else {
                sentenceContext = segmentElement.textContent || '';
            }
        }
        
        if (sourceLang === i18n.language) return;

        setLookupState({ 
            isOpen: true, text: selectedText, rect, sourceLang,
            targetLanguage: i18n.language,
            sourceItem: piece, sentenceContext, context: 'reader',
        });
    } else if (lookupState.isOpen) {
      setLookupState(s => ({...s, isOpen: false}));
    }
  }, [wordLookupEnabled, piece, i18n.language, lookupState.isOpen, displayLang1, isPreview]);

  const handleDragEnd = (event: any, info: any) => {
    const swipeThreshold = 50;
    if (info.offset.x > swipeThreshold) {
      goToPage(currentPageIndex - 1);
    } else if (info.offset.x < -swipeThreshold) {
      goToPage(currentPageIndex + 1);
    }
  };

  if (!piece || (piece.contentState !== 'ready' && !isPreview)) {
    if (isPreview) {
      return (
        <div className={cn(
          "w-full shadow-xl rounded-lg overflow-hidden transition-colors duration-300 flex items-center justify-center p-4 text-center text-muted-foreground",
          finalPresentationStyle === 'doc' ? 'aspect-video max-w-3xl' : 'max-w-md',
          finalPresentationStyle === 'card' && getAspectRatioClass(finalAspectRatio),
          'bg-muted/30 border-2 border-dashed'
        )}>
          <div>
            <Icon name="FileText" className="h-10 w-10 mx-auto mb-2 opacity-50"/>
            <p>Your content will appear here.</p>
          </div>
        </div>
      );
    }
    return null; 
  }
  
  const isDocLikeCard = isPreview && finalPresentationStyle === 'doc';

  const cardClassName = cn(
    "w-full shadow-xl rounded-lg overflow-hidden transition-colors duration-300",
    finalPresentationStyle === 'card' && getAspectRatioClass(finalAspectRatio),
    isDocLikeCard && getAspectRatioClass('4:3'),
    finalPresentationStyle === 'doc' && !isPreview && 'max-w-3xl aspect-[3/4]',
    finalPresentationStyle === 'card' && 'max-w-md',
    editorSettings.background
  );

  if (isPreview) {
    const singlePage = {
      pageIndex: 0,
      items: allSegments,
      estimatedHeight: 0
    };

    return (
      <div className={cardClassName}>
        <div className="w-full h-full overflow-y-auto">
          <ContentPageRenderer
            page={singlePage}
            presentationStyle={finalPresentationStyle}
            editorSettings={editorSettings}
            itemData={piece}
            displayLang1={displayLang1}
            displayLang2={displayLang2}
          />
        </div>
      </div>
    );
  }

  const currentPageData = pages[currentPageIndex];

  return (
    <div id="reader-veil" className="w-full h-full fixed inset-0 z-40" onMouseUp={handleTextSelection}>
      <Suspense>
        {lookupState.isOpen && lookupState.rect && (
          <LookupPopover 
            isOpen={lookupState.isOpen}
            onOpenChange={(open) => setLookupState(s => ({...s, isOpen: open}))}
            rect={lookupState.rect}
            text={lookupState.text}
            sourceLanguage={lookupState.sourceLang}
            targetLanguage={lookupState.targetLanguage}
            sourceItem={lookupState.sourceItem}
            sentenceContext={lookupState.sentenceContext}
            context={lookupState.context}
          />
        )}
      </Suspense>

      <div id="reader-studio-container" className="w-full h-full flex flex-col items-center justify-center p-4">
        <div id="reader-content-wrapper" className="relative w-full h-full flex items-center justify-center min-h-0 group/reader">
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30">
            <ReaderToolbar
              settings={editorSettings}
              onSettingsChange={setEditorSettings}
              onClose={() => setIsToolbarOpen(false)}
              isToolbarOpen={isToolbarOpen}
              onToggleToolbar={() => setIsToolbarOpen(p => !p)}
              bookTitle={(piece.title as any)[displayLang1]}
              availableLanguages={piece.langs}
              displayLang1={displayLang1}
              displayLang2={displayLang2}
              onDisplayLang1Change={setDisplayLang1}
              onDisplayLang2Change={setDisplayLang2}
              presentationStyle={finalPresentationStyle}
            />
          </div>

          {pageCount > 1 && (
            <>
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
              <div className="absolute bottom-4 right-8 z-20 text-xs text-muted-foreground font-sans bg-background/50 px-2 py-1 rounded-md opacity-0 group-hover/reader:opacity-100 transition-opacity">
                {currentPageIndex + 1} / {pageCount}
              </div>
            </>
          )}

          <motion.div 
            ref={contentContainerRef} 
            className={cardClassName}
            drag={isMobile ? 'x' : false} 
            dragConstraints={{ left: 0, right: 0 }} 
            dragElastic={0.2} 
            onDragEnd={handleDragEnd}
          >
            {isCalculating ? (
              <div className="flex items-center justify-center h-full text-center text-muted-foreground p-8">
                <div>
                  <Icon name="FileText" className="h-10 w-10 animate-pulse text-primary mx-auto" />
                  <p className="mt-2">{t('paginating')}</p>
                </div>
              </div>
            ) : currentPageData ? (
              <ContentPageRenderer
                page={currentPageData}
                presentationStyle={finalPresentationStyle}
                editorSettings={editorSettings}
                itemData={piece}
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
      </div>
      <PaginationDebugPanel
        item={piece}
        segments={allSegments}
        pages={pages}
        currentPageIndex={currentPageIndex}
        isCalculating={isCalculating}
        containerRef={contentContainerRef}
        displayLang1={displayLang1}
        displayLang2={displayLang2}
        unit={piece.unit || 'sentence'}
      />
    </div>
  );
}
