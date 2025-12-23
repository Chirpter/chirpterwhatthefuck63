// src/features/learning/components/activities/focus/FocusHatching.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { useUser } from '@/contexts/user-context';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/useToast';
import { motion, AnimatePresence } from 'framer-motion';
import { Egg, CrackedEgg, Chirp, Flamingo, Penguin, Jaybird, Hummingbird, Owl, Parrot, Swan, Peacock } from './EggDesign';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

interface HatchData {
  startTime: number;
  duration: number;
}

interface HatchingEggVisualProps {
  hatchState: number;
  isFailed: boolean;
  isComplete: boolean;
  hatchedBird: React.FC<any> | null;
}

const getStorageKey = (uid: string) => `chirpter_hatch_${uid}`;
const COLLECTION_KEY = 'chirpter_hatched_collection';

const birdComponents = [Chirp, Flamingo, Penguin, Jaybird, Hummingbird, Owl, Parrot, Swan, Peacock];

// ===== IMPROVED EGG EFFECTS - Clear but not distracting =====

const SubtleRottenEffect = () => (
  <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
    {/* Smaller, less intrusive smoke */}
    <motion.path
      d="M 35 40 Q 38 25, 42 35"
      stroke="#5D4037"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
      initial={{ y: 0, opacity: 0 }}
      animate={{ y: -20, opacity: [0, 0.6, 0] }}
      transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
    />
    <motion.path
      d="M 50 42 Q 53 27, 57 37"
      stroke="#5D4037"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
      initial={{ y: 0, opacity: 0 }}
      animate={{ y: -22, opacity: [0, 0.5, 0] }}
      transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut", delay: 0.3 }}
    />
  </motion.g>
);

const SubtleSuccessEffect = () => (
  <motion.g initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
    {/* Gentle golden glow */}
    <motion.circle
      cx="50"
      cy="50"
      r="40"
      stroke="#FFD700"
      strokeWidth="1.5"
      fill="none"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1.2, opacity: [0, 0.4, 0] }}
      transition={{ duration: 1.5, repeat: Infinity }}
    />
    
    {/* Sparkles - smaller and fewer */}
    {[...Array(6)].map((_, i) => (
      <motion.circle
        key={i}
        cx={50 + 35 * Math.cos((i * Math.PI) / 3)}
        cy={50 + 35 * Math.sin((i * Math.PI) / 3)}
        r="1.5"
        fill="#FFD700"
        initial={{ scale: 0, opacity: 1 }}
        animate={{ scale: 1, opacity: 0 }}
        transition={{
          duration: 1,
          ease: "easeOut",
          delay: i * 0.15,
          repeat: Infinity,
          repeatDelay: 0.5
        }}
      />
    ))}
  </motion.g>
);

// Improved Egg Visual - clearer progression
const HatchingEgg: React.FC<HatchingEggVisualProps> = ({ 
  hatchState, 
  isFailed, 
  isComplete, 
  hatchedBird: HatchedBirdComponent 
}) => {
  const rotation = hatchState * 3; // Reduced rotation for subtlety

  if (isComplete && HatchedBirdComponent) {
    return (
      <div className="relative">
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
        >
          <svg viewBox="0 0 100 100" className="w-24 h-24">
            <SubtleSuccessEffect />
          </svg>
        </motion.div>

        <motion.div
          initial={{ scale: 0, y: 20, rotate: -180 }}
          animate={{ scale: 1, y: 0, rotate: 0 }}
          transition={{ 
            duration: 0.8, 
            type: 'spring',
            stiffness: 120,
            delay: 0.2
          }}
        >
          <HatchedBirdComponent className="h-20 w-20 text-primary relative z-10" />
        </motion.div>
      </div>
    );
  }

  if (isFailed) {
    return (
      <motion.div 
        className="relative"
        initial={{ scale: 0.8, y: 10, opacity: 0 }} 
        animate={{ scale: 1, y: 0, opacity: 1 }} 
        transition={{ duration: 0.5 }}
      >
        <Egg 
          className="h-20 w-20" 
          style={{
            filter: "sepia(1) hue-rotate(-30deg) saturate(1.8) brightness(0.6)"
          }}
        />
        
        <div className="absolute inset-0 flex items-center justify-center">
          <svg viewBox="0 0 100 100" className="w-20 h-20 overflow-visible">
            <SubtleRottenEffect />
          </svg>
        </div>
      </motion.div>
    );
  }
  
  const EggComponent = hatchState >= 2 ? CrackedEgg : Egg;

  return (
    <motion.div
      animate={{ rotate: [0, rotation, -rotation, 0] }}
      transition={{ duration: 4, ease: 'easeInOut', repeat: Infinity }}
    >
      <EggComponent className="h-20 w-20 text-primary" />
    </motion.div>
  );
};

const HatchingTimer = ({ 
  endTime, 
  onCancel, 
  isFailed,
  isComplete,
  onStartNew,
}: { 
  endTime: number; 
  onCancel: () => void; 
  isFailed: boolean; 
  isComplete: boolean;
  onStartNew: () => void;
}) => {
  const { t } = useTranslation('learningPage');
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    if (isFailed || isComplete) return;

    const updateTimer = () => {
      const now = Date.now();
      const diff = endTime - now;

      if (diff <= 0) {
        setTimeLeft(t('focus.hatched') || 'Hatched!');
        return;
      }

      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);
      setTimeLeft(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [endTime, t, isFailed, isComplete]);

  if (isFailed) {
    return (
      <div className="flex flex-col items-center justify-center text-center gap-3">
        <h3 className="text-lg font-bold text-destructive">{t('focus.failedTitle') || 'Failed!'}</h3>
        <Button onClick={onStartNew} variant="outline" size="sm">
          {t('focus.tryAgain') || 'Try Again'}
        </Button>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="flex flex-col items-center justify-center text-center gap-3">
        <h3 className="text-lg font-bold text-green-600">{t('focus.hatched') || 'Hatched!'}</h3>
        <Button onClick={onStartNew} className="bg-primary hover:bg-primary/90">
          {t('focus.startNew') || 'Hatch New Egg'}
        </Button>
      </div>
    );
  }

  return (
    <div className="text-center flex flex-col items-center gap-2">
      <p className="text-3xl font-bold font-mono">{timeLeft}</p>
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={onCancel} 
        className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        <Icon name="X" className="h-4 w-4" />
      </Button>
    </div>
  );
};

const CollectionView = ({ refreshTrigger }: { refreshTrigger: number }) => {
    const { t } = useTranslation('learningPage');
    const [unlockedBirds, setUnlockedBirds] = useState<string[]>([]);

    useEffect(() => {
        try {
            const saved = localStorage.getItem(COLLECTION_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    setUnlockedBirds(parsed);
                }
            }
        } catch (error) {
            console.error('Failed to load collection:', error);
            setUnlockedBirds([]);
        }
    }, [refreshTrigger]);

    const birdComponentMap: { [key: string]: React.FC<any> } = {
        'Chirp': Chirp,
        'Flamingo': Flamingo,
        'Penguin': Penguin,
        'Jaybird': Jaybird,
        'Hummingbird': Hummingbird,
        'Owl': Owl,
        'Parrot': Parrot,
        'Swan': Swan,
        'Peacock': Peacock,
    };

    return (
        <div className="w-full text-center">
            <div className="grid grid-cols-3 gap-2">
                {Object.entries(birdComponentMap).map(([birdName, BirdComponent]) => {
                    const isUnlocked = unlockedBirds.includes(birdName);
                    
                    return (
                        <Card key={birdName} className={cn(
                            "aspect-square flex flex-col items-center justify-center p-2 transition-all duration-300",
                            isUnlocked 
                                ? "bg-card border-primary" 
                                : "bg-muted/30 border-muted"
                        )}>
                            <div className={cn(
                                "transition-all duration-500",
                                isUnlocked ? "scale-110" : "scale-90 opacity-70"
                            )}>
                                {isUnlocked ? (
                                    <BirdComponent className="h-8 w-8 text-primary" />
                                ) : (
                                    <Egg className="h-8 w-8 text-muted-foreground/40" />
                                )}
                            </div>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
};

export default function FocusHatching() {
  const { t } = useTranslation(['learningPage', 'common', 'toast']);
  const { user } = useUser();
  const { toast } = useToast();
  const [showCollection, setShowCollection] = useState(false);
  const [hatchingState, setHatchingState] = useState<HatchData | null>(null);
  const [currentHatchPhase, setCurrentHatchPhase] = useState(1);
  const [duration, setDuration] = useState(10);
  const [isFailed, setIsFailed] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [hatchedBirdComponent, setHatchedBirdComponent] = useState<React.FC<any> | null>(null);
  const [collectionRefresh, setCollectionRefresh] = useState(0);

  const unlockBird = useCallback((birdComponent: React.FC<any>) => {
    try {
      const birdName = (birdComponent as any).displayName;
      
      if (!birdName) {
        console.warn('Bird component missing displayName');
        return;
      }

      const saved = localStorage.getItem(COLLECTION_KEY);
      const collection = saved ? JSON.parse(saved) : [];
      
      if (!collection.includes(birdName)) {
        const updated = [...collection, birdName];
        localStorage.setItem(COLLECTION_KEY, JSON.stringify(updated));
        setCollectionRefresh(prev => prev + 1);
      }
    } catch (error) {
      console.error('Failed to save to collection:', error);
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    const storageKey = getStorageKey(user.uid);

    try {
      const savedHatch = localStorage.getItem(storageKey);
      if (savedHatch) {
        const hatchData: HatchData = JSON.parse(savedHatch);
        if (Date.now() < hatchData.startTime + hatchData.duration) {
          setHatchingState(hatchData);
          setIsComplete(false);
        } else {
          localStorage.removeItem(storageKey);
          const randomBirdIndex = Math.floor(Math.random() * birdComponents.length);
          const HatchedBird = birdComponents[randomBirdIndex];
          unlockBird(HatchedBird);
          setHatchedBirdComponent(() => HatchedBird);
          setIsComplete(true);
        }
      }
    } catch (error) {
      console.error('Error loading hatch data:', error);
      localStorage.removeItem(storageKey);
    }
  }, [user, unlockBird]);

  useEffect(() => {
    if (!hatchingState || isComplete) {
      setCurrentHatchPhase(1);
      return;
    }

    const interval = setInterval(() => {
      const elapsed = Date.now() - hatchingState.startTime;
      const progress = elapsed / hatchingState.duration;

      const phase = progress < 0.5 ? 1 : 2;
      setCurrentHatchPhase(phase);

      if (progress >= 1) {
        clearInterval(interval);
        toast({
          title: t('focus.success') || 'Success!',
          description: t('focus.hatchedSuccess') || 'Your egg has hatched!',
        });
        
        if (user) {
          localStorage.removeItem(getStorageKey(user.uid));
        }

        const randomBirdIndex = Math.floor(Math.random() * birdComponents.length);
        const HatchedBird = birdComponents[randomBirdIndex];
        unlockBird(HatchedBird);
        setHatchedBirdComponent(() => HatchedBird);
        
        setIsComplete(true);
        setHatchingState(null);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [hatchingState, isComplete, t, toast, user, unlockBird]);

  const handleStartHatching = () => {
    if (!user) return;
    
    const durationMs = duration * 60 * 1000;
    const hatchData: HatchData = { 
      startTime: Date.now(), 
      duration: durationMs 
    };
    
    const storageKey = getStorageKey(user.uid);
    localStorage.setItem(storageKey, JSON.stringify(hatchData));
    setHatchingState(hatchData);
    setIsFailed(false);
    setIsComplete(false);
    setHatchedBirdComponent(null);
    setCurrentHatchPhase(1);
    
    toast({
      title: t('focus.started') || 'Focus session started!',
      description: t('focus.startedDescription') || 'Your egg will hatch when the timer ends.',
    });
  };

  const handleCancelHatching = () => {
    if (!user) return;
    setIsFailed(true);
    
    toast({
      title: t('focus.cancelled') || 'Focus session cancelled',
      description: t('focus.cancelledDescription') || 'Your egg hatching has been interrupted.',
      variant: 'destructive',
    });
  };

  const handleStartNewSession = () => {
    if (user) {
      localStorage.removeItem(getStorageKey(user.uid));
    }
    setHatchingState(null);
    setIsFailed(false);
    setIsComplete(false);
    setHatchedBirdComponent(null);
    setCurrentHatchPhase(1);
  };
  
  useEffect(() => {
    if (!isFailed || !user) return;
    
    const timer = setTimeout(() => {
      localStorage.removeItem(getStorageKey(user.uid));
      setHatchingState(null);
      setIsFailed(false);
    }, 4000);
    
    return () => clearTimeout(timer);
  }, [isFailed, user]);

  // Improved layout - consistent height
  const leftContent = showCollection ? 
    <CollectionView refreshTrigger={collectionRefresh} /> : 
    <p className="text-sm text-muted-foreground text-center">{t('focus.description') || 'Focus to hatch eggs and grow your collection!'}</p>;

  let rightContent;
  if (hatchingState || isFailed || isComplete) {
    rightContent = (
      <HatchingTimer 
        endTime={(hatchingState?.startTime || 0) + (hatchingState?.duration || 0)} 
        onCancel={handleCancelHatching} 
        isFailed={isFailed}
        isComplete={isComplete}
        onStartNew={handleStartNewSession}
      />
    );
  } else {
    rightContent = (
      <div className="flex flex-col gap-3 w-full items-center">
        <div className="font-semibold text-center">
          <span className="text-2xl text-primary">{duration}</span>
          <span className="text-sm text-muted-foreground ml-1">{t('minutes') || 'min'}</span>
        </div>
        <div className="w-full space-y-1">
          <input
            type="range"
            min={10}
            max={120}
            step={5}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${((duration - 10) / 110) * 100}%, hsl(var(--muted)) ${((duration - 10) / 110) * 100}%, hsl(var(--muted)) 100%)`
            }}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>10</span>
            <span>120</span>
          </div>
        </div>
        <Button onClick={handleStartHatching} className="w-full" size="sm">
          {t('focus.startButton') || 'Start'}
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 items-center justify-items-center gap-4">
      <div className="w-full relative min-h-[120px] flex items-center justify-center">
        {leftContent}
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute -bottom-2 right-0 h-6 w-6 text-muted-foreground" 
          onClick={() => setShowCollection(s => !s)}
        >
          <Icon name={showCollection ? 'ChevronLeft' : 'ChevronRight'} className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="flex flex-col items-center min-h-[120px] justify-center">
        <HatchingEgg 
            hatchState={currentHatchPhase} 
            isFailed={isFailed} 
            isComplete={isComplete}
            hatchedBird={hatchedBirdComponent}
        />
      </div>

      <div className="w-full max-w-xs min-h-[120px] flex items-center justify-center">
        {rightContent}
      </div>
    </div>
  );
}