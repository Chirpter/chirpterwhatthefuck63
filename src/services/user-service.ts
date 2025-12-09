// src/services/user-service.ts
'use server';

import { getAdminDb, FieldValue } from '@/lib/firebase-admin';
import type { User, UserAchievement } from '@/lib/types';
import { ApiServiceError } from '@/lib/errors';
import { checkAndUnlockAchievements } from './achievement-service';
import { getLevelStyles } from '@/lib/utils';
import { ACHIEVEMENTS } from '@/lib/achievements';
import { convertTimestamps } from '@/lib/utils';


const USERS_COLLECTION = 'users';

/**
 * The definitive server-side function to either fetch an existing user profile
 * or create a new one for a newly authenticated user. Also handles daily login rewards.
 * @param userId - The UID of the authenticated user.
 * @returns An object containing the user profile and optional level up info.
 */
export async function createOrFetchUserProfile(userId: string): Promise<{ user: User, leveledUpInfo: { newLevel: number, oldLevel: number } | null }> {
    const adminDb = getAdminDb();
    const userDocRef = adminDb.collection(USERS_COLLECTION).doc(userId);

    return await adminDb.runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userDocRef);

        if (userDoc.exists) {
            const existingUser = userDoc.data() as User;
            const todayUtcString = new Date().toISOString().split('T')[0];

            if (existingUser.lastLoginDate === todayUtcString) {
                return { user: convertTimestamps(existingUser), leveledUpInfo: null };
            }

            const oldLevel = existingUser.level || 0;
            const newLevel = oldLevel + 1;
            
            const dailyLoginAchievement = ACHIEVEMENTS.find(a => a.id === 'daily_login');
            let reward = 10; // Default reward

            if (dailyLoginAchievement && dailyLoginAchievement.tiers[0]) {
                const tier = dailyLoginAchievement.tiers[0];
                reward = tier.creditReward;

                const userLevelTier = getLevelStyles(oldLevel, existingUser.plan).tier;
                if (tier.levelBonus && userLevelTier !== 'gold') {
                    reward += tier.levelBonus[userLevelTier] || 0;
                }
                if (existingUser.plan === 'pro' && tier.proBonus) {
                    reward += tier.proBonus;
                }
            }

            transaction.update(userDocRef, {
                lastLoginDate: todayUtcString,
                level: newLevel,
                'stats.level': newLevel,
                credits: FieldValue.increment(reward),
            });
            
            const updatedUser = { ...existingUser, level: newLevel, lastLoginDate: todayUtcString, credits: existingUser.credits + reward };
            return { user: convertTimestamps(updatedUser), leveledUpInfo: { newLevel, oldLevel } };
            
        } else {
            const { getAuth } = await import('firebase-admin/auth');
            const authUser = await getAuth().getUser(userId);

            const todayUtcString = new Date().toISOString().split('T')[0];
            const sanitizedDisplayName = authUser.displayName 
                ? authUser.displayName.replace(/[^\p{L}\p{N}\s]/gu, '').trim()
                : `User-${userId.substring(0, 5)}`;
            
            const newUser: User = {
                uid: userId,
                email: authUser.email,
                displayName: sanitizedDisplayName || `User-${userId.substring(0, 5)}`,
                photoURL: authUser.photoURL,
                coverPhotoURL: '',
                isAnonymous: authUser.disabled,
                plan: 'free',
                credits: 10,
                role: 'user',
                level: 1,
                lastLoginDate: todayUtcString,
                stats: { booksCreated: 0, piecesCreated: 0, vocabSaved: 0, flashcardsMastered: 0, coversGeneratedByAI: 0, bilingualBooksCreated: 0, vocabAddedToPlaylist: 0, level: 1 },
                achievements: [],
                purchasedBookIds: [],
                ownedBookmarkIds: [],
            };

            transaction.set(userDocRef, newUser);
            return { user: convertTimestamps(newUser), leveledUpInfo: { oldLevel: 0, newLevel: 1 } };
        }
    });
}


export async function getUserProfile(userId: string): Promise<User | null> {
  const adminDb = getAdminDb();
  const userDocRef = adminDb.collection(USERS_COLLECTION).doc(userId);
  const docSnap = await userDocRef.get();

  if (docSnap.exists) {
    return convertTimestamps(docSnap.data() as User);
  }
  return null;
}

export async function updateUserProfile(
  userId: string,
  data: {
    displayName?: string;
    profilePictureFile?: File;
    profileCoverFile?: File;
  }
): Promise<{ photoURL?: string; coverPhotoURL?: string }> {
  // This function involves file uploads and should be handled with care.
  // The current implementation is a placeholder and would need a robust
  // upload mechanism (e.g., to Firebase Storage) in a real app.
  return {};
}

export async function deductCredits(
  transaction: FirebaseFirestore.Transaction,
  userId: string,
  amount: number
): Promise<void> {
  if (amount <= 0) return;
  
  const adminDb = getAdminDb();
  const userDocRef = adminDb.collection(USERS_COLLECTION).doc(userId);
  const userDoc = await transaction.get(userDocRef);
  
  if (!userDoc.exists) throw new ApiServiceError('User not found', 'AUTH');

  const currentCredits = userDoc.data()?.credits || 0;
  if (currentCredits < amount) throw new ApiServiceError('Insufficient credits', 'VALIDATION');

  transaction.update(userDocRef, { 
    credits: FieldValue.increment(-amount) 
  });
}

export async function purchaseGlobalItem(
  userId: string, 
  itemId: string, 
  itemType: 'book' | 'bookmark'
) {
  const adminDb = getAdminDb();
  return adminDb.runTransaction(async (transaction) => {
    const userDocRef = adminDb.collection('users').doc(userId);
    const userDoc = await transaction.get(userDocRef);
    
    if (!userDoc.exists) throw new ApiServiceError("User not found", "AUTH");

    let itemPrice = 0;
    let updateField: string;

    if (itemType === 'book') {
      const itemDocRef = adminDb.collection('globalBooks').doc(itemId);
      const itemDoc = await transaction.get(itemDocRef);
      
      if (!itemDoc.exists) throw new ApiServiceError("Book not found in global store", "VALIDATION");
      
      itemPrice = itemDoc.data()?.price || 0;
      updateField = 'purchasedBookIds';
    } else {
      const itemDocRef = adminDb.collection('bookmarkMetadata').doc(itemId);
      const itemDoc = await transaction.get(itemDocRef);
      
      if (!itemDoc.exists) throw new ApiServiceError("Bookmark not found in global store", "VALIDATION");
      
      itemPrice = itemDoc.data()?.price || 0;
      updateField = 'ownedBookmarkIds';
    }
    
    const userData = userDoc.data() as User;
    const userCredits = userData.credits || 0;
    
    if (userCredits < itemPrice) {
      throw new ApiServiceError("Insufficient credits", "VALIDATION");
    }

    const currentItems = userData[updateField as keyof User] as string[] || [];
    
    if (currentItems.includes(itemId)) {
        return;
    }

    transaction.update(userDocRef, { 
      credits: FieldValue.increment(-itemPrice),
      [updateField]: FieldValue.arrayUnion(itemId)
    });
  });
}

export async function claimAchievement(
  userId: string, 
  achievementId: string, 
  tierLevel: number
) {
  const adminDb = getAdminDb();
  const userDocRef = adminDb.collection('users').doc(userId);

  return adminDb.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userDocRef);
    
    if (!userDoc.exists) {
      throw new ApiServiceError("User document does not exist.", "AUTH");
    }

    const user = userDoc.data() as User;
    const achievementDef = ACHIEVEMENTS.find(a => a.id === achievementId);
    
    if (!achievementDef) {
      throw new ApiServiceError("Achievement definition not found.", "VALIDATION");
    }
    
    const userAchievement = user.achievements?.find(a => a.id === achievementId);
    
    // In this model, the achievement might not exist yet if it's the first claim.
    const lastClaimedLevel = userAchievement?.lastClaimedLevel || 0;
    
    if (lastClaimedLevel >= tierLevel) {
      throw new ApiServiceError("Reward for this tier has already been claimed.", "VALIDATION");
    }

    const targetTier = achievementDef.tiers.find(t => t.level === tierLevel);
    
    if (!targetTier) {
      throw new ApiServiceError("Target tier not found for this achievement.", "VALIDATION");
    }
    
    const statValue = user.stats?.[achievementDef.statToTrack] as number || 0;
    
    if (statValue < targetTier.goal) {
      throw new ApiServiceError("Achievement requirements not met to claim this reward.", "VALIDATION");
    }

    let totalReward = targetTier.creditReward;
    
    if (achievementDef.category === 'daily') {
      const userLevelTier = getLevelStyles(user.level, user.plan).tier;
      const levelBonusDef = targetTier.levelBonus;
      
      if (levelBonusDef && userLevelTier !== 'gold') {
        totalReward += levelBonusDef[userLevelTier] || 0;
      }
      
      if (user.plan === 'pro') {
        totalReward += targetTier.proBonus || 0;
      }
    }
    
    let updatedAchievements = [...(user.achievements || [])];
    if (userAchievement) {
        updatedAchievements = updatedAchievements.map(a => 
            a.id === achievementId ? { ...a, lastClaimedLevel: tierLevel } : a
        );
    } else {
        updatedAchievements.push({
            id: achievementId,
            unlockedAt: new Date().toISOString(),
            lastClaimedLevel: tierLevel
        });
    }

    transaction.update(userDocRef, {
      credits: FieldValue.increment(totalReward),
      achievements: updatedAchievements,
    });
    
    return { reward: totalReward, newLevel: tierLevel };
  });
}


export async function recordPlaylistAdd(userId: string): Promise<void> {
  const adminDb = getAdminDb();
  const userDocRef = adminDb.collection('users').doc(userId);
  
  try {
    await userDocRef.update({
      'stats.vocabAddedToPlaylist': FieldValue.increment(1)
    });
    
    checkAndUnlockAchievements(userId).catch(err => {
      console.error("Failed to check achievements after playlist add:", err);
    });
  } catch (error) {
    console.error("❌ Failed to record playlist add event:", error);
  }
}
