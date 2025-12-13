
"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { useUser } from '@/contexts/user-context';
import { useToast } from '@/hooks/useToast';
import { claimAchievement } from '@/services/user-service';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui/icons';
import { AchievementCard } from '@/features/user/components/AchievementCard';
import { ACHIEVEMENTS } from '@/lib/achievements';
import { Skeleton } from '@/components/ui/skeleton';
import type { Achievement } from '@/lib/achievements';
import { SuperBadgeCard } from './SuperBadgeCard';
import type { Tier, TierTask } from '@/lib/types';
import { cn } from '@/lib/utils';
import { MissionIcon } from '@/features/user/components/MissionIcon';
import { SuperBadgeTrophy } from '@/features/user/components/SuperBadgeTrophy';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditIcon } from '@/components/ui/CreditIcon';

// Helper component for displaying errors
const ErrorView = ({ onRetry }: { onRetry: () => void }) => {
  const { t } = useTranslation('common');
  return (
    <Card className="mt-8 text-center">
      <CardHeader>
        <Icon name="AlertCircle" className="mx-auto h-12 w-12 text-destructive" />
        <CardTitle>{t('error')}</CardTitle>
        <p className="text-muted-foreground">{t('genericError')}</p>
        <Button onClick={onRetry} className="mt-4">{t('retry')}</Button>
      </CardHeader>
    </Card>
  );
};

export default function AchievementsView() {
  const { user, reloadUser } = useUser();
  const { t } = useTranslation(['achievements', 'common']);
  const { toast } = useToast();
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'missions' | 'badges'>('missions');
  const [error, setError] = useState<Error | null>(null);

  const handleClaim = useCallback(async (achievementId: string, tierLevel: number) => {
    if (!user) return;
    setClaimingId(achievementId);
    setError(null);
    try {
      const { reward } = await claimAchievement(user.uid, achievementId, tierLevel);
      toast({
        title: t('claimSuccess.title'),
        description: t('claimSuccess.description', { count: reward }),
      });
      // Force a reload of user data to reflect new credits and claimed status
      await reloadUser();
    } catch (error) {
      console.error("Failed to claim achievement:", error);
      setError(error as Error); // Set the error state to show the ErrorView
    } finally {
      setClaimingId(null);
    }
  }, [user, reloadUser, t, toast]);

  const { dailyAchievements, otherAchievements } = useMemo(() => {
    const daily = ACHIEVEMENTS.filter(a => a.category === 'daily');
    const others = ACHIEVEMENTS.filter(a => a.category === 'other');
    return { dailyAchievements: daily, otherAchievements: others };
  }, []);
  
  const handleRetry = useCallback(() => {
    setError(null);
    reloadUser();
  }, [reloadUser]);

  if (error) {
      return <ErrorView onRetry={handleRetry} />
  }

  if (!user) {
    return (
        <div className="space-y-8">
            <h2 className="text-xl md:text-2xl font-headline font-semibold">{t('title')}</h2>
            <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 2xl:columns-6 gap-4 space-y-4">
                {[...Array(12)].map((_, i) => (
                    <Skeleton key={i} className="h-48 w-full rounded-lg" />
                ))}
            </div>
        </div>
    );
  }
  
  const userAchievementsMap = new Map(user.achievements?.map(a => [a.id, a]));

  const bookwormTiers: Tier[] = [
    { name: 'Newbie', goal: 2, color: 'from-slate-400 to-slate-600', trophyColor: 'text-slate-500', tasks: [
        { type: 'ref', id: 'create_books', goal: 10 },
        { type: 'ref', id: 'login_streak', goal: 7 },
    ]},
    { name: 'Bronze', goal: 0, color: 'from-amber-600 to-yellow-800', trophyColor: 'text-amber-400', tasks: [], isComingSoon: true },
    { name: 'Silver', goal: 0, color: 'from-sky-400 to-gray-500', trophyColor: 'text-sky-300', tasks: [], isComingSoon: true },
    { name: 'Gold', goal: 0, color: 'from-amber-400 to-yellow-500', trophyColor: 'text-amber-300', tasks: [], isComingSoon: true },
    { name: 'Diamond', goal: 0, color: 'from-sky-300 to-indigo-400', trophyColor: 'text-sky-200', tasks: [], isComingSoon: true },
  ];
  
  const bookwormProgress = useMemo(() => {
      let completedTasks = 0;
      for (const tier of bookwormTiers) {
          if (tier.isComingSoon) break;
          let tierCompletedTasks = 0;
          for (const task of tier.tasks) {
              if (task.type === 'ref') {
                  const achievement = ACHIEVEMENTS.find(a => a.id === task.id);
                  if (achievement) {
                      const userStat = user.stats?.[achievement.statToTrack] || 0;
                      if (userStat >= task.goal) {
                          tierCompletedTasks++;
                      }
                  }
              } else {
                  if (task.current >= task.goal) {
                      tierCompletedTasks++;
                  }
              }
          }
          if (tier.goal > 0 && tierCompletedTasks >= tier.goal) {
              completedTasks += tier.goal;
          } else {
              completedTasks += tierCompletedTasks;
              break; 
          }
      }
      return completedTasks;
  }, [user.stats, bookwormTiers]);

  
  const renderAchievements = (list: Achievement[]) => {
     const sortedList = [...list].sort((a, b) => {
        const aData = userAchievementsMap.get(a.id);
        const aIsClaimable = aData && aData.unlockedAt && aData.lastClaimedLevel < (a.tiers.find(t => t.level === aData.lastClaimedLevel + 1)?.level || Infinity);
        const bData = userAchievementsMap.get(b.id);
        const bIsClaimable = bData && bData.unlockedAt && bData.lastClaimedLevel < (b.tiers.find(t => t.level === bData.lastClaimedLevel + 1)?.level || Infinity);

        if (aIsClaimable && !bIsClaimable) return -1;
        if (!aIsClaimable && bIsClaimable) return 1;
        return 0;
    });

    return (
      <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 2xl:columns-6 gap-4 space-y-4">
        {sortedList.map(achievement => (
            <AchievementCard 
                key={achievement.id}
                achievement={achievement}
                user={user}
                onClaim={() => {
                  const currentTier = achievement.tiers.find(t => t.level === ((userAchievementsMap.get(achievement.id)?.lastClaimedLevel || 0) + 1));
                  if (currentTier) {
                    handleClaim(achievement.id, currentTier.level)
                  }
                }}
                isClaiming={claimingId === achievement.id}
            />
        ))}
      </div>
    );
  }


  return (
    <div className="space-y-8">
        <div className="flex justify-start items-center gap-4">
            <h2 className="text-xl md:text-2xl font-headline font-semibold">{t('title')}</h2>
             <div className="flex items-center gap-2">
                <button
                    onClick={() => setActiveTab('missions')}
                    className={cn("lib-tab-button", activeTab === 'missions' && 'active')}
                >
                    <div className="lib-tab-content">
                        <div className="lib-tab-text"><p className="font-semibold">{t('tabs.missions')}</p></div>
                        <div className="lib-tab-artifact-wrapper"><MissionIcon className="mission-artifact" /></div>
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('badges')}
                    className={cn("lib-tab-button", activeTab === 'badges' && 'active')}
                >
                    <div className="lib-tab-content">
                        <div className="lib-tab-text"><p className="font-semibold">{t('tabs.superBadges')}</p></div>
                        <div className="lib-tab-artifact-wrapper"><SuperBadgeTrophy className="super-badge-artifact" /></div>
                    </div>
                </button>
            </div>
        </div>

        {activeTab === 'missions' && (
            <>
                <div>
                    <h3 className="text-lg font-headline font-semibold mb-4 border-b pb-2">{t('dailyTasks')}</h3>
                    {renderAchievements(dailyAchievements)}
                </div>
                <div>
                    <h3 className="text-lg font-headline font-semibold mb-4 border-b pb-2">{t('milestones')}</h3>
                    {renderAchievements(otherAchievements)}
                </div>
            </>
        )}

        {activeTab === 'badges' && (
            <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 2xl:columns-6 gap-4 space-y-4">
                <SuperBadgeCard 
                    name="Bookworm"
                    description="A true lover of literature and creation."
                    icon="BookHeart"
                    currentProgress={bookwormProgress}
                    tiers={bookwormTiers}
                />
            </div>
        )}
    </div>
  );
}
