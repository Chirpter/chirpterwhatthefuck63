// src/features/learning/components/activities/discipline/DisciplineBetting.tsx
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { useUser } from '@/contexts/user-context';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import { doc, updateDoc, increment, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PiggyBankIcon } from './PiggyBankIcon';
import { CreditIcon } from '@/components/ui/CreditIcon';
import { motion } from 'framer-motion';

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

const CompactSlider = ({ 
  value, 
  onChange, 
  min, 
  max, 
  icon
}: { 
  value: number; 
  onChange: (val: number) => void;
  min: number;
  max: number;
  icon: React.ReactNode;
}) => (
  <div className="w-full">
    {/* 🎯 BALANCED: Icon + Bar + Number (no extra padding) */}
    <div className="flex items-center gap-3">
      {/* Icon - fixed width */}
      <div className="flex-shrink-0 w-5 flex items-center justify-center">
        {icon}
      </div>
      
      {/* Slider Bar - takes remaining space */}
      <div className="flex-1 min-w-0">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${((value - min) / (max - min)) * 100}%, hsl(var(--muted)) ${((value - min) / (max - min)) * 100}%, hsl(var(--muted)) 100%)`
          }}
        />
      </div>
      
      {/* Number Display - fixed width */}
      <div className="flex-shrink-0 w-10 text-right">
        <span className="text-xl font-bold text-primary tabular-nums">{value}</span>
      </div>
    </div>
  </div>
);

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
    <div className="flex flex-col items-center gap-3 w-full">
      <CompactSlider
        value={credits}
        onChange={setCredits}
        min={1}
        max={50}
        icon={<CreditIcon className="h-4 w-4 text-primary" />}
      />

      <CompactSlider
        value={days}
        onChange={setDays}
        min={7}
        max={30}
        icon={<Icon name="Calendar" className="h-4 w-4 text-primary" />}
      />

      <Button onClick={handleBetClick} className="w-full" size="sm">
        {t('betButton') || 'Place Bet'}
      </Button>
    </div>
  );
};

const StreakTracker = ({ betData }: { betData: BetData }) => {
    const { t } = useTranslation('learningPage');
    const streakProgress = useMemo(() => betData.progress?.length || 0, [betData.progress]);

    return (
        <div className="flex flex-col items-center gap-2 w-full text-center">
            <p className="text-sm font-semibold">{t('betActiveTitle') || 'Active'}</p>
            
            <div className="text-center">
                <div className="text-xl font-bold text-primary">{streakProgress}/{betData.days}</div>
                <div className="text-xs text-muted-foreground">days</div>
            </div>

            <div className="flex flex-wrap justify-center gap-1 max-w-[120px]">
                {Array.from({ length: Math.min(betData.days, 10) }).map((_, i) => (
                    <div 
                        key={i} 
                        className={cn(
                            "h-4 w-4 rounded-full border flex items-center justify-center transition-all duration-300 text-[10px]",
                            i < streakProgress 
                                ? "bg-green-500 border-green-700 text-white" 
                                : "bg-muted border-border"
                        )}
                    >
                      {i < streakProgress && '✓'}
                    </div>
                ))}
                {betData.days > 10 && (
                    <div className="text-xs text-muted-foreground w-full">
                        +{betData.days - 10}
                    </div>
                )}
            </div>
        </div>
    );
};

export default function DisciplineBetting(): JSX.Element {
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
            localStorage.removeItem(getStorageKey(user.uid));
        }
    }, [user, toast, reloadUser, t]);

    const handleBet = async (credits: number, days: number) => {
        if (!user || isLoading) return;
        
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
        <div className="grid grid-cols-3 items-center justify-items-center gap-4">
            <div className="w-full min-h-[120px] flex items-center justify-center">
                <p className="text-sm text-muted-foreground text-center">{t('betDescription')}</p>
            </div>
            
            <div className="flex items-center justify-center min-h-[120px]">
                <motion.div
                    animate={{
                        y: [0, -8, 0, -4, 0],
                        scale: [1, 1.05, 1, 1.02, 1]
                    }}
                    transition={{
                        duration: 2,
                        ease: "easeInOut",
                        repeat: Infinity,
                        repeatDelay: 3
                    }}
                >
                    <PiggyBankIcon className="h-20 w-20 text-primary" />
                </motion.div>
            </div>
            
            <div className="w-full max-w-xs min-h-[120px] flex items-center justify-center">
                {activeBet ? (
                    <StreakTracker betData={activeBet} />
                ) : (
                    <BetInterface onBet={handleBet} />
                )}
            </div>
        </div>
    );
}