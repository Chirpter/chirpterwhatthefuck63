"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { Hole, Mole } from './CoffeeMolesDesign';

const GAME_DURATION = 30; // seconds
const TOTAL_MOLES = 8;
const MAX_ACTIVE_MOLES = 3;
const MOLE_SPAWN_INTERVAL = 300 // ms

export const MoleGameIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <div className="relative w-full h-full">
        <Hole className="w-full h-full absolute top-0 left-0" />
        <Mole className="w-full h-full absolute top-0 left-0" />
    </div>
);

const WhackEffect = () => (
    <motion.svg
        className="absolute inset-0 w-full h-full text-yellow-400 z-20 pointer-events-none"
        viewBox="0 0 100 100"
        initial={{ scale: 0.5, opacity: 1, rotate: 0 }}
        animate={{ scale: 1.5, opacity: 0, rotate: 45 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
    >
        <path
            d="M50 0 L61.8 38.2 L100 38.2 L69.1 61.8 L79.5 100 L50 76.4 L20.5 100 L30.9 61.8 L0 38.2 L38.2 38.2 Z"
            fill="currentColor"
        />
    </motion.svg>
);


export default function WhackAMoleGame() {
    const { t } = useTranslation('learningPage');
    
    // ✅ State đơn giản hơn: Dùng array chứa index của moles đang active
    const [activeMoles, setActiveMoles] = useState<number[]>([]);
    const [score, setScore] = useState(0);
    const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
    const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameOver'>('idle');
    const [whackedMole, setWhackedMole] = useState<number | null>(null);

    // ✅ Spawn mole logic đơn giản hơn
    const spawnMole = useCallback(() => {
        if (gameState !== 'playing') return;
        
        setActiveMoles(prev => {
            // Nếu đã đủ số lượng moles, ẩn một mole ngẫu nhiên
            if (prev.length >= MAX_ACTIVE_MOLES) {
                const randomIndex = Math.floor(Math.random() * prev.length);
                return prev.filter((_, i) => i !== randomIndex);
            }
            
            // Spawn mole mới tại vị trí ngẫu nhiên chưa có mole
            const randomHole = Math.floor(Math.random() * TOTAL_MOLES);
            
            // Skip nếu vị trí đã có mole
            if (prev.includes(randomHole)) return prev;
            
            return [...prev, randomHole];
        });
    }, [gameState]);

    // Game loop for timer
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

    // Game loop for mole spawning
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

    // ✅ Logic whack đơn giản và rõ ràng
    const whackMole = useCallback((index: number) => {
        // KIỂM TRA NGAY ĐẦU: Mole có đang active không?
        if (!activeMoles.includes(index)) return; // Early exit
        
        // Chỉ chạy khi mole ĐANG ACTIVE
        setScore(prev => prev + 1);
        setActiveMoles(prev => prev.filter(h => h !== index));
        
        // Visual feedback
        setWhackedMole(index);
        setTimeout(() => setWhackedMole(null), 300);
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
                                className="relative w-full flex items-center justify-center aspect-square"
                                onClick={() => whackMole(index)}
                            >
                                {whackedMole === index && <WhackEffect />}
                                <Hole className="w-full h-full absolute top-0 left-0" />
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
                                        className="absolute inset-0 flex items-end justify-center cursor-pointer"
                                    >
                                        <Mole className="w-full h-full" />
                                    </motion.div>
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