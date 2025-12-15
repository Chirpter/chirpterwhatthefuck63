// src/features/reader/components/piece/PieceReader.tsx
'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useTranslation } from 'react-i18next';
import { useAudioPlayer } from '@/contexts/audio-player-context';
import { useSettings } from '@/contexts/settings-context';
import { useEditorSettings } from '@/hooks/useEditorSettings';
import { cn } from '@/lib/utils';
import type { Piece, LibraryItem, Page, VocabContext } from '@/lib/types';

import { ReaderToolbar } from '../shared/ReaderToolbar';
import { BookRenderer } from '../shared/BookRenderer';
import { getItemSegments } from '@/services/shared/SegmentParser';

const LookupPopover = dynamic(() => import('@/features/lookup/components/LookupPopover'), { ssr: false });

interface LookupState {
  isOpen: boolean;
  text: string;
  rect: DOMRect | null;
  sourceLang: string;
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

export default function PieceReader({ piece }: { piece: Piece }) {
  const { t, i18n } = useTranslation(['readerPage', 'common']);
  const audioPlayer = useAudioPlayer();
  const { wordLookupEnabled } = useSettings();

  const [editorSettings, setEditorSettings] = useEditorSettings(piece.id);
  const [isToolbarOpen, setIsToolbarOpen] = useState(false);
  
  const [displayLang1, setDisplayLang1] = useState(piece.langs[0] || 'en');
  const [displayLang2, setDisplayLang2] = useState(piece.langs[1] || 'none');

  const [lookupState, setLookupState] = useState<LookupState>({ isOpen: false, text: '', rect: null, sourceLang: '', sourceItem: null, sentenceContext: '', context: 'reader' });
  const allSegments = useMemo(() => getItemSegments(piece), [piece]);
  
  const singlePage: Page = useMemo(() => ({
    pageIndex: 0,
    items: allSegments,
    estimatedHeight: 0
  }), [allSegments]);

  const handleTextSelection = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!wordLookupEnabled) return;
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
            targetLanguage: i18n.language, sourceItem: piece, sentenceContext, context: 'reader',
        });
    } else if (lookupState.isOpen) {
      setLookupState(s => ({...s, isOpen: false}));
    }
  }, [wordLookupEnabled, piece, i18n.language, lookupState.isOpen, displayLang1]);

  const cardClassName = cn(
    "w-full shadow-xl rounded-lg overflow-hidden transition-colors duration-300",
    piece.presentationStyle === 'card' ? getAspectRatioClass(piece.aspectRatio) : '',
    piece.presentationStyle === 'doc' ? 'max-w-3xl aspect-[1/1]' : 'max-w-md',
    editorSettings.background
  );

  return (
    <div id="reader-veil" className="w-full h-full fixed inset-0 z-40" onMouseUp={handleTextSelection}>
        <Suspense>
            {lookupState.isOpen && lookupState.rect && (
            <LookupPopover 
                {...lookupState}
                onOpenChange={(open) => setLookupState(s => ({...s, isOpen: open}))}
            />
            )}
        </Suspense>

      <div id="reader-studio-container" className="w-full h-full flex flex-col items-center justify-center p-4">
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30">
          <ReaderToolbar
            settings={editorSettings}
            onSettingsChange={setEditorSettings}
            onClose={() => setIsToolbarOpen(false)}
            isToolbarOpen={isToolbarOpen}
            onToggleToolbar={() => setIsToolbarOpen(p => !p)}
            // Language props
            bookTitle={(piece.title as any)[displayLang1]}
            availableLanguages={piece.langs}
            displayLang1={displayLang1}
            displayLang2={displayLang2}
            onDisplayLang1Change={setDisplayLang1}
            onDisplayLang2Change={setDisplayLang2}
            presentationStyle={piece.presentationStyle}
          />
        </div>

        <div className={cardClassName}>
          <div className="w-full h-full overflow-y-auto">
            <BookRenderer
              page={singlePage}
              presentationStyle={piece.presentationStyle}
              editorSettings={editorSettings}
              itemData={piece}
              displayLang1={displayLang1}
              displayLang2={displayLang2}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
