
'use server';

import { getAdminDb, getStorageAdmin, FieldValue } from '@/lib/firebase-admin';
import type { User, UserPlan } from '@/lib/types';
import { ApiServiceError } from '@/lib/errors';
import { checkAndUnlockAchievements } from './achievement-service';

const USERS_COLLECTION = 'users';

export async function getUserProfile(userId: string): Promise<User | null> {
  const adminDb = getAdminDb();
  const userDocRef = adminDb.collection(USERS_COLLECTION).doc(userId);
  const docSnap = await userDocRef.get();

  if (docSnap.exists) {
    return docSnap.data() as User;
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
  const adminDb = getAdminDb();
  const storageAdmin = getStorageAdmin();
  const userDocRef = adminDb.collection(USERS_COLLECTION).doc(userId);
  const updates: { [key: string]: any } = {};
  const urls: { photoURL?: string; coverPhotoURL?: string } = {};

  if (data.displayName) {
    updates.displayName = data.displayName;
  }

  if (data.profilePictureFile) {
    const file = data.profilePictureFile;
    const bucket = storageAdmin.bucket();
    const fileName = `avatars/${userId}/${file.name}`;
    const fileBuffer = await file.arrayBuffer();
    
    await bucket.file(fileName).save(Buffer.from(fileBuffer), {
      metadata: { contentType: file.type }
    });
    
    const [url] = await bucket.file(fileName).getSignedUrl({
      action: 'read',
      expires: '03-01-2500'
    });
    
    updates.photoURL = url;
    urls.photoURL = url;
  }

  if (data.profileCoverFile) {
    const file = data.profileCoverFile;
    const bucket = storageAdmin.bucket();
    const fileName = `covers/${userId}/profile_cover`;
    const fileBuffer = await file.arrayBuffer();
    
    await bucket.file(fileName).save(Buffer.from(fileBuffer), {
      metadata: { contentType: file.type }
    });
    
    const [url] = await bucket.file(fileName).getSignedUrl({
      action: 'read',
      expires: '03-01-2500'
    });
    
    updates.coverPhotoURL = url;
    urls.coverPhotoURL = url;
  }

  if (Object.keys(updates).length > 0) {
    await userDocRef.update(updates);
  }
  return urls;
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
  
  if (!userDoc.exists) throw new Error('User not found');

  const currentCredits = userDoc.data()?.credits || 0;
  if (currentCredits < amount) throw new Error('Insufficient credits');

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
    
    if (!userDoc.exists) throw new Error("User not found");

    let itemPrice = 0;
    let updateField: string;

    if (itemType === 'book') {
      const itemDocRef = adminDb.collection('globalBooks').doc(itemId);
      const itemDoc = await transaction.get(itemDocRef);
      
      if (!itemDoc.exists) throw new Error("Book not found in global store");
      
      itemPrice = itemDoc.data()?.price || 0;
      updateField = 'purchasedBookIds';
    } else {
      const itemDocRef = adminDb.collection('bookmarkMetadata').doc(itemId);
      const itemDoc = await transaction.get(itemDocRef);
      
      if (!itemDoc.exists) throw new Error("Bookmark not found in global store");
      
      itemPrice = itemDoc.data()?.price || 0;
      updateField = 'ownedBookmarkIds';
    }
    
    const userData = userDoc.data() as User;
    const userCredits = userData.credits || 0;
    
    if (userCredits < itemPrice) {
      throw new Error("Insufficient credits");
    }

    const currentItems = userData[updateField as keyof User] as string[] || [];
    
    transaction.update(userDocRef, { 
      credits: FieldValue.increment(-itemPrice),
      [updateField]: [...currentItems, itemId]
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
      throw new Error("User document does not exist.");
    }

    const user = userDoc.data() as User;
    const achievementDef = ACHIEVEMENTS.find(a => a.id === achievementId);
    
    if (!achievementDef) {
      throw new Error("Achievement definition not found.");
    }
    
    const userAchievement = user.achievements?.find(a => a.id === achievementId);
    
    if (!userAchievement) {
      throw new Error("Achievement not unlocked by user.");
    }

    const targetTier = achievementDef.tiers.find(t => t.level === tierLevel);
    
    if (!targetTier) {
      throw new Error("Target tier not found for this achievement.");
    }
    
    if (userAchievement.lastClaimedLevel >= tierLevel) {
      throw new Error("Reward for this tier has already been claimed.");
    }

    const statValue = user.stats?.[achievementDef.statToTrack] as number || 0;
    
    if (statValue < targetTier.goal) {
      throw new Error("Achievement requirements not met to claim this reward.");
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
    
    const newAchievements = user.achievements!.map(a => 
      a.id === achievementId ? { ...a, lastClaimedLevel: tierLevel } : a
    );

    transaction.update(userDocRef, {
      credits: FieldValue.increment(totalReward),
      achievements: newAchievements,
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
    
    // Asynchronously check for achievements without blocking the main operation
    checkAndUnlockAchievements(userId).catch(err => {
      console.error("Failed to check achievements after playlist add:", err);
    });
  } catch (error) {
    console.error("❌ Failed to record playlist add event:", error);
  }
}
