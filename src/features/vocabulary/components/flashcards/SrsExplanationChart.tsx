

"use client";

import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Label,
  ReferenceDot,
  Tooltip,
  Area,
  ReferenceLine,
} from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart";

const chartData = [
    { time: 0, strength: 0 },
    { time: 1, strength: 1, label: "Learning", type: 'peak' },
    { time: 2, strength: 0.8 },
    { time: 4, strength: 1.2, label: "Forgetting", type: 'forget' },
    { time: 7, strength: 2, label: "Short-term", type: 'peak' },
    { time: 14, strength: 1.2, label: "Oops! Forgetting again", type: 'forget' },
    { time: 20, strength: 2.5 },
    { time: 21, strength: 3, label: "Long-term", type: 'peak' },
    { time: 22, strength: 2.9 },
    { time: 23, strength: 2.9 },
];

const chartConfig = {
  strength: {
    label: "Memory",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

const getPeakColor = (label: string) => {
    if (label.includes('Learning')) return 'hsl(var(--level-purple))';
    if (label.includes('Short-term')) return 'hsl(var(--level-pink))';
    if (label.includes('Long-term')) return 'hsl(var(--level-orange))';
    return 'hsl(var(--primary))';
};


export function SrsExplanationChart() {
  const { t } = useTranslation('vocabularyPage');
  
  return (
    <ChartContainer config={chartConfig} className="min-h-[180px] w-full">
      <ResponsiveContainer>
        <AreaChart
          data={chartData}
          margin={{ top: 20, right: 10, left: -30, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="time"
            type="number"
            tick={false}
            axisLine={true}
            domain={[0, 23]}
          />
          <YAxis
            dataKey="strength"
            type="number"
            tick={false}
            axisLine={true}
            domain={[0, 3.5]}
          />
          <Tooltip 
            content={<ChartTooltipContent hideLabel indicator="line" />}
            cursor={{ stroke: 'hsl(var(--border))', strokeDasharray: '3 3' }}
          />
          <defs>
            <linearGradient id="fillStrength" x1="0" y1="0" x2="1" y2="0">
              <stop offset="5%" stopColor="hsl(var(--level-silver))" stopOpacity={0.4} />
              <stop offset="30%" stopColor="hsl(var(--level-purple))" stopOpacity={0.8} />
              <stop offset="65%" stopColor="hsl(var(--level-pink))" stopOpacity={0.8} />
              <stop offset="95%" stopColor="hsl(var(--level-orange))" stopOpacity={0.8} />
            </linearGradient>
          </defs>
          <Area
            dataKey="strength"
            type="monotone"
            fill="url(#fillStrength)"
            strokeWidth={2}
            stroke="hsl(var(--primary))"
            dot={false}
          />
          
          {/* Reference Dots with labels */}
          {chartData.filter(d => d.label).map(dot => {
            const isPeak = dot.type === 'peak';
            const isForgetting = dot.type === 'forget';
            
            return (
              <ReferenceDot 
                  key={dot.time} 
                  x={dot.time} 
                  y={dot.strength} 
                  r={isPeak ? 4 : 0}
                  fill={isPeak ? getPeakColor(dot.label!) : "transparent"} 
                  stroke={isPeak ? "white" : "transparent"} 
                  strokeWidth={2}
              >
                  <Label 
                      value={dot.label} 
                      position="top" 
                      dx={dot.label === 'Learning' ? 10 : 0}
                      dy={isForgetting ? 20 : -1}
                      fontSize={10} 
                      fill={isForgetting ? 'hsl(var(--destructive))' : (isPeak ? getPeakColor(dot.label!) : 'hsl(var(--foreground))')} 
                      style={{ textAnchor: 'middle', whiteSpace: 'pre-wrap', fontWeight: 'bold' }} 
                  />
              </ReferenceDot>
            )
          })}
        </AreaChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
