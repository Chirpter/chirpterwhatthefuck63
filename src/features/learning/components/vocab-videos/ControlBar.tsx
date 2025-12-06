
"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";


interface ControlBarProps {
  onPrevious: () => void;
  onRepeat: () => void;
  onNext: () => void;
  isAutoSkipping: boolean;
  onAutoSkipChange: (value: boolean) => void;
  hasPrevious: boolean;
  hasNext: boolean;
  repeatCount: number;
  isRepeating: boolean;
  totalRepeats: number;
}

export function ControlBar({
  onPrevious,
  onRepeat,
  onNext,
  isAutoSkipping,
  onAutoSkipChange,
  hasPrevious,
  hasNext,
  repeatCount,
  isRepeating,
}: ControlBarProps) {
  const { t } = useTranslation('learningPage');
  
  const repeatButtonTooltip = isRepeating ? t('vocabClips.stopRepeating') : t('vocabClips.repeatButton');

  return (
    <div className="flex items-center justify-center gap-1">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
             <Button
              variant="outline"
              size="icon"
              onClick={onPrevious}
              disabled={!hasPrevious || isRepeating}
              className="h-11 w-11"
              aria-label={t('vocabClips.previousButton')}
            >
              <Icon name="ChevronLeft" className="h-6 w-6" />
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>{t('vocabClips.previousButton')}</p></TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={onRepeat}
              className="h-11 w-11 relative"
              aria-label={repeatButtonTooltip}
            >
              <div className="relative flex items-center justify-center">
                  <Icon 
                    name="RefreshCw" 
                    className={cn("h-5 w-5", isRepeating && "animate-spin")} 
                  />
                  {isRepeating ? (
                    <span className="absolute -top-2 -right-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary font-bold text-xs text-primary-foreground shadow-md">
                      {repeatCount}
                    </span>
                  ) : (
                    <span className="absolute -top-2 -right-2 flex h-4 w-4 items-center justify-center rounded-full bg-transparent text-xs font-bold text-muted-foreground">3</span>
                  )}
              </div>
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>{repeatButtonTooltip}</p></TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
             <Button
              variant="outline"
              size="icon"
              onClick={onNext}
              disabled={!hasNext || isRepeating}
              className="h-11 w-11"
              aria-label={t('vocabClips.nextButton')}
            >
              <Icon name="ChevronRight" className="h-6 w-6" />
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>{t('vocabClips.nextButton')}</p></TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
             <div
              onClick={() => onAutoSkipChange(!isAutoSkipping)}
              className={cn(
                  "h-11 w-11 border border-input bg-background rounded-md flex flex-col items-center justify-center cursor-pointer transition-colors hover:bg-accent hover:text-accent-foreground",
                  isAutoSkipping && "ring-2 ring-primary border-primary",
                  isRepeating && "opacity-50 cursor-not-allowed"
              )}
              aria-label={t('vocabClips.autoSkipLabel')}
            >
              <Label htmlFor="auto-skip-switch" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground pt-0.5 cursor-pointer">AUTO</Label>
              <div className="scale-75 -mt-0.5" onClick={(e) => e.stopPropagation()}>
                <Switch
                    id="auto-skip-switch"
                    checked={isAutoSkipping}
                    onCheckedChange={onAutoSkipChange}
                    disabled={isRepeating}
                />
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent><p>{t('vocabClips.autoSkipLabel')}</p></TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
