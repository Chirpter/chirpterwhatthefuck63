
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

// --- Types ---
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

// Storage keys
const getStorageKey = (uid: string) => `chirpter_hatch_${uid}`;
const COLLECTION_KEY = 'chirpter_hatched_collection';

// All 9 possible birds that can hatch
const birdComponents = [Chirp, Flamingo, Penguin, Jaybird, Hummingbird, Owl, Parrot, Swan, Peacock];

// --- ENHANCED VISUAL EFFECTS ---
const RottenSmellEffect = () => (
  <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
    {/* Multiple smoke streams - larger and more visible */}
    <motion.path
      d="M 25 35 Q 30 10, 40 25 T 55 20"
      stroke="#8B4513"
      strokeWidth="3"
      fill="none"
      strokeLinecap="round"
      initial={{ y: 0, opacity: 0 }}
      animate={{ y: -25, opacity: [0, 0.8, 0] }}
      transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 0.1 }}
    />
    <motion.path
      d="M 40 40 Q 45 15, 55 30 T 70 25"
      stroke="#654321"
      strokeWidth="3"
      fill="none"
      strokeLinecap="round"
      initial={{ y: 0, opacity: 0 }}
      animate={{ y: -30, opacity: [0, 0.7, 0] }}
      transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut", delay: 0.4 }}
    />
    <motion.path
      d="M 55 45 Q 60 20, 70 35 T 85 30"
      stroke="#5D4037"
      strokeWidth="3"
      fill="none"
      strokeLinecap="round"
      initial={{ y: 0, opacity: 0 }}
      animate={{ y: -35, opacity: [0, 0.6, 0] }}
      transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut", delay: 0.7 }}
    />
  </motion.g>
);

const HolyLightEffect = () => (
  <motion.g initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
    {/* Glowing circles */}
    <motion.circle
      cx="50"
      cy="50"
      r="45"
      stroke="url(#goldGradient)"
      strokeWidth="2"
      fill="none"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: [0, 0.6, 0] }}
      transition={{ duration: 1.5, repeat: Infinity }}
    />
    <motion.circle
      cx="50"
      cy="50"
      r="35"
      stroke="url(#goldGradient)"
      strokeWidth="1.5"
      fill="none"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: [0, 0.4, 0] }}
      transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
    />
    
    {/* Light rays */}
    {[...Array(8)].map((_, i) => (
      <motion.line
        key={i}
        x1="50"
        y1="50"
        x2={50 + 40 * Math.cos((i * Math.PI) / 4)}
        y2={50 + 40 * Math.sin((i * Math.PI) / 4)}
        stroke="url(#goldGradient)"
        strokeWidth="2"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: [0, 0.8, 0] }}
        transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.1 }}
      />
    ))}
    
    <defs>
      <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFD700" />
        <stop offset="100%" stopColor="#FFA500" />
      </linearGradient>
    </defs>
  </motion.g>
);

const ParticleExplosion = () => (
  <motion.g>
    {[...Array(12)].map((_, i) => (
      <motion.circle
        key={i}
        cx="50"
        cy="50"
        r="2"
        fill="#FFD700"
        initial={{ scale: 0, opacity: 1 }}
        animate={{
          scale: 1,
          opacity: 0,
          x: 30 * Math.cos((i * Math.PI) / 6),
          y: 30 * Math.sin((i * Math.PI) / 6),
        }}
        transition={{
          duration: 1.2,
          ease: "easeOut",
          delay: i * 0.05,
        }}
      />
    ))}
  </motion.g>
);

// --- HATCHING EGG VISUAL COMPONENT ---
const HatchingEgg: React.FC<HatchingEggVisualProps> = ({ 
  hatchState, 
  isFailed, 
  isComplete, 
  hatchedBird: HatchedBirdComponent 
}) => {
  const rotation = hatchState * 5;

  if (isComplete && HatchedBirdComponent) {
    return (
      <div className="relative">
        {/* Holy Light Background */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1.5, opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          <svg viewBox="0 0 100 100" className="w-24 h-24">
            <HolyLightEffect />
          </svg>
        </motion.div>
        
        {/* Particle Explosion */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <svg viewBox="0 0 100 100" className="w-20 h-20">
            <ParticleExplosion />
          </svg>
        </motion.div>

        {/* Hatched Bird */}
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
        {/* Dark Brown Egg with sepia filter */}
        <Egg 
          className="h-20 w-20" 
          style={{
            filter: "sepia(1) hue-rotate(-30deg) saturate(1.8) brightness(0.6) contrast(1.2)"
          }}
        />
        
        {/* Enhanced Smell Effect */}
        <div className="absolute inset-0 flex items-center justify-center">
          <svg viewBox="0 0 100 100" className="w-24 h-24 overflow-visible">
            <RottenSmellEffect />
          </svg>
        </div>
      </motion.div>
    );
  }
  
  // Show Egg for first half (0-50%), CrackedEgg for second half (50-100%)
  const EggComponent = hatchState >= 2 ? CrackedEgg : Egg;

  return (
    <motion.div
      animate={{ rotate: [0, rotation, -rotation, 0] }}
      transition={{ duration: 5, ease: 'easeInOut', repeat: Infinity }}
    >
      <EggComponent className="h-20 w-20 text-primary" />
    </motion.div>
  );
};

// --- HATCHING TIMER ---
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

// --- COLLECTION VIEW ---
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

    // Map unlocked bird names to their components
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

// --- MAIN COMPONENT ---
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

  // Load saved hatch state
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
          // Already hatched while user was away
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

  // Update hatch phase
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
  
  // Auto cleanup failed state
  useEffect(() => {
    if (!isFailed || !user) return;
    
    const timer = setTimeout(() => {
      localStorage.removeItem(getStorageKey(user.uid));
      setHatchingState(null);
      setIsFailed(false);
    }, 4000);
    
    return () => clearTimeout(timer);
  }, [isFailed, user]);

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
      <div className="flex flex-col gap-4 w-full items-center">
        <div className="font-semibold text-center">
          <span className="text-2xl text-primary">{duration}</span>
          <span className="text-sm text-muted-foreground ml-1">{t('minutes') || 'minutes'}</span>
        </div>
        <Slider
          value={[duration]}
          onValueChange={(value) => setDuration(value[0])}
          min={10}
          max={120}
          step={5}
          className="w-full"
        />
        <Button onClick={handleStartHatching} className="w-full mt-2">
          {t('focus.startButton') || 'Start Focus Session'}
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 items-center justify-items-center gap-4">
      <div className="w-full relative">
        {leftContent}
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute -bottom-4 right-0 h-6 w-6 text-muted-foreground" 
          onClick={()={() => setShowCollection(s => !s)}}
        >
          <Icon name={showCollection ? 'ChevronLeft' : 'ChevronRight'} className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="flex flex-col items-center">
        <HatchingEgg 
            hatchState={currentHatchPhase} 
            isFailed={isFailed} 
            isComplete={isComplete}
            hatchedBird={hatchedBirdComponent}
        />
      </div>

      <div className="w-full max-w-xs">
        {rightContent}
      </div>
    </div>
  );
}

    