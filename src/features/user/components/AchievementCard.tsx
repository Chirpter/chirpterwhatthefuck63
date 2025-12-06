
"use client";

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import type { Achievement } from '@/lib/achievements';
import type { UserStats, UserAchievement, User } from '@/lib/types';
import Image from 'next/image';
import { Progress } from '@/components/ui/progress';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getLevelStyles, type LevelTier } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { CreditIcon } from '@/components/ui/CreditIcon';

interface AchievementCardProps {
    achievement: Achievement;
    user: User; // Pass the whole user object
    onClaim: () => void;
    isClaiming: boolean;
}


export const AchievementCard = ({ achievement, user, onClaim, isClaiming }: AchievementCardProps) => {
    const { t } = useTranslation(['achievements', 'common']);
    
    const userAchievementData = useMemo(() => 
        user.achievements?.find(a => a.id === achievement.id),
        [user.achievements, achievement.id]
    );

    const { 
        currentTier, 
        userProgress, 
        isCompleted, 
        isClaimed,
        isLocked,
        isClaimable,
    } = useMemo(() => {
        
        // --- Daily Task Logic ---
        if (achievement.category === 'daily') {
            const dailyTier = achievement.tiers[0];
            const hasDoneToday = user.lastLoginDate === new Date().toISOString().split('T')[0];

            return {
                currentTier: dailyTier,
                userProgress: hasDoneToday ? 1 : 0,
                isCompleted: hasDoneToday,
                isClaimed: hasDoneToday,
                isLocked: false,
                isClaimable: hasDoneToday && !achievement.isAutoClaimed,
            };
        }
        
        // --- Milestone (Other) Task Logic ---
        const lastClaimedLevel = userAchievementData?.lastClaimedLevel || 0;
        let currentTier = achievement.tiers.find(t => t.level === lastClaimedLevel + 1);
        
        let isFullyCompleted = false;
        if (!currentTier) {
            currentTier = achievement.tiers[achievement.tiers.length - 1];
            isFullyCompleted = true;
        }

        const progressValue = user.stats?.[achievement.statToTrack] as number || 0;
        const isTaskCompleted = progressValue >= currentTier.goal;
        
        return {
            currentTier,
            userProgress: progressValue,
            isCompleted: isTaskCompleted,
            isClaimed: isFullyCompleted && isTaskCompleted,
            isLocked: !isTaskCompleted,
            isClaimable: isTaskCompleted && !isFullyCompleted,
        };
    }, [achievement, userAchievementData, user.stats, user.lastLoginDate]);
    
    if (!currentTier) return null; // Should not happen

    const handleClaimClick = () => {
        if (!isClaimable) return;
        onClaim();
    };
    
    const levelTiers: Exclude<LevelTier, 'gold'>[] = ['silver', 'green', 'blue', 'purple', 'pink'];

    const renderFooterContent = () => {
        // The reward displayed is now always the base reward. The server handles bonuses.
        const displayReward = currentTier.creditReward;
        
        return (
          <div className="flex items-center justify-center h-full">
            <AnimatePresence mode="wait">
              {isClaimed ? (
                <motion.div
                  key="claimed"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex items-center justify-center h-full w-full text-primary font-bold text-sm uppercase tracking-wider"
                >
                  {t('claimed')}
                </motion.div>
              ) : isClaimable ? (
                <motion.div key="claimable" className="w-full">
                  <Button
                    onClick={handleClaimClick}
                    disabled={isClaiming}
                    size="sm"
                    className="w-full h-8 bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    {isClaiming ? (
                      <Icon name="Loader2" className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      // Display only the base reward; server calculates the final amount
                      t('claimWithCount', { count: displayReward })
                    )}
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="reward"
                  className="flex items-center justify-center h-full text-foreground font-semibold text-sm gap-1"
                >
                  {displayReward} Credits
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      };

    return (
        <div className="break-inside-avoid">
            <Card className={cn("rounded-xl overflow-hidden bg-card flex flex-col h-full")}>
                <div className="aspect-square relative flex flex-col items-center justify-end text-center p-3 gap-3 rounded-xl overflow-hidden">
                    <Image 
                        src={achievement.imageUrl}
                        alt={t(achievement.nameKey)} 
                        fill
                        className={cn("object-cover transition-transform duration-500 ease-in-out")}
                    />

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-8 w-8 text-white/70 hover:bg-white/20 hover:text-white rounded-full z-20 backdrop-blur-sm bg-black/20">
                                <Icon name="Info" className="h-5 w-5" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent 
                            className="w-64 bg-popover text-popover-foreground border-border" 
                            align="end"
                        >
                            <div className="space-y-3">
                                <h4 className="font-semibold font-headline">{t(achievement.nameKey)}</h4>
                                {achievement.category === 'other' ? (
                                    achievement.tiers.map(tier => {
                                      const isClaimed = (userAchievementData?.lastClaimedLevel || 0) >= tier.level;
                                      const isCurrent = currentTier.level === tier.level && !isClaimed;
                                      
                                      return (
                                        <div key={tier.level} className={cn(
                                          "text-xs flex justify-between items-center p-1 rounded-md",
                                          isClaimed && "text-muted-foreground line-through opacity-70",
                                          isCurrent && "bg-primary/5 border border-primary/50"
                                        )}>
                                            <span>{t(achievement.tierNameKey, { count: tier.goal })}</span>
                                            <span className="font-bold flex items-center gap-1">{tier.creditReward} <CreditIcon className="h-3 w-3 text-yellow-400" /></span>
                                        </div>
                                      );
                                    })
                                ) : (
                                     <div className="space-y-2">
                                        {levelTiers.map(tierName => {
                                            const reward = (achievement.tiers[0].creditReward || 0) + (((achievement.tiers[0].levelBonus as Record<Exclude<LevelTier, 'gold'>, number>) ?? {})[tierName] || 0);
                                            const userLevelTier = getLevelStyles(user.level, user.plan).tier;
                                            const isCurrent = userLevelTier === tierName;

                                            return (
                                                <div key={tierName} className={cn(
                                                  "text-xs flex items-center gap-2 p-1 rounded-md",
                                                  isCurrent && "bg-primary/5 border border-primary/50"
                                                )}>
                                                     <div className={cn('px-1.5 py-0.5 rounded-sm text-white text-[10px] font-bold', getLevelStyles(0, 'free', tierName).badgeClasses)}>{t(`tiers.${tierName}`, { ns: 'common' })}</div>
                                                    <span className="flex-1 capitalize">{t(`tiers.${tierName}`, { ns: 'common' })}</span>
                                                    <span className="font-bold flex items-center gap-1">{reward} <CreditIcon className="h-3 w-3 text-yellow-400" /></span>
                                                </div>
                                            )
                                        })}
                                     </div>
                                )}
                            </div>
                        </PopoverContent>
                    </Popover>

                    <div className="relative z-10 text-foreground dark:text-white drop-shadow-md text-center w-full bg-white/40 dark:bg-black/40 p-1 rounded-lg">
                        <h4 className="font-semibold font-headline text-base">{t(achievement.nameKey)}</h4>
                        <p className="text-xs opacity-90 mt-1">{t(achievement.descriptionKey)}</p>
                        
                        {!isClaimed && !isClaimable && achievement.category === 'other' && (
                            <div className="w-full px-4 flex items-center gap-2 mt-1">
                                <Progress value={(userProgress / currentTier.goal) * 100} className="h-2 flex-grow bg-black/20 dark:bg-white/20" indicatorClassName="bg-black dark:bg-white" />
                                <p className="text-xs font-bold text-black/90 dark:text-white/90 flex-shrink-0">{userProgress}/{currentTier.goal}</p>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex-shrink-0 flex items-center justify-center p-2 h-12 bg-muted/50">
                    {renderFooterContent()}
                </div>
            </Card>
        </div>
    );
};
