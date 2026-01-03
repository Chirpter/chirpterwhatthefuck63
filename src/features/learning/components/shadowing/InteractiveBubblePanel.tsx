// src/features/learning/components/shadowing/InteractiveBubblePanel.tsx
"use client";

import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import type { WordTracking } from '@/features/learning/services/smart-error-tracker';

interface InteractiveBubblePanelProps {
  words: WordTracking[];
  onDismiss: (word: string) => void;
  onConfirm: (word: string) => void;
}

const ERROR_COLORS: Record<string, string> = {
  omission: '#eab308',
  substitution: '#ef4444',
  insertion: '#3b82f6',
  morphology: '#ec4899',
  spelling: '#f97316',
};

export const InteractiveBubblePanel: React.FC<InteractiveBubblePanelProps> = ({
  words,
  onDismiss,
  onConfirm,
}) => {
  const { t } = useTranslation('learningPage');
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [dismissedWords, setDismissedWords] = useState<Set<string>>(new Set());

  // ✅ FIXED: Deterministic stable positioning
  const bubblePositions = useMemo(() => {
    const positions = new Map<string, { top: number; left: number }>();
    const visibleWords = words.filter(w => !dismissedWords.has(w.word));
    
    if (visibleWords.length === 0) return positions;

    // Generate stable hash from word
    const getStableHash = (word: string): number => {
      let hash = 0;
      for (let i = 0; i < word.length; i++) {
        hash = ((hash << 5) - hash) + word.charCodeAt(i);
        hash = hash & hash;
      }
      return Math.abs(hash);
    };

    // Grid-based layout with deterministic jitter
    const gridCols = Math.ceil(Math.sqrt(visibleWords.length));
    const gridRows = Math.ceil(visibleWords.length / gridCols);
    
    visibleWords.forEach((item, index) => {
      const row = Math.floor(index / gridCols);
      const col = index % gridCols;
      
      // Base grid position
      const baseTop = 15 + (row / gridRows) * 70;
      const baseLeft = 10 + (col / gridCols) * 80;
      
      // Add stable jitter based on word hash
      const hash = getStableHash(item.word);
      const jitterTop = ((hash % 100) / 100) * 10 - 5; // ±5%
      const jitterLeft = (((hash >> 8) % 100) / 100) * 10 - 5;
      
      positions.set(item.word, {
        top: Math.max(15, Math.min(85, baseTop + jitterTop)),
        left: Math.max(10, Math.min(90, baseLeft + jitterLeft)),
      });
    });

    return positions;
  }, [words, dismissedWords]);

  const getPrimaryErrorType = (errorBreakdown: Record<string, any>): string => {
    const types = Object.keys(errorBreakdown);
    if (types.includes('substitution')) return 'substitution';
    if (types.includes('omission')) return 'omission';
    if (types.includes('spelling')) return 'spelling';
    if (types.includes('morphology')) return 'morphology';
    if (types.includes('insertion')) return 'insertion';
    return 'substitution';
  };

  // ✅ IMPROVED: Better size scaling
  const getSize = (score: number): number => {
    // Exponential scaling for clear visual distinction
    const normalized = Math.max(0, Math.min(100, score)) / 100;
    const curved = Math.pow(normalized, 1.5);
    return 40 + curved * 100; // 40-140px
  };

  const handlePlayPronunciation = (word: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = 'en-US';
      utterance.rate = 0.8;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleDismiss = (word: string) => {
    setDismissedWords(prev => new Set(prev).add(word));
    onDismiss(word);
    if (selectedWord === word) {
      setSelectedWord(null);
    }
  };

  const handleRestore = (word: string) => {
    setDismissedWords(prev => {
      const next = new Set(prev);
      next.delete(word);
      return next;
    });
  };

  const visibleWords = words.filter(w => !dismissedWords.has(w.word));
  const dismissed = words.filter(w => dismissedWords.has(w.word));
  const selected = selectedWord ? words.find(w => w.word === selectedWord) : null;

  if (words.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-center p-4">
        <div>
          <Icon name="BrainCircuit" className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p className="text-muted-foreground">No difficult words detected yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Keep practicing - words will appear here as patterns emerge!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Bubble Playground */}
      <Card className="flex-1 min-h-[300px] relative overflow-hidden">
        <CardContent className="p-0 h-full">
          {visibleWords.map((item) => {
            const position = bubblePositions.get(item.word);
            if (!position) return null;

            const primaryError = getPrimaryErrorType(item.errorBreakdown);
            const color = ERROR_COLORS[primaryError] || '#64748b';
            const size = getSize(item.difficultyScore);

            return (
              <button
                key={item.word}
                onClick={() => setSelectedWord(item.word)}
                className={cn(
                  "absolute flex items-center justify-center rounded-full font-semibold shadow-lg transition-all duration-200 hover:scale-110 cursor-pointer border-2 focus:outline-none focus:ring-2 focus:ring-primary/50",
                  selectedWord === item.word && "ring-4 ring-primary/30 scale-110"
                )}
                style={{
                  top: `${position.top}%`,
                  left: `${position.left}%`,
                  width: `${size}px`,
                  height: `${size}px`,
                  backgroundColor: `${color}30`,
                  borderColor: color,
                  color: color,
                  transform: 'translate(-50%, -50%)',
                  fontSize: `${Math.max(11, size / 8)}px`,
                }}
                aria-label={`Word: ${item.word}, difficulty score: ${item.difficultyScore}`}
                title={`Click for details (Score: ${item.difficultyScore})`}
              >
                {item.word}
              </button>
            );
          })}
        </CardContent>
      </Card>

      {/* Detail Panel */}
      {selected && (
        <Card className="border-2 border-primary/50">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold">{selected.word}</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handlePlayPronunciation(selected.word)}
                  className="h-7 w-7"
                  title="Play pronunciation"
                >
                  <Icon name="Volume2" className="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedWord(null)}
                className="h-6 w-6"
              >
                <Icon name="X" className="h-3 w-3" />
              </Button>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-mono">Difficulty: {selected.difficultyScore}/100</span>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Error Breakdown</p>
              {Object.entries(selected.errorBreakdown).map(([type, breakdown]) => (
                <div key={type} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: ERROR_COLORS[type] || '#64748b' }}
                    />
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </span>
                  <span className="font-mono text-muted-foreground">{breakdown.count}×</span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>Replays: {selected.totalReplays}</span>
              <span>Reveals: {selected.totalReveals}</span>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => onConfirm(selected.word)}
                variant="default"
                size="sm"
                className="flex-1"
              >
                <Icon name="Check" className="h-3 w-3 mr-1" />
                Keep Tracking
              </Button>
              <Button
                onClick={() => handleDismiss(selected.word)}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                <Icon name="Trash2" className="h-3 w-3 mr-1" />
                Remove
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dismissed Words */}
      {dismissed.length > 0 && (
        <Card className="bg-muted/30">
          <CardContent className="p-3">
            <p className="text-xs font-semibold mb-2 text-muted-foreground">
              Dismissed Words ({dismissed.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {dismissed.map((item) => (
                <button
                  key={item.word}
                  onClick={() => handleRestore(item.word)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-background border hover:bg-accent transition-colors"
                  title="Click to restore"
                >
                  {item.word}
                  <Icon name="RotateCw" className="h-3 w-3" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};