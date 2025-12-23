"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { Slider } from '@/components/ui/slider';
import { useUser } from '@/contexts/user-context';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import { doc, updateDoc, increment, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PiggyBankIcon } from './PiggyBankIcon';
import { CreditIcon } from '@/components/ui/CreditIcon';

interface BetData {
    credits: number;
    days: number;
    startDate: string;
    progress: string[];
}

const getStorageKey = (uid: string) => `chirpter_bet_${uid}`;
const getUtcDateString = (date: Date) => date.toISOString().split('T')[0];

const getDaysBetween = (date1: Date, date2: Date) => {
  const utc1 = Date.UTC(date1.getFullYear(), date1.getMonth(), date1.getDate());
  const utc2 = Date.UTC(date2.getFullYear(), date2.getMonth(), date2.getDate());
  return Math.floor((utc2 - utc1) / (1000 * 60 * 60 * 24));
};

const BetInterface = ({ onBet }: { onBet: (credits: number, days: number) => void }) => {
  const { t } = useTranslation('learningPage');
  const [credits, setCredits] = useState(5);
  const [days, setDays] = useState(7);

  const handleBetClick = () => {
    if (credits > 0 && credits <= 50 && days >= 7 && days <= 30) {
      onBet(credits, days);
    }
  };
  
  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Credits Slider */}
      <div className="w-full space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <CreditIcon className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{t('betCreditsLabel') || 'Credits'}</span>
          </div>
          <span className="text-2xl font-bold text-primary">{credits}</span>
        </div>
        <Slider
          value={[credits]}
          onValueChange={(v) => setCredits(v[0])}
          min={1}
          max={50}
          step={1}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>1</span>
          <span>50</span>
        </div>
      </div>

      {/* Days Slider */}
      <div className="w-full space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Icon name="Calendar" className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{t('betDaysLabel') || 'Days'}</span>
          </div>
          <span className="text-2xl font-bold text-primary">{days}</span>
        </div>
        <Slider
          value={[days]}
          onValueChange={(v) => setDays(v[0])}
          min={7}
          max={30}
          step={1}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>7</span>
          <span>30</span>
        </div>
      </div>

      <Button onClick={handleBetClick} className="w-full mt-2">
        {t('betButton') || 'Place Bet'}
      </Button>
    </div>
  );
};

const StreakTracker = ({ betData }: { betData: BetData }) => {
    const { t } = useTranslation('learningPage');
    const streakProgress = useMemo(() => betData.progress?.length || 0, [betData.progress]);

    return (
        <div className="flex flex-col items-center gap-3 w-full text-center">
            <p className="text-sm font-semibold">{t('betActiveTitle') || 'Active Streak'}</p>
            
            {/* Progress bar */}
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div 
                    className="h-full bg-green-500 transition-all duration-500 ease-out"
                    style={{ width: `${(streakProgress / betData.days) * 100}%` }}
                />
            </div>

            <div className="flex flex-wrap justify-center gap-1.5">
                {Array.from({ length: betData.days }).map((_, i) => (
                    <div 
                        key={i} 
                        className={cn(
                            "h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all duration-300",
                            i < streakProgress 
                                ? "bg-green-500 border-green-700 shadow-md shadow-green-500/30" 
                                : "bg-muted border-border"
                        )}
                        title={`Day ${i + 1}`}
                    >
                      {i < streakProgress && <Icon name="Check" className="h-4 w-4 text-white"/>}
                    </div>
                ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
                {t('betProgressDescription', { amount: betData.credits })}
            </p>
        </div>
    );
};

export default function DisciplineBetting() {
    const { t } = useTranslation('learningPage');
    const { toast } = useToast();
    const { user, reloadUser } = useUser();
    const [activeBet, setActiveBet] = useState<BetData | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!user) return;

        const betKey = getStorageKey(user.uid);
        
        try {
            const savedBetJson = localStorage.getItem(betKey);
            if (savedBetJson) {
                const betData: BetData = JSON.parse(savedBetJson);
                const today = new Date();
                const todayStr = getUtcDateString(today);

                if (betData.progress.length > 0) {
                    const lastProgressDate = new Date(betData.progress[betData.progress.length - 1]);
                    const daysSinceLastProgress = getDaysBetween(lastProgressDate, today);
                    
                    if (daysSinceLastProgress > 1) {
                        toast({ 
                            title: t('betLostTitle') || "Bet Lost!", 
                            description: t('betLostDescription', { amount: betData.credits }) || `You missed a day and lost your ${betData.credits} credit bet.`, 
                            variant: 'destructive' 
                        });
                        localStorage.removeItem(betKey);
                        setActiveBet(null);
                        return;
                    }
                }

                const startDate = new Date(betData.startDate);
                const endDate = new Date(startDate);
                endDate.setUTCDate(startDate.getUTCDate() + betData.days);
                
                const todayUtc = new Date();
                todayUtc.setUTCHours(0, 0, 0, 0);

                if (todayUtc >= endDate) {
                    if (betData.progress.length >= betData.days) {
                        toast({ 
                            title: t('betWonTitle') || "Bet Won!", 
                            description: t('betWonDescription', { amount: betData.credits }) || `You completed your streak and got back ${betData.credits} credits!` 
                        });
                        const userDocRef = doc(db, 'users', user.uid);
                        updateDoc(userDocRef, {
                            credits: increment(betData.credits)
                        }).then(reloadUser).catch(err => {
                            console.error("Failed to refund credits:", err);
                        });
                        
                        // 🎯 Trigger Piggy quotes on streak completion
                        if (typeof window !== 'undefined') {
                            window.dispatchEvent(new CustomEvent('chirpter:streak-complete'));
                        }
                    }
                    localStorage.removeItem(betKey);
                    setActiveBet(null);
                    return;
                }

                const hasCheckedInToday = betData.progress.includes(todayStr);
                if (!hasCheckedInToday) {
                    const updatedProgress = [...betData.progress, todayStr];
                    const updatedBetData = { ...betData, progress: updatedProgress };
                    
                    localStorage.setItem(betKey, JSON.stringify(updatedBetData));
                    setActiveBet(updatedBetData);
                } else {
                    setActiveBet(betData);
                }
            }
        } catch (error) {
            console.error("Error handling bet data:", error);
            localStorage.removeItem(betKey);
        }
    }, [user, toast, reloadUser, t]);

    const handleBet = async (credits: number, days: number) => {
        if (!user) return;
        if (isLoading) return;
        
        if (credits > (user.credits || 0)) {
            toast({ title: t('notEnoughCredits') || "Not enough credits", variant: "destructive" });
            return;
        }
        
        setIsLoading(true);
        
        const betData: BetData = { 
            credits, 
            days, 
            startDate: new Date().toISOString(), 
            progress: [getUtcDateString(new Date())]
        };
        
        const betKey = getStorageKey(user.uid);
        
        try {
            const userDocRef = doc(db, 'users', user.uid);
            
            await runTransaction(db, async (transaction) => {
                const userDoc = await transaction.get(userDocRef);
                
                if (!userDoc.exists()) {
                    throw new Error('User document not found');
                }
                
                const currentCredits = userDoc.data()?.credits || 0;
                
                if (currentCredits < credits) {
                    throw new Error('Insufficient credits');
                }
                
                transaction.update(userDocRef, {
                    credits: increment(-credits)
                });
            });
            
            localStorage.setItem(betKey, JSON.stringify(betData));
            setActiveBet(betData);
            await reloadUser();

            toast({ 
                title: t('betPlacedTitle') || "Bet placed!", 
                description: t('betPlacedDescription', { credits, days }) || `You bet ${credits} credits for a ${days}-day streak.` 
            });

            // 🎯 Trigger Piggy quotes
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('chirpter:bet-success'));
            }

        } catch (error: any) {
            console.error("Error placing bet:", error);
            
            const errorMessage = error.message === 'Insufficient credits' 
                ? t('notEnoughCredits') || "Not enough credits" 
                : t('betErrorDescription') || "Could not place your bet. Please try again.";
            
            toast({ 
                title: t('errorTitle') || "Error", 
                description: errorMessage, 
                variant: "destructive" 
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full grid grid-cols-3 items-center justify-items-center gap-4">
            <p className="text-sm text-muted-foreground text-center">{t('betDescription')}</p>
            <PiggyBankIcon className="h-20 w-20 text-primary" />
            <div className="w-full max-w-xs">
                {activeBet ? (
                    <StreakTracker betData={activeBet} />
                ) : (
                    <BetInterface onBet={handleBet} />
                )}
            </div>
        </div>
    );
}