

"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { useTranslation } from 'react-i18next';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import { SrsExplanationChart } from './SrsExplanationChart';

interface DailyGoalCardProps {
    progress: number;
    goal: number;
}

const CountdownTimer = () => {
    const { t } = useTranslation('vocabularyPage');
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        const intervalId = setInterval(() => {
            const now = new Date();
            const tomorrowUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
            const diff = tomorrowUtc.getTime() - now.getTime();

            if (diff <= 0) {
                setTimeLeft(t('dayResetsSoon'));
                return;
            }

            const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
            const minutes = Math.floor((diff / 1000 / 60) % 60);
            const seconds = Math.floor((diff / 1000) % 60);

            setTimeLeft(t('resetsIn', {
                hours: hours.toString().padStart(2, '0'),
                minutes: minutes.toString().padStart(2, '0'),
                seconds: seconds.toString().padStart(2, '0'),
            }));
        }, 1000);

        return () => clearInterval(intervalId);
    }, [t]);

    return <p className="text-xs opacity-80 mt-2">{timeLeft}</p>;
};

// Helper component to render simple markdown-like text
const SimpleMarkdownRenderer = ({ text }: { text: string }) => {
    // Split by newline and filter out empty lines that might result from double newlines
    const lines = text.split('\n').filter(line => line.trim() !== '');

    const renderLine = (line: string) => {
        // This regex splits the string by the **bold** pattern, keeping the delimiters.
        const parts = line.split(/(\*\*.*?\*\*)/g).filter(Boolean);
        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                // If it's a bold part, render it with <strong>
                return <strong key={i}>{part.slice(2, -2)}</strong>;
            }
            // Otherwise, render as plain text
            return part;
        });
    };

    return (
        <div className="text-sm text-muted-foreground">
            {lines.map((line, index) => (
                <p key={index} className="leading-snug">{renderLine(line)}</p>
            ))}
        </div>
    );
};


export const DailyGoalCard: React.FC<DailyGoalCardProps> = ({ progress, goal }) => {
    const { t } = useTranslation('vocabularyPage');
    const percentage = goal > 0 ? (progress / goal) * 100 : 0;
    const isCompleted = progress >= goal;

    // --- NEW: Cleanup Logic ---
    useEffect(() => {
        const cleanupOldProgress = () => {
            try {
                const today = new Date().toISOString().split('T')[0];
                const keysToRemove: string[] = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith('chirpter_vocab_progress_') && !key.endsWith(today)) {
                        keysToRemove.push(key);
                    }
                }
                keysToRemove.forEach(key => localStorage.removeItem(key));
            } catch (e) {
                console.warn("Could not clean up old vocab progress:", e);
            }
        };

        // Run cleanup on mount
        cleanupOldProgress();
    }, []);
    // --- END: Cleanup Logic ---

    return (
        <Card className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 text-white shadow-lg overflow-hidden">
            <CardContent className="p-6 flex items-center gap-6 relative">
                 <Icon name="Sparkles" className="absolute -top-4 -left-4 h-20 w-20 text-white/10" />
                 <Icon name="Star" className="absolute -bottom-5 -right-5 h-24 w-24 text-white/10 rotate-12" />

                <div className="absolute top-2 right-2 z-20">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-white/80 hover:text-white hover:bg-white/20 h-8 w-8 rounded-full">
                                <Icon name="Info" className="h-5 w-5" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 md:w-96 text-foreground font-body" align="end">
                            <div className="space-y-1">
                                <h4 className="font-headline font-semibold">{t('srsPopover.title')}</h4>
                                <div className="h-44">
                                    <SrsExplanationChart />
                                </div>
                                <SimpleMarkdownRenderer text={t('srsPopover.explanation')} />
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>

                <div className="w-24 h-24 flex-shrink-0">
                    <CircularProgressbar
                        value={percentage}
                        text={isCompleted ? 'Done!' : `${progress}/${goal}`}
                        styles={buildStyles({
                            textColor: "white",
                            pathColor: "white",
                            trailColor: "rgba(255, 255, 255, 0.3)",
                            textSize: '24px',
                        })}
                    />
                </div>
                <div className="z-10">
                    <h3 className="font-headline text-2xl font-bold">
                        {isCompleted ? t('dailyGoal.completedTitle') : t('dailyGoal.inProgressTitle')}
                    </h3>
                    <p className="font-body text-sm opacity-90 mt-1">
                        {isCompleted ? t('dailyGoal.completedDescription') : t('dailyGoal.inProgressDescription')}
                    </p>
                    <CountdownTimer />
                </div>
            </CardContent>
        </Card>
    );
};
