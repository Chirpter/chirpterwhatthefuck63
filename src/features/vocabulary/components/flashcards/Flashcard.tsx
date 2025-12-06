
"use client";

import React, { useState, useEffect } from 'react';
import type { VocabularyItem } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

const variants = {
  enter: (direction: number) => {
    return {
      x: direction > 0 ? 500 : -500,
      opacity: 0,
      scale: 0.8,
    };
  },
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (direction: number) => {
    return {
      zIndex: 0,
      x: direction < 0 ? -1000 : 1000,
      opacity: 0,
      scale: 0.5,
      transition: {
        duration: 0.4
      }
    };
  },
};


interface FlashcardProps {
    item: VocabularyItem;
    onSwipe: (direction: number) => void;
    onTest: (isCorrect: boolean) => void;
    isTopCard: boolean;
    onExit?: () => void;
}

const normalizeTerm = (str: string) => {
    if (!str) return '';
    return str.replace(/\s*\([^)]+\)/g, '').trim().toLowerCase();
};


export const Flashcard: React.FC<FlashcardProps> = ({ item, onSwipe, onTest, isTopCard, onExit }) => {
    const { t } = useTranslation('vocabularyPage');
    const [isFlipped, setIsFlipped] = useState(false);
    const [testInput, setTestInput] = useState('');
    const [wasTested, setWasTested] = useState(false);
    const [isLongTermTest, setIsLongTermTest] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [direction, setDirection] = useState(0);

    useEffect(() => {
        const isLongTerm = item.srsState === 'long-term';
        setIsFlipped(isLongTerm);
        setIsLongTermTest(isLongTerm);
        setWasTested(false);
        setTestInput('');
    }, [item]);
    
    const handleFlip = () => {
        if (isLongTermTest) return;
        setIsFlipped(f => !f);
    };
    
    const handleDragEnd = (e: MouseEvent | TouchEvent | PointerEvent, { offset, velocity }: { offset: { x: number; y: number; }; velocity: { x: number; y: number; }; }) => {
        e.stopPropagation();
        setIsDragging(false);
        if (isLongTermTest) return;

        const swipePower = Math.abs(offset.x) * velocity.x;
        
        if (swipePower < -10000) {
            setDirection(-1);
            onSwipe(-1);
        } else if (swipePower > 10000) {
            setDirection(1);
            onSwipe(1);
        }
    };

    const handleTestSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!testInput.trim()) return;

        const isCorrect = normalizeTerm(testInput) === normalizeTerm(item.term);
        setWasTested(true);

        setTimeout(() => {
            onTest(isCorrect);
        }, 1500);
    };
    
    const FlashcardSide = ({ isFront }: { isFront: boolean }) => {
        let content;

        if (isLongTermTest) {
            if (isFront && !wasTested) {
                content = (
                    <form onSubmit={handleTestSubmit} className="absolute bottom-6 w-full px-6 space-y-2">
                        <Input
                            type="text"
                            placeholder={t('longTermFlashcard.inputPlaceholder')}
                            value={testInput}
                            onChange={(e) => setTestInput(e.target.value)}
                            className="text-center text-lg h-12"
                            disabled={wasTested}
                        />
                        <Button type="submit" className="w-full" disabled={wasTested}>
                            {t('longTermFlashcard.checkButton')}
                        </Button>
                    </form>
                );
            } else if (wasTested) {
                const isCorrect = normalizeTerm(testInput) === normalizeTerm(item.term);
                content = (
                     <div className={cn(
                        "w-full h-full flex flex-col items-center justify-center p-6 text-center border-2 shadow-2xl",
                        isCorrect ? "bg-green-100 dark:bg-green-900/30" : "bg-destructive/10"
                    )}>
                        <Icon name={isCorrect ? "Check" : "X"} className={cn("h-16 w-16 mb-4", isCorrect ? "text-green-600" : "text-destructive")} />
                        <h2 className="text-3xl md:text-4xl font-headline font-bold">{item.term}</h2>
                        <p className="text-lg text-muted-foreground">{isCorrect ? t('longTermFlashcard.correct') : t('longTermFlashcard.incorrect')}</p>
                    </div>
                );
            } else {
                 content = (
                    <>
                        <p className="text-sm text-muted-foreground">{t('longTermFlashcard.meaningLabel')}</p>
                        <h3 className="text-3xl md:text-4xl font-headline font-bold text-primary">
                            {item.meaning}
                        </h3>
                        {item.partOfSpeech && (
                            <p className="text-lg text-muted-foreground italic">({item.partOfSpeech})</p>
                        )}
                    </>
                );
            }
        } else { // Standard flip card
            if (isFront) {
                 content = (
                    <>
                        <h2 className="text-3xl md:text-4xl font-headline font-bold">{item.term}</h2>
                        {item.example && (
                            <p className="text-md md:text-lg text-muted-foreground italic">
                                &ldquo;{item.example}&rdquo;
                            </p>
                        )}
                        <div className="absolute bottom-4 right-4 text-xs text-muted-foreground/50 flex items-center gap-1">
                            <Icon name="RotateCw" className="h-3 w-3" /> {t('flipHint')}
                        </div>
                    </>
                );
            } else {
                 content = (
                     <>
                        <h3 className="text-3xl md:text-4xl font-headline font-bold text-primary-foreground">
                            {item.meaning}
                        </h3>
                        {item.partOfSpeech && (
                            <p className="text-lg text-primary-foreground/80 italic">({item.partOfSpeech})</p>
                        )}
                        <div className="absolute bottom-4 right-4 text-xs text-primary-foreground/70 flex items-center gap-1">
                            <Icon name="RotateCw" className="h-3 w-3" /> {t('flipHint')}
                        </div>
                    </>
                 );
            }
        }

        return (
            <CardContent className="w-full h-full flex flex-col items-center justify-center gap-4 p-6 relative">
                {content}
            </CardContent>
        );
    };

    const cardBaseClasses = "w-full h-full flex flex-col items-center justify-center p-6 text-center border-2";
    const cardDynamicClasses = isTopCard && !isDragging ? "shadow-2xl" : "";

    return (
        <motion.div
            key={item.id}
            className="absolute w-full h-full"
            style={{ willChange: isDragging ? 'transform' : 'auto' }}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
                x: { type: "spring", stiffness: 400, damping: 30, mass: 0.8 },
                opacity: { duration: 0.2 }
            }}
            drag={isTopCard && !isLongTermTest ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.3}
            onDragStart={() => setIsDragging(true)}
            onDragEnd={handleDragEnd}
            whileHover={{ scale: isTopCard && !isDragging ? 1.02 : 1, transition: { duration: 0.2 } }}
            whileTap={{ scale: isTopCard && !isDragging ? 0.98 : 1 }}
            onClick={(e) => {
              e.stopPropagation();
              handleFlip();
            }}
        >
            <div className="w-full h-full" style={{ perspective: 1000, transformStyle: 'preserve-3d' }}>
                 <motion.div
                    className="w-full h-full absolute"
                    style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
                    animate={{ rotateY: isFlipped ? 180 : 0 }}
                    transition={{ duration: 0.6, ease: "easeInOut" }}
                >
                    <Card className={cn(cardBaseClasses, cardDynamicClasses, 'bg-card')}>
                        <FlashcardSide isFront={true} />
                    </Card>
                </motion.div>
                <motion.div
                    className="w-full h-full absolute"
                    style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                    initial={{ rotateY: -180 }}
                    animate={{ rotateY: isFlipped ? 0 : -180 }}
                    transition={{ duration: 0.6, ease: "easeInOut" }}
                >
                    <Card className={cn(cardBaseClasses, cardDynamicClasses, 'bg-primary')}>
                         <FlashcardSide isFront={false} />
                    </Card>
                </motion.div>
            </div>
        </motion.div>
    );
};
