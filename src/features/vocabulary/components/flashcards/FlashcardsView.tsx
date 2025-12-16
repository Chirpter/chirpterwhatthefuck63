// src/features/vocabulary/components/flashcards/FlashcardsView.tsx

"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icons';
import { useUser } from '@/contexts/user-context';
import * as srsService from "@/services/client/srs.service";
import type { VocabularyItem, SrsState } from '@/lib/types';
import { AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/useToast';
import { Flashcard } from './Flashcard';
import { useVocabForFlashcards } from '../../hooks/useVocabForFlashcards';

const trackDailyProgress = (itemId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const key = `chirpter_vocab_progress_${today}`;
    try {
        const progressStr = localStorage.getItem(key);
        const reviewedIds = progressStr ? JSON.parse(progressStr) : [];
        if (Array.isArray(reviewedIds) && !reviewedIds.includes(itemId)) {
            reviewedIds.push(itemId);
            localStorage.setItem(key, JSON.stringify(reviewedIds));
        }
    } catch (e) {
        console.error("Failed to track daily progress", e);
    }
}

export default function FlashcardsView() {
    const { t } = useTranslation(['vocabularyPage', 'common', 'toast']);
    const { user } = useUser();
    const { toast } = useToast();
    const searchParams = useSearchParams();
    const folder = searchParams.get('folder');
    const srsState = searchParams.get('srsState') as SrsState;

    const { cards: originalCards, isLoading } = useVocabForFlashcards(folder, srsState);
    const [sessionCards, setSessionCards] = useState<VocabularyItem[]>([]);
    const [direction, setDirection] = useState(0);

    useEffect(() => {
        if (originalCards.length > 0) {
            setSessionCards(originalCards.sort(() => Math.random() - 0.5));
        }
    }, [originalCards]);

    const activeIndex = useMemo(() => sessionCards.length - 1, [sessionCards]);
    const topCard = useMemo(() => sessionCards[activeIndex], [sessionCards, activeIndex]);

    const processCardAction = useCallback(async (action: 'remembered' | 'forgot' | 'tested_correct' | 'tested_incorrect') => {
        if (!user || activeIndex < 0) return;

        const swipedCard = sessionCards[activeIndex];

        setDirection(action === 'remembered' || action === 'tested_correct' ? 1 : -1);
        setTimeout(() => {
            setSessionCards(prev => prev.slice(0, prev.length - 1));
        }, 100);

        try {
            await srsService.updateSrsItem(user, swipedCard.id, action);
            trackDailyProgress(swipedCard.id);
        } catch (error) {
            console.error("Failed to update SRS item:", error);
            toast({
                title: t('toast:syncErrorTitle'),
                description: t('toast:syncErrorDesc'),
                variant: "destructive"
            });
            setSessionCards(prev => [swipedCard, ...prev]);
        }
    }, [user, activeIndex, sessionCards, toast, t]);

    const handleSwipe = (swipeDirection: number) => {
        processCardAction(swipeDirection > 0 ? 'remembered' : 'forgot');
    };
    
    const handleTest = (isCorrect: boolean) => {
        processCardAction(isCorrect ? 'tested_correct' : 'tested_incorrect');
    };

    const handleRestart = () => {
        setSessionCards(originalCards.sort(() => Math.random() - 0.5));
    }

    if (!folder || !srsState) {
        return (
             <div className="flex flex-col items-center justify-center min-h-[calc(100vh-20rem)] text-center p-4">
                <Card className="w-full max-w-md shadow-lg">
                    <CardHeader>
                        <Icon name="Folder" className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                        <CardTitle className="font-headline text-2xl">{t('noFlashcardSetSelectedTitle')}</CardTitle>
                        <CardDescription className="font-body">
                           {t('noFlashcardSetSelectedDescription')}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild>
                            <Link href="/library/vocabulary/study">
                                <Icon name="ChevronLeft" className="mr-2 h-4 w-4" />
                                {t('chooseAFlashcardSet')}
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-20rem)] text-center p-4">
                <Icon name="Layers" className="mx-auto h-12 w-12 text-primary animate-pulse mb-4" />
                <p className="text-lg text-muted-foreground">{t('loadingFlashcards')}</p>
            </div>
        );
    }

    if (originalCards.length === 0) {
        return (
           <div className="flex flex-col items-center justify-center min-h-[calc(100vh-20rem)] text-center p-4">
              <Card className="w-full max-w-md shadow-lg">
                  <CardHeader>
                      <Icon name="Layers" className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                      <CardTitle className="font-headline text-2xl">{t('flashcardSetEmptyTitle')}</CardTitle>
                      <CardDescription className="font-body">
                          {t('flashcardSetEmptyDescription')}
                      </CardDescription>
                  </CardHeader>
                  <CardContent>
                      <Button asChild variant="secondary">
                          <Link href="/library/vocabulary/study">
                              <Icon name="ChevronLeft" className="mr-2 h-4 w-4" />
                              {t('chooseAnotherFlashcardSet')}
                          </Link>
                      </Button>
                  </CardContent>
              </Card>
          </div>
        );
    }
    
    const isSessionComplete = sessionCards.length === 0;

    if (isSessionComplete) {
        document.dispatchEvent(new CustomEvent('flashcardSessionEnd'));
    }

    return (
        <div className="flex flex-col items-center justify-start pt-4 gap-8 h-[calc(100vh-10rem)] overflow-hidden">
             <div className="flex w-full max-w-4xl justify-between items-center px-4">
                <div className="flex-1 flex justify-start">
                    {/* Placeholder for alignment */}
                </div>
                <div className="flex-1 text-center">
                    <h2 className="text-2xl md:text-3xl font-headline font-semibold">{t('flashcardsTitle')}</h2>
                    <p className="text-muted-foreground">
                        {isSessionComplete 
                            ? t('sessionComplete') 
                            : t('common:card', { current: originalCards.length - sessionCards.length + 1, total: originalCards.length })
                        }
                    </p>
                </div>
                <div className="flex-1 flex justify-end">
                    <Button variant="destructive" size="icon" asChild>
                        <Link href="/library/vocabulary/study">
                            <Icon name="LogOut" className="h-5 w-5" />
                        </Link>
                    </Button>
                </div>
            </div>

            <div className="w-full flex-grow flex flex-col items-center justify-center text-center text-muted-foreground relative">
                {isSessionComplete ? (
                     <Card className="w-full max-w-md shadow-lg">
                        <CardHeader>
                            <Icon name="Trophy" className="mx-auto h-12 w-12 text-amber-500 mb-4" />
                            <CardTitle className="font-headline text-2xl">{t('sessionCompleteTitle')}</CardTitle>
                            <CardDescription className="font-body">
                                {t('sessionCompleteDescription')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-2">
                            <Button onClick={handleRestart}>
                                <Icon name="Repeat" className="mr-2 h-4 w-4" />
                                {t('studyAgainButton')}
                            </Button>
                            <Button asChild variant="secondary">
                                <Link href="/library/vocabulary/study">
                                    {t('chooseAnotherFlashcardSet')}
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="w-full flex items-center justify-center gap-4 md:gap-8 px-4">
                        {topCard && topCard.srsState !== 'long-term' && (
                             <Button
                                variant="outline"
                                className="h-20 w-20 rounded-full border-2 border-destructive text-destructive bg-transparent hover:bg-destructive/10 shadow-xl"
                                onClick={() => handleSwipe(-1)}
                            >
                                <Icon name="X" className="h-10 w-10" />
                                <span className="sr-only">{t('forgotButton')}</span>
                            </Button>
                        )}

                        <div className="w-full max-w-sm h-64 md:h-80 relative">
                             <AnimatePresence initial={false} custom={direction}>
                                {topCard && (
                                     <Flashcard
                                        key={topCard.id}
                                        item={topCard}
                                        onSwipe={handleSwipe}
                                        onTest={handleTest}
                                        isTopCard={true}
                                    />
                                )}
                            </AnimatePresence>
                        </div>
                        
                        {topCard && topCard.srsState !== 'long-term' && (
                            <Button
                                variant="outline"
                                className="h-20 w-20 rounded-full border-2 border-green-600 text-green-600 bg-transparent hover:bg-green-600/10 shadow-xl"
                                onClick={() => handleSwipe(1)}
                            >
                                <Icon name="Check" className="h-10 w-10" />
                                <span className="sr-only">{t('rememberedButton')}</span>
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
