// src/features/learning/components/shadowing/ShadowingAnalysis.tsx

"use client";

import React, { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icons';
import { Progress } from '@/components/ui/progress';

export interface ErrorStats {
  correct: number;
  omission: number;
  spelling: number;
  wrong_word: number;
  insertion: number;
  ending_sound: number;
}

export interface WordNeedingAttention {
  word: string;
  score: number;
  errorTypes: string[];
}

interface ShadowingAnalysisProps {
  errorStats: ErrorStats;
  wordsNeedingAttention: WordNeedingAttention[];
  onConfirmWord?: (word: string, isHard: boolean) => void;
  showChart?: boolean;
  progressPercentage?: number;
  completedLinesCount?: number;
  totalLines?: number;
  isShadowingMode?: boolean;
}

// DETAILED COLOR SYSTEM for Analysis
const COLORS: { [key: string]: string } = {
  correct: '#22c55e',      // Green - Correct words
  wrong_word: '#ef4444',   // Red - Wrong word choice
  spelling: '#f97316',     // Orange - Spelling errors
  ending_sound: '#ec4899', // Pink - Ending sound errors
  omission: '#eab308',     // Yellow - Missing words
  insertion: '#3b82f6',    // Blue - Extra words
};

const LABELS: { [key: string]: string } = {
  correct: 'Correct',
  wrong_word: 'Wrong Word',
  spelling: 'Spelling',
  ending_sound: 'Ending Sound',
  omission: 'Omission',
  insertion: 'Insertion',
};

// DETAILED COLOR SYSTEM for word stickers
const ERROR_TYPE_COLORS: { [key: string]: string } = {
  wrong_word: '#ef4444',   // Red
  spelling: '#f97316',     // Orange
  ending_sound: '#ec4899', // Pink
  omission: '#eab308',     // Yellow
  insertion: '#3b82f6',    // Blue
  unknown: '#64748b',
};

export const ShadowingAnalysis: React.FC<ShadowingAnalysisProps> = ({
  errorStats,
  wordsNeedingAttention,
  onConfirmWord,
  showChart = false,
  progressPercentage = 0,
  completedLinesCount = 0,
  totalLines = 0,
  isShadowingMode = false,
}) => {
  const { t } = useTranslation('learningPage');
  const [wordPositions, setWordPositions] = useState<{[key: string]: {top: number, left: number}}>({});

  const chartData = useMemo(() => {
    return Object.entries(errorStats)
      .map(([name, value]) => ({ name: LABELS[name] || name, value }))
      .filter(entry => entry.value > 0);
  }, [errorStats]);

  // Generate non-overlapping positions for words
  useEffect(() => {
    const positions: {[key: string]: {top: number, left: number}} = {};
    const usedPositions: {top: number, left: number}[] = [];
    
    wordsNeedingAttention.forEach((item, index) => {
      let attempts = 0;
      let position: {top: number, left: number} = {top: 0, left: 0};
      
      // Try to find a non-overlapping position
      do {
        position = {
          top: Math.random() * 60 + 20, // 20% to 80%
          left: Math.random() * 60 + 20, // 20% to 80%
        };
        attempts++;
        
        // Check if this position overlaps with any existing position
        const isOverlapping = usedPositions.some(used => 
          Math.abs(used.top - position.top) < 15 && 
          Math.abs(used.left - position.left) < 15
        );
        
        if (!isOverlapping || attempts > 50) break;
      } while (attempts < 50);
      
      positions[item.word] = position;
      usedPositions.push(position);
    });
    
    setWordPositions(positions);
  }, [wordsNeedingAttention]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background/80 backdrop-blur-sm border p-2 rounded-md shadow-lg">
          <p className="font-bold text-foreground">{`${payload[0].name}: ${payload[0].value}`}</p>
        </div>
      );
    }
    return null;
  };

  const hasData = chartData.length > 0;

  const getPrimaryErrorType = (errorTypes: string[]): string => {
    if (errorTypes.includes('wrong_word')) return 'wrong_word';
    if (errorTypes.includes('spelling')) return 'spelling';
    if (errorTypes.includes('ending_sound')) return 'ending_sound';
    if (errorTypes.includes('omission')) return 'omission';
    if (errorTypes.includes('insertion')) return 'insertion';
    return 'unknown';
  };

  return (
    <Card className="flex flex-col h-full">
      {/* Compact Header with Progress Bar */}
      <CardHeader className="pb-3 space-y-3">
        <CardTitle className="font-headline text-lg">
          {t('shadowing.analysisTitle')}
        </CardTitle>
        
        {/* Progress Bar moved from middle column */}
        {isShadowingMode && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-mono text-muted-foreground">
                {completedLinesCount}/{totalLines} ({progressPercentage}%)
              </span>
            </div>
            <Progress 
              value={progressPercentage} 
              className="h-2" 
              indicatorClassName="bg-primary" 
            />
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 min-h-0 pb-4">
        {showChart && hasData ? (
          <div className="h-full min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius="80%"
                  innerRadius="50%"
                  fill="#8884d8"
                  dataKey="value"
                  stroke="hsl(var(--background))"
                  strokeWidth={2}
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[entry.name.toLowerCase().replace(' ', '_')] || '#64748b'}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  iconSize={10}
                  layout="horizontal"
                  verticalAlign="bottom"
                  align="center"
                  wrapperStyle={{ fontSize: '12px', paddingBottom: '10px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-full min-h-[200px] border-2 border-dashed border-border rounded-lg flex items-center justify-center text-center text-muted-foreground p-4 relative">
            {wordsNeedingAttention.length > 0 ? (
              <>
                {wordsNeedingAttention.map((item) => {
                  const position = wordPositions[item.word];
                  const primaryErrorType = getPrimaryErrorType(item.errorTypes);
                  const color = ERROR_TYPE_COLORS[primaryErrorType] || ERROR_TYPE_COLORS.unknown;

                  return position ? (
                    <div
                      key={item.word}
                      className="absolute inline-flex items-center gap-2 px-3 py-2 rounded-md shadow-lg border-2 backdrop-blur-sm z-10"
                      style={{
                        top: `${position.top}%`,
                        left: `${position.left}%`,
                        backgroundColor: `${color}20`,
                        borderColor: color,
                        transform: 'translate(-50%, -50%)',
                        maxWidth: 'fit-content',
                      }}
                    >
                      <span 
                        className="font-semibold text-sm whitespace-nowrap"
                        style={{ color }}
                      >
                        {item.word}
                      </span>
                      
                      <button
                        onClick={() => onConfirmWord?.(item.word, false)}
                        className="text-xs hover:scale-110 transition-transform flex-shrink-0 p-1 rounded bg-gray-100 hover:bg-gray-200"
                        title="No, remove this word"
                      >
                        🗑️
                      </button>
                      <button
                        onClick={() => onConfirmWord?.(item.word, true)}
                        className="text-xs hover:scale-110 transition-transform flex-shrink-0 p-1 rounded bg-gray-100 hover:bg-gray-200"
                        title="Yes, this is difficult"
                      >
                        😢
                      </button>
                    </div>
                  ) : null;
                })}
              </>
            ) : (
              <div>
                <Icon name="BrainCircuit" className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>{t('shadowing.analysisComingSoon')}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};