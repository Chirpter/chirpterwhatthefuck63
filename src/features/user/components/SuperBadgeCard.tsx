

"use client";

import React, { useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Icon, type IconName } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ACHIEVEMENTS } from '@/features/user/constants/achievements';
import type { Achievement } from '@/features/user/constants/achievements';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import type { Tier, TierTask } from '@/lib/types';
import { useUser } from '@/contexts/user-context';


const achievementsMap = new Map(ACHIEVEMENTS.map(a => [a.id, a]));

export const SuperBadgeCard: React.FC<{
  name: string;
  description: string;
  icon: IconName;
  currentProgress: number;
  tiers: Tier[];
}> = ({
  name,
  description,
  icon,
  currentProgress,
  tiers,
}) => {
  const { user } = useUser();
  const { t } = useTranslation(['achievements', 'common']);
  const userAchievementsMap = useMemo(() => new Map(user?.achievements?.map(a => [a.id, a])), [user?.achievements]);

  const getTaskDetails = (task: TierTask): { name: string; imageUrl?: string; isCompleted: boolean; current: number; goal: number } | null => {
    if (task.type === 'ref') {
      const achievement = achievementsMap.get(task.id);
      if (!achievement) return null;

      const userStat = user?.stats?.[achievement.statToTrack] || 0;
      const isCompleted = userStat >= task.goal;
      
      return { 
        name: t(achievement.nameKey), 
        imageUrl: achievement.imageUrl,
        isCompleted,
        current: userStat,
        goal: task.goal,
      };
    }
    
    // For inline tasks
    const isCompleted = task.current >= task.goal;
    return { 
        name: task.name, 
        imageUrl: task.imageUrl,
        isCompleted,
        current: task.current,
        goal: task.goal
    };
  };

  const currentTier = useMemo(() => {
    let highestAchievedTier = tiers[0];
    
    for (let i = 0; i < tiers.length; i++) {
        const tier = tiers[i];
        const tasks = tier.tasks;
        
        // Count how many tasks in the current tier are completed
        const completedTasksInTier = tasks.reduce((count, task) => {
            const details = getTaskDetails(task);
            return details?.isCompleted ? count + 1 : count;
        }, 0);
        
        // Check if the user has met the goal for the current tier
        if (tier.goal > 0 && completedTasksInTier >= tier.goal) {
            // If they have, this is their current highest achieved tier
            highestAchievedTier = tier;
        } else {
            // If they haven't met the goal, they are stuck on this tier, so we break
            // and the previously set `highestAchievedTier` is the correct one.
            break;
        }
    }
    
    return highestAchievedTier;

  }, [tiers, user?.stats]);
  
  const nextTier = useMemo(() => {
    if (!currentTier) return tiers[0];
    const currentTierIndex = tiers.findIndex(t => t.name === currentTier.name);
    return tiers[currentTierIndex + 1];
  }, [currentTier, tiers]);

  const isMaxLevel = !nextTier;


  return (
    <div className="break-inside-avoid">
      <Card className={cn("rounded-xl overflow-hidden flex flex-col h-full bg-card")}>
        {/* Top visual part */}
        <div className={cn(
            "aspect-square w-full flex flex-col items-center justify-center text-white p-4 relative text-center rounded-xl overflow-hidden bg-gradient-to-br",
            currentTier.color
        )}>
           <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-8 w-8 text-white/70 hover:bg-white/20 hover:text-white rounded-full z-20">
                  <Icon name="Info" className="h-5 w-5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64" align="end">
                <div className="space-y-3">
                  <h4 className="font-semibold font-headline">{t('tier', { ns: 'common' })}: {t(`tiers.${currentTier.name.toLowerCase()}`, { ns: 'common' })}</h4>
                  <div className="flex flex-col gap-3">
                    {currentTier.isComingSoon ? (
                        <p className="text-xs text-muted-foreground italic text-center p-2">{t('comingSoonTasks')}</p>
                    ) : currentTier.tasks.length > 0 ? (
                      currentTier.tasks.map(task => {
                        const details = getTaskDetails(task);
                        if (!details) return null;
                        
                        return (
                          <div key={task.id} className="flex items-center gap-3">
                              <div className="h-8 w-8 flex-shrink-0 rounded-md bg-muted/50 border flex items-center justify-center overflow-hidden relative">
                                  {details.imageUrl ? (
                                      <Image src={details.imageUrl} alt={details.name} fill className="object-cover" />
                                  ) : (
                                      <Icon name="Star" className="h-5 w-5 text-muted-foreground" />
                                  )}
                                  {details.isCompleted && (
                                       <div className="absolute inset-0 bg-green-500/70 flex items-center justify-center">
                                          <Icon name="Check" className="h-5 w-5 text-white" />
                                      </div>
                                  )}
                              </div>
                              <div className="flex-grow">
                                  <p className="text-xs font-medium leading-tight">{details.name}</p>
                                  <p className="text-xs text-muted-foreground">{details.current}/{details.goal}</p>
                              </div>
                          </div>
                        )
                      })
                    ) : (
                       <p className="text-xs text-muted-foreground italic text-center p-2">{t('comingSoonTasks')}</p>
                    )}
                  </div>
                   {nextTier && <p className="text-xs text-muted-foreground text-center pt-2 border-t mt-2">{t('completeAllForNextTier', { tierName: t(`tiers.${nextTier.name.toLowerCase()}`, { ns: 'common' }) })}</p>}
                </div>
              </PopoverContent>
            </Popover>

          <Icon name={icon} className="h-16 w-16 opacity-90 drop-shadow-lg" />
          {isMaxLevel && (
              <div className={cn("absolute top-2 left-2 h-8 w-8 bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center shadow-inner", currentTier.trophyColor)}>
                  <Icon name="Trophy" className="h-5 w-5" />
              </div>
          )}
        </div>
        
        {/* Bottom content part */}
        <CardContent className="p-3 flex flex-col flex-grow justify-center">
            <h4 className="font-semibold font-headline text-base text-center">{name}</h4>
        </CardContent>
      </Card>
    </div>
  );
};
