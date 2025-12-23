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

// Compact slider component
const CompactSlider = ({ 
  value, 
  onChange, 
  min, 
  max, 
  label,
  icon
}: { 
  value: number; 
  onChange: (val: number) => void;
  min: number;
  max: number;
  label: string;
  icon: React.ReactNode;
}) => (
  <div className="w-full space-y-1">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <span className="text-xl font-bold text-primary">{value}</span>
    </div>
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
    <div className="flex justify-between text-xs text-muted-foreground">
      <span>{min}</span>
      <span>{max}</span>
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
        label={t('betCreditsLabel') || 'Credits'}
        icon={<CreditIcon className="h-4 w-4 text-primary" />}
      />

      <CompactSlider
        value={days}
        onChange={setDays}
        min={7}
        max={30}
        label={t('betDaysLabel') || 'Days'}
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
            <p className="text-sm font-semibold">{t('betActiveTitle') || 'Active Streak'}</p>
            
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div 
                    className="h-full bg-green-500 transition-all duration-500 ease-out"
                    style={{ width: `${(streakProgress / betData.days) * 100}%` }}
                />
            </div>

            <div className="flex flex-wrap justify-center gap-1">
                {Array.from({ length: Math.min(betData.days, 15) }).map((_, i) => (
                    <div 
                        key={i} 
                        className={cn(
                            "h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all duration-300 text-xs",
                            i < streakProgress 
                                ? "bg-green-500 border-green-700 shadow-sm text-white" 
                                : "bg-muted border-border"
                        )}
                        title={`Day ${i + 1}`}
                    >
                      {i < streakProgress && '✓'}
                    </div>
                ))}
                {betData.days > 15 && (
                    <div className="text-xs text-muted-foreground w-full mt-1">
                        +{betData.days - 15} more days
                    </div>
                )}
            </div>
            <p className="text-xs text-muted-foreground">
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
                    const updatedProgress = [...betData.progress,