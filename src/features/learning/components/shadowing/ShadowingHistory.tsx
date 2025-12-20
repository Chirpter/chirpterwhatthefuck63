
// src/features/learning/components/shadowing/ShadowingHistory.tsx

"use client";

import React from 'react';
import { useTranslation } from 'react-i18next';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';

export interface HistoryItem {
  videoId: string;
  url: string;
  title: string;
  thumbnail?: string;
  totalLines?: number;
  progress?: number[];
  lastAccessed?: number;
}

interface ShadowingHistoryProps {
  history: HistoryItem[];
  currentVideoId: string | null;
  onItemClick: (item: HistoryItem) => void;
  onClearHistory: () => void;
}

const getVideoProgress = (videoId: string, totalLines?: number) => {
  try {
    const saved = localStorage.getItem(`shadowing-progress-${videoId}`);
    if (saved) {
      const p = JSON.parse(saved);
      const completed = Array.isArray(p) ? p.length : 0;
      const percentage = totalLines ? Math.round((completed / totalLines) * 100) : 0;
      return { completed, percentage };
    }
  } catch (e) {
    console.error(e);
  }
  return { completed: 0, percentage: 0 };
};

// Placeholder frame component
const PlaceholderFrame = () => (
  <div className="aspect-video relative rounded-md overflow-hidden border border-dashed border-muted-foreground/30 bg-muted/20">
    <div className="absolute inset-0 flex items-center justify-center">
      <Icon name="Youtube" className="h-8 w-8 text-muted-foreground/30" />
    </div>
  </div>
);

export const ShadowingHistory: React.FC<ShadowingHistoryProps> = ({
  history,
  currentVideoId,
  onItemClick,
  onClearHistory,
}) => {
  const { t } = useTranslation('learningPage');

  const recentHistory = history.filter(h => h.videoId !== currentVideoId);
  
  // Always show 2 slots (either filled with videos or placeholders)
  const displaySlots = 2;

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="py-3 px-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="font-headline text-base">
            {t('shadowing.historyTitle')}
          </CardTitle>
          {recentHistory.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClearHistory}
              className="h-7 w-7 text-muted-foreground hover:text-destructive transition-colors"
              title="Clear all history"
            >
              <Icon name="Trash2" className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-3 flex-1 min-h-0 overflow-auto">
        <div className="grid grid-cols-2 gap-3">
          {/* Render actual videos */}
          {recentHistory.slice(0, displaySlots).map(item => {
            const { completed, percentage } = getVideoProgress(item.videoId, item.totalLines);
            const thumbnailUrl = item.thumbnail || `https://img.youtube.com/vi/${item.videoId}/mqdefault.jpg`;

            return (
              <button
                key={item.videoId}
                onClick={() => onItemClick(item)}
                className="text-left transition-transform hover:scale-105"
              >
                <div className="group aspect-video relative rounded-md overflow-hidden border">
                  <Image
                    src={thumbnailUrl}
                    alt="Video thumbnail"
                    fill
                    sizes="(max-width: 768px) 50vw, 25vw"
                    className="object-cover transition-transform group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/40" />

                  {percentage > 0 && (
                    <div className="absolute top-1 right-1 bg-black/70 text-white text-[10px] font-bold px-2 py-0.5 rounded backdrop-blur-sm">
                      {percentage}%
                    </div>
                  )}

                  {percentage > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                      <div
                        className="h-full bg-red-600 transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
          
          {/* Render placeholder frames for empty slots */}
          {Array.from({ length: Math.max(0, displaySlots - recentHistory.length) }).map((_, i) => (
            <PlaceholderFrame key={`placeholder-${i}`} />
          ))}
        </div>
        
        {/* Show message only when NO history at all */}
        {recentHistory.length === 0 && (
          <p className="text-xs text-muted-foreground text-center mt-4">
            
          </p>
        )}
      </CardContent>
    </Card>
  );
};
