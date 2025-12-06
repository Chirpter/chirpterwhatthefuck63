
'use server';

import { getAdminDb } from '@/lib/firebase-admin';
import type { User, UserAchievement } from '@/lib/types';
import { ACHIEVEMENTS } from '@/lib/achievements';

/**
 * @fileoverview Dedicated service for managing achievement logic.
 * This centralizes all achievement checks and unlocks.
 */

/**
 * Checks a user's stats against all milestone achievements and unlocks any that are newly met.
 * This function is designed to be called after any action that might update a tracked statistic.
 * It runs in a transaction to ensure data consistency.
 * @param userId The UID of the user to check.
 */
export async function checkAndUnlockAchievements(userId: string): Promise<void> {
    const adminDb = getAdminDb();
    const userDocRef = adminDb.collection('users').doc(userId);
    
    try {
        await adminDb.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userDocRef);
            if (!userDoc.exists) {
                console.warn(`[AchievementService] User document ${userId} not found. Skipping achievement check.`);
                return;
            }

            const user = userDoc.data() as User;
            const userStats = user.stats || { booksCreated: 0, piecesCreated: 0, vocabSaved: 0, flashcardsMastered: 0, coversGeneratedByAI: 0, bilingualBooksCreated: 0, vocabAddedToPlaylist: 0, level: 0 };
            let updatedAchievements = [...(user.achievements || [])];
            
            const unlockedIds = new Set(updatedAchievements.map(a => a.id));
            let hasChanges = false;

            // Iterate through milestone achievements only
            for (const achievement of ACHIEVEMENTS) {
                if (achievement.category !== 'other') continue;
                
                const userAchievement = updatedAchievements.find(a => a.id === achievement.id);
                const lastClaimedLevel = userAchievement?.lastClaimedLevel || 0;

                // Find the next tier the user is eligible for
                const nextTier = achievement.tiers.find(t => t.level === lastClaimedLevel + 1);

                if (nextTier) {
                    const statValue = userStats[achievement.statToTrack] as number || 0;
                    
                    // Check if the user has met the goal for the next tier
                    if (statValue >= nextTier.goal) {
                        if (!userAchievement) {
                            // First time unlocking this achievement line
                            const newAchievementRecord: UserAchievement = {
                                id: achievement.id,
                                unlockedAt: new Date().toISOString(),
                                lastClaimedLevel: 0, // Not claimed yet, just unlocked
                            };
                            updatedAchievements.push(newAchievementRecord);
                            hasChanges = true;
                        }
                        // The achievement is now claimable, but no data change is needed until they claim it.
                        // The client-side will see the stat meets the goal and show the 'Claim' button.
                    }
                }
            }

            if (hasChanges) {
                transaction.update(userDocRef, { achievements: updatedAchievements });
            }
        });
    } catch (error) {
        console.error("[AchievementService] Error checking/unlocking achievements in transaction:", error);
        // Do not re-throw; this is a background task and should not fail the primary operation.
    }
}
