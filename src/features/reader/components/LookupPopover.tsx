

"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { useToast } from '@/hooks/useToast';
import { useUser } from '@/contexts/user-context';
import { translateText, type TranslateTextOutput } from '@/ai/flows/translate-text-flow';
import { useAudioPlayer } from '@/contexts/audio-player-context';
import { addVocabularyItem } from '@/services/client/vocabulary-service';
import { Skeleton } from '@/components/ui/skeleton';
import type { LibraryItem, VocabContext, FoundClip, Piece } from '@/lib/types';
import { getBcp47LangCode, cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import YouTube from 'react-youtube';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { VideoSnippetPopover } from '@/features/learning/components/vocab-videos/VideoSnippetPopover';


interface LookupPopoverProps {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  sourceItem: LibraryItem | null;
  chapterId?: string;
  segmentId?: string;
  sentenceContext: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  rect: DOMRect | null;
  context: VocabContext;
}

const LookupPopoverContent: React.FC<Omit<LookupPopoverProps, 'isOpen' | 'onOpenChange' | 'rect'>> = ({ text, sourceLanguage, targetLanguage, sourceItem, chapterId, segmentId, sentenceContext, context }) => {
  const { user } = useUser();
  const { toast } = useToast();
  const { speakTextSnippet, isSpeaking: isPlayerSpeaking } = useAudioPlayer();

  const [translationResult, setTranslationResult] = useState<TranslateTextOutput | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false); // Local speaking state
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTranslate = useCallback(async () => {
    if (sourceLanguage === targetLanguage) {
      setTranslationResult({ translation: text }); // No translation needed
      return;
    }
    setIsTranslating(true);
    setError(null);
    try {
      const result = await translateText({ text, targetLanguage, sourceLanguage });
      setTranslationResult(result);
    } catch (err) {
      setError('Translation failed.');
      console.error(err);
    } finally {
      setIsTranslating(false);
    }
  }, [text, sourceLanguage, targetLanguage]);

  useEffect(() => {
    handleTranslate();
  }, [handleTranslate]);

  const handleSpeak = () => {
    if (isSpeaking || isPlayerSpeaking) return;
    setIsSpeaking(true);
    speakTextSnippet(text, sourceLanguage, () => {
        setIsSpeaking(false);
    });
  };

  const handleSave = async () => {
    if (!user || !translationResult || !sourceItem) return;
    setIsSaving(true);
    setError(null);
    try {
      await addVocabularyItem(user, {
        term: text,
        meaning: translationResult.translation || '',
        partOfSpeech: translationResult.partOfSpeech,
        termLanguage: getBcp47LangCode(sourceLanguage),
        meaningLanguage: getBcp47LangCode(targetLanguage),
        sourceType: sourceItem.type,
        sourceId: sourceItem.id,
        sourceTitle: sourceItem.title,
        example: sentenceContext,
        exampleLanguage: getBcp47LangCode(sourceLanguage),
        chapterId,
        segmentId,
        // ✅ CONTEXT ASSIGNMENT: This is where we "stamp" the origin of the saved word.
        // The `context` prop is passed down from the parent component (`ReaderPage` or `VocabVideosView`).
        context,
        contextData: sourceItem.type === 'piece' ? (sourceItem as Piece).contextData : undefined,
      });
      toast({ title: 'Saved!', description: `"${text}" was added to your vocabulary.` });
    } catch (err) {
      setError('Failed to save word.');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-1 p-1">
        <div className="flex-grow space-y-0.5 px-2">
            <p className="font-bold text-md text-primary">{text}</p>
            {isTranslating ? (
            <Skeleton className="h-4 w-3/4" />
            ) : (
            translationResult && <p className="text-sm text-foreground">{translationResult.translation}</p>
            )}
            {translationResult?.partOfSpeech && (
            <p className="text-xs text-muted-foreground italic">({translationResult.partOfSpeech})</p>
            )}
            {error && <p className="text-xs text-destructive mt-1">{error}</p>}
        </div>
        <div className="flex flex-col items-center">
            <VideoSnippetPopover term={text}>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 text-muted-foreground" 
                    onClick={e => e.stopPropagation()} 
                    aria-label="Find video clips"
                >
                    <Icon name="Youtube" className="h-4 w-4" />
                </Button>
            </VideoSnippetPopover>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSpeak}>
              <Icon name="Volume2" className={cn("h-4 w-4", (isSpeaking || isPlayerSpeaking) && "text-destructive")} />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSave} disabled={isSaving || !translationResult}>
            {isSaving ? <Icon name="Loader2" className="animate-spin h-4 w-4" /> : <Icon name="Save" className="h-4 w-4" />}
            </Button>
        </div>
    </div>
  );
};


export const LookupPopover: React.FC<LookupPopoverProps> = ({ isOpen, onOpenChange, rect, ...props }) => {
    return (
        <Popover open={isOpen} onOpenChange={onOpenChange}>
            <PopoverTrigger asChild>
                <div
                    id="popover-anchor"
                    style={{
                        position: 'fixed',
                        top: `${rect?.top ?? 0}px`,
                        left: `${rect?.left ?? 0}px`,
                        width: `${rect?.width ?? 0}px`,
                        height: `${rect?.height ?? 0}px`,
                        pointerEvents: 'none',
                    }}
                />
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" side="top" align="center">
                <LookupPopoverContent {...props} />
            </PopoverContent>
        </Popover>
    );
};

export default LookupPopover;
