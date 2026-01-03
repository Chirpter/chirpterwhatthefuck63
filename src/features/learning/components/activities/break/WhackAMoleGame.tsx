
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { Hole, Mole } from './CoffeeMolesDesign';

const GAME_DURATION = 30;
const TOTAL_MOLES = 8;
const MAX_ACTIVE_MOLES = 3;
const MOLE_SPAWN_INTERVAL = 300;

// ✅ NEW: Sound effect for whacking a mole
const playWhackSound = () => {
    try {
        // Simple, free pop sound from a reliable source
        const audio = new Audio('https://cdn.pixabay.com/audio/2021/08/04/audio_c6cc1ee972.mp3');
        audio.volume = 0.5; // Adjust volume to not be too loud
        audio.play().catch(e => console.error("Audio playback failed:", e));
    } catch (error) {
        console.error("Could not play sound:", error);
    }
};


export const MoleGameIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <div className="relative w-full h-full">
        <Hole className="w-full h-full absolute top-0 left-0" />
        <Mole className="w-full h-full absolute top-0 left-0" />
    </div>
);

// 🎨 LIQUID SPLASH EFFECT - Satisfying blob animation
const LiquidSplashEffect = () => {
  // ✅ NEW: Brown color palette matching the mole
  const colors = ['#543a21', '#8e6338', '#a17a50', '#b9926a'];
  
  return (
    <>
      {/* Main impact blob */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0 }}
      >
        <motion.div
          className="w-16 h-16 rounded-full"
          style={{
            background: `radial-gradient(circle, ${colors[2]} 0%, ${colors[1]} 50%, ${colors[0]} 100%)`,
          }}
          initial={{ scale: 0, opacity: 1 }}
          animate={{ 
            scale: [0, 1.5, 1.8, 0],
            opacity: [1, 0.8, 0.6, 0],
          }}
          transition={{ 
            duration: 0.6, 
            ease: [0.34, 1.56, 0.64, 1] // Bouncy ease
          }}
        />
      </motion.div>

      {/* Liquid droplets splashing outward */}
      {[...Array(12)].map((_, i) => {
        const angle = (i * Math.PI * 2) / 12;
        const distance = 40 + Math.random() * 20;
        const size = 8 + Math.random() * 8;
        
        return (
          <motion.div
            key={`droplet-${i}`}
            className="absolute rounded-full"
            style={{
              width: size,
              height: size,
              left: '50%',
              top: '50%',
              backgroundColor: colors[i % colors.length],
              filter: 'blur(1px)',
            }}
            initial={{ 
              x: 0, 
              y: 0, 
              scale: 1,
              opacity: 1 
            }}
            animate={{
              x: Math.cos(angle) * distance,
              y: Math.sin(angle) * distance,
              scale: [1, 1.2, 0],
              opacity: [1, 0.8, 0],
            }}
            transition={{
              duration: 0.5 + Math.random() * 0.2,
              ease: "easeOut",
            }}
          />
        );
      })}

      {/* Secondary smaller splash ring */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0 }}
      >
        {[...Array(8)].map((_, i) => {
          const angle = (i * Math.PI * 2) / 8;
          const distance = 25;
          
          return (
            <motion.div
              key={`blob-${i}`}
              className="absolute w-6 h-6 rounded-full"
              style={{
                backgroundColor: colors[i % colors.length],
                filter: 'blur(2px)',
              }}
              initial={{ 
                x: 0, 
                y: 0,
                scale: 0,
                opacity: 1,
              }}
              animate={{
                x: Math.cos(angle) * distance,
                y: Math.sin(angle) * distance,
                scale: [0, 1, 0.5, 0],
                opacity: [1, 0.6, 0],
              }}
              transition={{
                duration: 0.4,
                ease: "easeOut",
                delay: 0.05,
              }}
            />
          );
        })}
      </motion.div>

      {/* Ripple wave effect */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 100 100"
      >
        <motion.circle
          cx="50"
          cy="50"
          r="20"
          fill="none"
          stroke={colors[1]}
          strokeWidth="3"
          opacity="0.6"
          initial={{ scale: 0, opacity: 0.8 }}
          animate={{ scale: 2, opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
        <motion.circle
          cx="50"
          cy="50"
          r="15"
          fill="none"
          stroke={colors[2]}
          strokeWidth="2"
          opacity="0.4"
          initial={{ scale: 0, opacity: 0.6 }}
          animate={{ scale: 2.5, opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
        />
      </svg>
    </>
  );
};


export default function WhackAMoleGame() {
    const { t } = useTranslation('learningPage');
    
    const [activeMoles, setActiveMoles] = useState<number[]>([]);
    const [score, setScore] = useState(0);
    const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
    const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameOver'>('idle');
    const [whackedMole, setWhackedMole] = useState<number | null>(null);

    const spawnMole = useCallback(() => {
        if (gameState !== 'playing') return;
        
        setActiveMoles(prev => {
            if (prev.length >= MAX_ACTIVE_MOLES) {
                const randomIndex = Math.floor(Math.random() * prev.length);
                return prev.filter((_, i) => i !== randomIndex);
            }
            
            const randomHole = Math.floor(Math.random() * TOTAL_MOLES);
            
            if (prev.includes(randomHole)) return prev;
            
            return [...prev, randomHole];
        });
    }, [gameState]);

    useEffect(() => {
        if (gameState !== 'playing') return;

        const timerInterval = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    setGameState('gameOver');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timerInterval);
    }, [gameState]);

    useEffect(() => {
        if (gameState !== 'playing') return;

        const moleInterval = setInterval(spawnMole, MOLE_SPAWN_INTERVAL);

        return () => clearInterval(moleInterval);
    }, [gameState, spawnMole]);
    
    const startGame = () => {
        setScore(0);
        setTimeLeft(GAME_DURATION);
        setGameState('playing');
        setActiveMoles([]);
        setWhackedMole(null);
    };

    const whackMole = useCallback((index: number) => {
        if (!activeMoles.includes(index)) return;
        
        playWhackSound(); // ✅ Play sound on successful whack
        setScore(prev => prev + 1);
        setActiveMoles(prev => prev.filter(h => h !== index));
        
        setWhackedMole(index);
        setTimeout(() => setWhackedMole(null), 800);
    }, [activeMoles]);

    const renderContent = () => {
      switch (gameState) {
        case 'idle':
          return (
            <div className="flex flex-col items-center justify-center text-center h-full">
                <p className="text-sm text-muted-foreground mb-4">{t('break.description')}</p>
                <Button onClick={startGame}>{t('break.startButton')}</Button>
            </div>
          );
        case 'gameOver':
          return (
            <div className="flex flex-col items-center justify-center text-center h-full">
                <h3 className="text-xl font-bold font-headline">{t('break.gameOver')}</h3>
                <p className="text-3xl font-bold my-2">{score}</p>
                <p className="text-muted-foreground">{t('break.score')}</p>
                <Button onClick={startGame} className="mt-4">{t('break.playAgain')}</Button>
            </div>
          );
        case 'playing':
          return (
            <div className="w-full flex items-center justify-center h-full gap-2">
                <div className="flex flex-col items-center justify-center w-1/5 text-center">
                    <div className="text-xs font-bold">{t('break.score')}</div>
                    <div className="text-2xl font-bold">{score}</div>
                    <div className="text-xs font-bold mt-2">{t('break.time')}</div>
                    <div className="text-2xl font-bold">{timeLeft}</div>
                </div>
                <div className="w-4/5 grid grid-cols-4 gap-1 h-full">
                    {Array.from({ length: TOTAL_MOLES }).map((_, index) => {
                        const isUp = activeMoles.includes(index);
                        return (
                            <div 
                                key={index} 
                                className="relative w-full flex items-center justify-center aspect-square cursor-pointer select-none"
                                onClick={() => whackMole(index)}
                            >
                                <Hole className="w-full h-full absolute top-0 left-0 pointer-events-none" />
                                
                                <AnimatePresence>
                                {isUp && (
                                    <motion.div
                                        initial={{ y: '50%', scale: 0.8, opacity: 0 }}
                                        animate={{ y: '0%', scale: 1, opacity: 1 }}
                                        exit={{ y: '50%', scale: 0.8, opacity: 0 }}
                                        transition={{
                                            type: "spring",
                                            stiffness: 400,
                                            damping: 15,
                                            mass: 0.5
                                        }}
                                        className="absolute inset-0 flex items-end justify-center pointer-events-none"
                                    >
                                        <Mole className="w-full h-full" />
                                    </motion.div>
                                )}
                                </AnimatePresence>
                                
                                {/* ✅ MOVED: Effect is now rendered on top */}
                                <AnimatePresence>
                                    {whackedMole === index && (
                                        <div className="absolute inset-0 z-10 pointer-events-none">
                                            <LiquidSplashEffect key={`splash-${index}`} />
                                        </div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    })}
                </div>
            </div>
          );
      }
    }

    return (
        <div className="w-full h-full flex flex-col items-center justify-center">
            {renderContent()}
        </div>
    );
}

    