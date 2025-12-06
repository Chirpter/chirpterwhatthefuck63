
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { Input } from '@/components/ui/input';
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
    startDate: string; // ISO String
    progress: string[]; // Array of 'YYYY-MM-DD' strings
}

// Storage key generator
const getStorageKey = (uid: string) => `chirpter_bet_${uid}`;

// UTC date string helper
const getUtcDateString = (date: Date) => date.toISOString().split('T')[0];

// Calculate days between two dates
const getDaysBetween = (date1: Date, date2: Date) => {
  const utc1 = Date.UTC(date1.getFullYear(), date1.getMonth(), date1.getDate());
  const utc2 = Date.UTC(date2.getFullYear(), date2.getMonth(), date2.getDate());
  return Math.floor((utc2 - utc1) / (1000 * 60 * 60 * 24));
};

const BetInterface = ({ onBet }: { onBet: (credits: number, days: number) => void }) => {
  const { t } = useTranslation('learningPage');
  const [credits, setCredits] = useState('');
  const [days, setDays] = useState('7');

  const handleBetClick = () => {
    const creditAmount = parseInt(credits, 10);
    const dayAmount = parseInt(days, 10);
    if (!isNaN(creditAmount) && creditAmount > 0 && !isNaN(dayAmount) && dayAmount >= 7) {
      onBet(creditAmount, dayAmount);
    }
  };
  
  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div className="flex items-center justify-center gap-2">
        <div className="flex flex-col items-center gap-1.5 border rounded-md p-1.5 bg-background/50 h-12 w-12 justify-center">
           <CreditIcon className="h-4 w-4 text-primary" />
           <Input 
              type="number"
              value={credits}
              onChange={(e) => setCredits(e.target.value)}
              className="w-full h-full text-center p-0 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 [-moz-appearance:_textfield] [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none"
            />
        </div>
        <div className="flex flex-col items-center gap-1.5 border rounded-md p-1.5 bg-background/50 h-12 w-12 justify-center">
           <Icon name="Calendar" className="h-4 w-4 text-primary" />
           <Input 
              type="number" 
              value={days}
              onChange={(e) => setDays(e.target.value)}
              min="7"
              className="w-full h-full text-center p-0 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 [-moz-appearance:_textfield] [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none"
            />
        </div>
      </div>
      <Button onClick={handleBetClick} className="w-full mt-2">{t('betButton')}</Button>
    </div>
  );
};

const StreakTracker = ({ betData }: { betData: BetData }) => {
    const { t } = useTranslation('learningPage');
    const streakProgress = useMemo(() => betData.progress?.length || 0, [betData.progress]);

    return (
        <div className="flex flex-col items-center gap-2 w-full text-center">
            <p className="text-sm font-semibold">{t('betActiveTitle')}</p>
            <div className="flex flex-wrap justify-center gap-1.5">
                {Array.from({ length: betData.days }).map((_, i) => (
                    <div 
                        key={i} 
                        className={cn(
                            "h-5 w-5 rounded-full border-2 flex items-center justify-center",
                            i < streakProgress ? "bg-green-500 border-green-700" : "bg-muted border-border"
                        )}
                        title={`Day ${i + 1}`}
                    >
                      {i < streakProgress && <Icon name="Check" className="h-3 w-3 text-white"/>}
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

    // Load active bet and update daily progress on mount
    useEffect(() => {
        if (!user) return;

        const betKey = getStorageKey(user.uid);
        
        try {
            const savedBetJson = localStorage.getItem(betKey);
            if (savedBetJson) {
                const betData: BetData = JSON.parse(savedBetJson);
                const today = new Date();
                const todayStr = getUtcDateString(today);

                // --- Check for streak break ---
                if (betData.progress.length > 0) {
                    const lastProgressDate = new Date(betData.progress[betData.progress.length - 1]);
                    const daysSinceLastProgress = getDaysBetween(lastProgressDate, today);
                    
                    if (daysSinceLastProgress > 1) {
                        // STREAK BROKEN → Lose bet
                        toast({ 
                            title: "Bet Lost!", 
                            description: `You missed a day and lost your ${betData.credits} credit bet.`, 
                            variant: 'destructive' 
                        });
                        localStorage.removeItem(betKey);
                        setActiveBet(null);
                        return;
                    }
                }

                // --- Check for completion or expiration ---
                const startDate = new Date(betData.startDate);
                const endDate = new Date(startDate);
                endDate.setUTCDate(startDate.getUTCDate() + betData.days);
                
                const todayUtc = new Date();
                todayUtc.setUTCHours(0, 0, 0, 0);

                if (todayUtc >= endDate) {
                    if (betData.progress.length >= betData.days) {
                        toast({ 
                            title: "Bet Won!", 
                            description: `You completed your streak and got back ${betData.credits} credits!` 
                        });
                        // --- REAL CREDIT REFUND ---
                        const userDocRef = doc(db, 'users', user.uid);
                        updateDoc(userDocRef, {
                            credits: increment(betData.credits)
                        }).then(reloadUser).catch(err => {
                            console.error("Failed to refund credits:", err);
                        });
                    }
                    localStorage.removeItem(betKey);
                    setActiveBet(null);
                    return;
                }

                // --- Daily Progress Tracking (UTC) ---
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
    }, [user, toast, reloadUser]);

    const handleBet = async (credits: number, days: number) => {
        if (!user) return;
        if (isLoading) return;
        
        if (credits > (user.credits || 0)) {
            toast({ title: "Not enough credits", variant: "destructive" });
            return;
        }
        
        setIsLoading(true);
        
        const betData: BetData = { 
            credits, 
            days, 
            startDate: new Date().toISOString(), 
            progress: [getUtcDateString(new Date())] // Start streak today
        };
        
        const betKey = getStorageKey(user.uid);
        
        try {
            // --- ATOMIC FIREBASE TRANSACTION ---
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
            
            // Only save to localStorage AFTER successful transaction
            localStorage.setItem(betKey, JSON.stringify(betData));
            setActiveBet(betData);
            await reloadUser();

            toast({ 
                title: "Bet placed!", 
                description: `You bet ${credits} credits for a ${days}-day streak.` 
            });

        } catch (error: any) {
            console.error("Error placing bet:", error);
            
            const errorMessage = error.message === 'Insufficient credits' 
                ? "Not enough credits" 
                : "Could not place your bet. Please try again.";
            
            toast({ 
                title: "Error", 
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
