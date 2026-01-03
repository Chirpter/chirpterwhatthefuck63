// src/features/learning/components/shadowing/ShadowingAnalysis.tsx
"use client";

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icons';
import { Progress } from '@/components/ui/progress';
import { InteractiveBubblePanel } from './InteractiveBubblePanel';
import type { WordTracking } from '@/features/learning/services/smart-error-tracker';

export interface ErrorStats {
  correct: number;
  omission: number;
  spelling: number;
  wrong_word: number;
  insertion: number;
  ending_sound: number;
  morphology?: number;
}

interface ShadowingAnalysisProps {
  errorStats: ErrorStats;
  wordsNeedingAttention: WordTracking[];
  onConfirmWord?: (word: string) => void;
  onDismissWord?: (word: string) => void;
  showChart?: boolean;
  progressPercentage?: number;
  completedLinesCount?: number;
  totalLines?: number;
  isShadowingMode?: boolean;
}

const COLORS: { [key: string]: string } = {
  correct: '#22c55e',
  wrong_word: '#ef4444',
  spelling: '#f97316',
  ending_sound: '#ec4899',
  omission: '#eab308',
  insertion: '#3b82f6',
  morphology: '#a855f7',
};

const LABELS: { [key: string]: string } = {
  correct: 'Correct',
  wrong_word: 'Wrong Word',
  spelling: 'Spelling',
  ending_sound: 'Ending Sound',
  omission: 'Omission',
  insertion: 'Insertion',
  morphology: 'Morphology',
};

export const ShadowingAnalysis: React.FC<ShadowingAnalysisProps> = ({
  errorStats,
  wordsNeedingAttention,
  onConfirmWord,
  onDismissWord,
  showChart = false,
  progressPercentage = 0,
  completedLinesCount = 0,
  totalLines = 0,
  isShadowingMode = false,
}) => {
  const { t } = useTranslation('learningPage');

  const chartData = useMemo(() => {
    return Object.entries(errorStats)
      .map(([name, value]) => ({ name: LABELS[name] || name, value }))
      .filter(entry => entry.value > 0);
  }, [errorStats]);

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

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-3 space-y-3">
        <CardTitle className="font-headline text-lg">
          {t('shadowing.analysisTitle')}
        </CardTitle>
        
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
          /* Chart Mode (every 10 lines) */
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
        ) : wordsNeedingAttention.length > 0 ? (
          /* Interactive Bubble Mode (when words detected) */
          <div className="h-full min-h-[200px]">
            <InteractiveBubblePanel
              words={wordsNeedingAttention}
              onDismiss={onDismissWord || (() => {})}
              onConfirm={onConfirmWord || (() => {})}
            />
          </div>
        ) : isShadowingMode && completedLinesCount > 0 ? (
          /* ✅ FIXED: Show progress when no difficult words yet */
          <div className="h-full flex items-center justify-center text-center p-6">
            <div className="space-y-3">
              <div className="relative inline-block">
                <Icon name="TrendingUp" className="h-12 w-12 text-green-500 mx-auto" />
                <div className="absolute inset-0 rounded-full bg-green-500/20 blur-lg -z-10 animate-pulse" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground mb-1">Great Progress!</p>
                <p className="text-sm text-muted-foreground">
                  No difficult words detected yet.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Keep practicing - patterns will emerge as you continue
                </p>
              </div>
              
              {/* ✅ Mini stats */}
              <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{completedLinesCount}</div>
                  <div className="text-xs text-muted-foreground">Lines Completed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-500">{errorStats.correct}</div>
                  <div className="text-xs text-muted-foreground">Correct Words</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ✅ FIXED: Initial empty state with better guidance */
          <div className="h-full flex items-center justify-center text-center p-6">
            <div className="space-y-4">
              <div className="relative inline-block">
                <Icon name="BrainCircuit" className="h-16 w-16 mx-auto text-primary/40" />
                <div className="absolute inset-0 rounded-full bg-primary/10 blur-xl -z-10" />
              </div>
              
              <div>
                <p className="text-lg font-semibold text-foreground mb-2">
                  {isShadowingMode ? 'Smart Analysis Ready' : 'Enter Shadowing Mode'}
                </p>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  {isShadowingMode 
                    ? 'Start practicing and this panel will track your difficult words using AI-powered pattern detection'
                    : 'Click the shadowing button above to begin practicing and see your analysis here'
                  }
                </p>
              </div>

              {/* ✅ Feature preview */}
              {isShadowingMode && (
                <div className="grid grid-cols-2 gap-2 mt-4 text-left">
                  <div className="flex items-start gap-2 p-2 rounded-md bg-muted/30">
                    <Icon name="Target" className="h-4 w-4 text-primary mt-0.5" />
                    <div className="text-xs">
                      <div className="font-medium">Word Tracking</div>
                      <div className="text-muted-foreground">Auto-detect patterns</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-2 rounded-md bg-muted/30">
                    <Icon name="BarChart3" className="h-4 w-4 text-primary mt-0.5" />
                    <div className="text-xs">
                      <div className="font-medium">Progress Stats</div>
                      <div className="text-muted-foreground">Every 10 lines</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};