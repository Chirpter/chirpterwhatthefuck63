// src/features/reader/components/piece/PieceReader.tsx
'use client';

import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useTranslation } from 'react-i18next';
import { useSettings } from '@/contexts/settings-context';
import { useEditorSettings } from '@/hooks/useEditorSettings';
import { cn } from '@/lib/utils';
import type { Piece, LibraryItem, Page, VocabContext } from '@/lib/types';

import { ReaderToolbar } from '../shared/ReaderToolbar';
import { ContentPageRenderer } from '../shared/ContentPageRenderer';
import { getItemSegments } from '@/services/shared/SegmentParser';
import { Icon } from '@/components/ui/icons';

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
  presentationStyle?: 'doc' | 'card';
  aspectRatio?: '1:1' | '3:4' | '4:3';
}

export default function PieceReader({
  piece,
  isPreview = false,
  presentationStyle: externalPresentationStyle,
  aspectRatio: externalAspectRatio,
}: PieceReaderProps) {
  // --- HOOKS (Called unconditionally at the top) ---
  const { t, i18n } = useTranslation(['readerPage', 'common']);
  const { wordLookupEnabled } = useSettings();
  const [editorSettings, setEditorSettings] = useEditorSettings(piece?.id ?? null);
  const [isToolbarOpen, setIsToolbarOpen] = useState(false);
  
  const [displayLang1, setDisplayLang1] = useState(piece?.langs[0] || 'en');
  const [displayLang2, setDisplayLang2] = useState(piece?.langs[1] || 'none');
  const [lookupState, setLookupState] = useState<LookupState>({ isOpen: false, text: '', rect: null, sourceLang: '', targetLanguage: '', sourceItem: null, sentenceContext: '', context: 'reader' });

  // Update display languages when the piece prop changes
  useEffect(() => {
    setDisplayLang1(piece?.langs[0] || 'en');
    setDisplayLang2(piece?.langs[1] || 'none');
  }, [piece]);

  const allSegments = useMemo(() => getItemSegments(piece), [piece]);
  
  const singlePage: Page = useMemo(() => ({
    pageIndex: 0,
    items: allSegments,
    estimatedHeight: 0
  }), [allSegments]);

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
        let sentenceContext = `...${'${selectedText}'}...`;
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

  // --- RENDER LOGIC ---

  const finalPresentationStyle = externalPresentationStyle || piece?.presentationStyle || 'card';
  const finalAspectRatio = externalAspectRatio || piece?.aspectRatio || '3:4';
  
  if (!piece || piece.contentState !== 'ready') {
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
  
  // In preview, 'doc' style should look like a 3:4 card
  const isDocLikeCard = isPreview && finalPresentationStyle === 'doc';

  const cardClassName = cn(
    "w-full shadow-xl rounded-lg overflow-hidden transition-colors duration-300",
    finalPresentationStyle === 'card' && getAspectRatioClass(finalAspectRatio),
    isDocLikeCard && getAspectRatioClass('3:4'),
    finalPresentationStyle === 'doc' && !isPreview && 'max-w-3xl aspect-[1/1]',
    finalPresentationStyle === 'card' && 'max-w-md',
    editorSettings.background
  );

  const mainContainerClasses = isPreview 
    ? cardClassName
    : "w-full h-full flex flex-col items-center justify-center p-4";

  const contentWrapper = (
    <div className={isPreview ? 'w-full h-full' : cardClassName}>
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
  
  if (isPreview) {
    return contentWrapper;
  }

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

      <div id="reader-studio-container" className={mainContainerClasses}>
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
        {contentWrapper}
      </div>
    </div>
  );
}
