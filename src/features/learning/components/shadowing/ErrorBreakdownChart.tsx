"use client";

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import type { ShadowingResult } from './ShadowingBox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icons';

interface ErrorBreakdownChartProps {
  results: ShadowingResult[];
}

const COLORS: { [key: string]: string } = {
  correct: '#22c55e',
  spelling: '#f97316',
  omission: '#ef4444',
  insertion: '#a855f7',
  wrong_word: '#3b82f6',
  ending_sound: '#eab308',
  unknown: '#64748b',
};

const LABELS: { [key: string]: string } = {
  correct: 'Correct',
  spelling: 'Spelling',
  omission: 'Omission',
  insertion: 'Insertion',
  wrong_word: 'Wrong Word',
  ending_sound: 'Ending Sound',
  unknown: 'Other',
};

export const ErrorBreakdownChart: React.FC<ErrorBreakdownChartProps> = ({ results }) => {
  const { t } = useTranslation('learningPage');

  const chartData = useMemo(() => {
    if (!results || results.length === 0) return [];

    const errorCounts: { [key: string]: number } = {
        correct: 0,
        spelling: 0,
        omission: 0,
        insertion: 0,
        wrong_word: 0,
        ending_sound: 0,
    };
    let totalWords = 0;

    results.forEach(result => {
        if (result.isMatch) {
            const originalText = Array.isArray(result.original) 
                ? result.original.map((s: any) => s.text).join('') 
                : '';
            errorCounts.correct += originalText.split(/\s+/).filter(Boolean).length;
        } else {
            result.errorTypes.forEach((errorType: any) => {
                errorCounts[errorType] = (errorCounts[errorType] || 0) + 1;
            });
            const incorrectWordCount = result.errorTypes.length;
            const originalText = Array.isArray(result.original) 
                ? result.original.map((s: any) => s.text).join('')
                : '';
            const originalWordCount = originalText.split(/\s+/).filter(Boolean).length;
            errorCounts.correct += Math.max(0, originalWordCount - incorrectWordCount);
        }
        const originalText = Array.isArray(result.original)
            ? result.original.map((s: any) => s.text).join('')
            : '';
        totalWords += originalText.split(/\s+/).filter(Boolean).length;
    });

    return Object.entries(errorCounts)
      .map(([name, value]) => ({ name: LABELS[name] || LABELS.unknown, value }))
      .filter(entry => entry.value > 0);

  }, [results]);

  if (chartData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center h-full">
        <Icon name="BrainCircuit" className="h-10 w-10 mx-auto mb-2 opacity-50"/>
        <p>{t('shadowing.analysisComingSoon')}</p>
      </div>
    );
  }

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
  
  const totalErrors = chartData.reduce((sum, entry) => entry.name !== 'Correct' ? sum + entry.value : sum, 0);

  return (
    <div className="w-full h-full flex flex-col">
        <CardTitle className="text-center font-headline text-lg mb-2">{t('shadowing.errorAnalysisTitle')}</CardTitle>
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
                    <Cell key={`cell-${index}`} fill={COLORS[entry.name.toLowerCase().replace(' ', '_')] || COLORS.unknown} />
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
  );
};