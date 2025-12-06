
"use client";

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import type { SystemBookmark } from '@/lib/types';
import { DynamicBookmark } from '@/features/library/components/DynamicBookmark';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

export type BookmarkStatus = 'owned' | 'locked' | 'for_sale';

export interface BookmarkCardProps {
  bookmark: SystemBookmark;
  status: BookmarkStatus;
  price?: number;
  onCardClick?: () => void;
  onEditClick?: () => void;
  isComplete?: boolean;
  className?: string;
  isSelected?: boolean;
}

const FeatureIcon: React.FC<{ icon: IconName; tooltip: string; colorClass: string }> = ({ icon, tooltip, colorClass }) => (
    <TooltipProvider>
        <Tooltip>
            <TooltipTrigger asChild>
                <div className={cn("h-5 w-5 rounded-full text-white flex items-center justify-center border-2 border-white/50 shadow-md", colorClass)}>
                    <Icon name={icon} className="h-3 w-3" />
                </div>
            </TooltipTrigger>
            <TooltipContent className="font-body text-xs">
                <p>{tooltip}</p>
            </TooltipContent>
        </Tooltip>
    </TooltipProvider>
);


export const BookmarkCard: React.FC<BookmarkCardProps> = ({
  bookmark,
  status,
  price,
  onCardClick,
  onEditClick,
  isComplete = false,
  className,
  isSelected = false,
}) => {
  const { t } = useTranslation(['common', 'achievements']);

  const features = React.useMemo(() => {
    const detected: { icon: IconName, tooltip: string, colorClass: string }[] = [];
    if (bookmark.initialState?.customCss || bookmark.completedState?.customCss) {
        detected.push({ icon: 'Sparkles', tooltip: t('achievements:features.animated'), colorClass: 'bg-primary' });
    }
    if (bookmark.completedState?.mainVisual?.value) {
        detected.push({ icon: 'Layers', tooltip: t('achievements:features.dualState'), colorClass: 'bg-level-orange' });
    }
    if (bookmark.initialState?.sound || bookmark.completedState?.sound) {
        detected.push({ icon: 'Volume2', tooltip: t('achievements:features.soundFX'), colorClass: 'bg-accent' });
    }
    return detected;
  }, [bookmark, t]);


  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEditClick?.();
  };
  
  const handleClick = () => {
    // Play sound from the non-interactive DynamicBookmark component inside
    const dynamicBookmarkElement = document.getElementById(`dynamic-bookmark-${bookmark.id}`);
    if (dynamicBookmarkElement) {
        dynamicBookmarkElement.click();
    }
    onCardClick?.();
  }

  return (
    <Card
      onClick={handleClick}
      className={cn(
        "group relative w-full overflow-hidden rounded-xl border bg-card transition-all duration-300",
        onCardClick && "cursor-pointer hover:border-primary",
        isSelected && "border-primary ring-2 ring-primary",
        className
      )}
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted/30 p-2">
        <div className="relative h-full w-full">
          <DynamicBookmark bookmark={bookmark} isComplete={isComplete} isInteractive={onEditClick !== undefined} />
        </div>
        
        {features.length > 0 && (
            <div className="absolute top-1.5 left-1.5 flex items-center gap-1.5 z-10">
                {features.map((feature) => (
                    <FeatureIcon key={feature.tooltip} icon={feature.icon} tooltip={feature.tooltip} colorClass={feature.colorClass} />
                ))}
            </div>
        )}

        {onEditClick && (
            <Button
                variant="secondary"
                size="icon"
                className="absolute bottom-1 right-1 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={handleEdit}
                aria-label="Edit Bookmark"
            >
                <Icon name="Edit" className="h-3.5 w-3.5" />
            </Button>
        )}
      </div>
      
      <div className="p-2 text-center">
        <p className="truncate text-xs font-semibold">{bookmark.name}</p>
        {status === 'for_sale' && price != null && (
          <Badge variant="outline" className="mt-1 text-xs">
            {price} {t('credits')}
          </Badge>
        )}
         {status === 'owned' && (
          <Badge variant="secondary" className="mt-1 text-xs border-green-500/30 text-green-600">
            {t('owned')}
          </Badge>
        )}
      </div>
    </Card>
  );
};
