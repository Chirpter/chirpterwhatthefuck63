// src/features/vocabulary/components/flashcards/FlashcardDashboard.tsx

"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Icon, type IconName } from '@/components/ui/icons';
import type { SrsState } from '@/lib/types';
import { VocabularyFolderCard } from '@/features/vocabulary/components/vocab/VocabularyFolderCard';
import { Skeleton } from '@/components/ui/skeleton';
import { DailyGoalCard } from '@/features/vocabulary/components/flashcards/DailyGoalCard';
import { SpacedRepetitionTracker } from '@/features/vocabulary/components/flashcards/SpacedRepetitionTracker';
import { useStudyDecks } from '../../hooks/useStudyDecks';

const DAILY_GOAL_DEFAULT = 10;

export default function FlashcardDashboard() {
    const { t } = useTranslation(['vocabularyPage', 'common']);
    const [dailyProgress, setDailyProgress] = useState(0);
    const [dailyGoal, setDailyGoal] = useState(DAILY_GOAL_DEFAULT);
    const [selectedSrsState, setSelectedSrsState] = useState<SrsState>('new');
    
    const { isLoading, foldersToDisplay, srsCounts } = useStudyDecks({ selectedSrsState });

    const srsStateToLabelMap: { [key in SrsState]: string } = {
      new: t('srsStates.new'),
      learning: t('srsStates.learning'),
      'short-term': t('srsStates.shortTerm'),
      'long-term': t('srsStates.longTerm')
    };

    useEffect(() => {
        const today = new Date().toISOString().split('T')[0];
        const key = `chirpter_vocab_progress_${today}`;
        try {
            const progressStr = localStorage.getItem(key);
            if (progressStr) {
                const reviewedIds = JSON.parse(progressStr);
                setDailyProgress(Array.isArray(reviewedIds) ? reviewedIds.length : 0);
            } else {
                localStorage.setItem(key, JSON.stringify([]));
                setDailyProgress(0);
            }
        } catch (e) {
            console.error("Failed to load vocab progress", e);
            setDailyProgress(0);
        }
        setDailyGoal(DAILY_GOAL_DEFAULT);
    }, []);
    
    const renderFolderSkeleton = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
            ))}
        </div>
    );
    
    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-headline-1">{t('flashcardsTitle')}</h2>
                <Button variant="outline" asChild>
                    <Link href="/library/vocabulary">
                        <Icon name="ChevronLeft" className="mr-2 h-4 w-4" />
                        {t('backToVocabulary')}
                    </Link>
                </Button>
            </div>

            <DailyGoalCard progress={dailyProgress} goal={dailyGoal} />

            <SpacedRepetitionTracker 
                counts={srsCounts}
                selectedState={selectedSrsState}
                onStateSelect={setSelectedSrsState}
            />

            {isLoading ? renderFolderSkeleton() : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {foldersToDisplay.map(folder => (
                        <Link 
                            key={folder.id} 
                            href={`/library/vocabulary/flashcards?folder=${folder.id}&srsState=${selectedSrsState}`}
                            className="block"
                        >
                            <VocabularyFolderCard
                                folderName={folder.name}
                                itemCount={folder.count}
                                isSelected={false}
                                isUncategorized={folder.id === 'unorganized'}
                            />
                        </Link>
                    ))}
                </div>
            )}
             { !isLoading && foldersToDisplay.length === 0 && (
                <Card className="w-full max-w-md shadow-lg mx-auto mt-10">
                    <CardHeader className="items-center text-center">
                        <Icon name={
                            selectedSrsState === 'new' ? 'PackageOpen' :
                            selectedSrsState === 'learning' ? 'Clock' :
                            selectedSrsState === 'short-term' ? 'BrainCircuit' : 'BrainCircuit'
                        } className="h-12 w-12 text-muted-foreground mb-4" />
                        <CardTitle className="text-headline-2">{t('noCardsInStage.title')}</CardTitle>
                        <CardDescription className="text-body-base">
                           {t('noCardsInStage.description', { stage: srsStateToLabelMap[selectedSrsState] })}
                        </CardDescription>
                    </CardHeader>
                </Card>
            )}
        </div>
    );
}
