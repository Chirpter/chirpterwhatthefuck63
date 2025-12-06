
"use client";

import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback, useRef } from 'react';
import type { User } from '@/lib/types';
import { useAuth } from '@/contexts/auth-context';
import { doc, getDoc, onSnapshot, setDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { User as FirebaseUser } from 'firebase/auth';
import { getLevelStyles } from '@/lib/utils';
import { ACHIEVEMENTS } from '@/lib/achievements';
import { checkAndUnlockAchievements } from '@/services/achievement-service';

export interface LevelUpInfo {
  newLevel: number;
  oldLevel: number;
}

interface UserContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  levelUpInfo: LevelUpInfo | null;
  clearLevelUpInfo: () => void;
  reloadUser: () => Promise<void>;
  retryUserFetch: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

async function handleDailyLogin(userId: string, currentUserData: User): Promise<{ leveledUp: boolean, newLevel: number, oldLevel: number, reward: number } | null> {
  const todayUtcString = new Date().toISOString().split('T')[0];

  if (currentUserData.lastLoginDate === todayUtcString) {
    return null;
  }

  const userDocRef = doc(db, 'users', userId);
  const oldLevel = currentUserData.level || 0;
  const newLevel = oldLevel + 1;

  const dailyLoginAchievement = ACHIEVEMENTS.find(a => a.id === 'daily_login');
  if (!dailyLoginAchievement || dailyLoginAchievement.tiers.length === 0) {
    return null;
  }

  const tier = dailyLoginAchievement.tiers[0];
  let reward = tier.creditReward;

  const userLevelTier = getLevelStyles(oldLevel, currentUserData.plan).tier;
  if (tier.levelBonus && userLevelTier !== 'gold') {
      reward += tier.levelBonus[userLevelTier] || 0;
  }
  
  if (currentUserData.plan === 'pro' && tier.proBonus) {
      reward += tier.proBonus;
  }

  await updateDoc(userDocRef, {
    lastLoginDate: todayUtcString,
    level: newLevel,
    'stats.level': newLevel,
    credits: increment(reward),
  });

  await checkAndUnlockAchievements(userId);

  return { leveledUp: true, newLevel, oldLevel, reward };
}

async function createOrFetchUserProfile(authUserData: FirebaseUser): Promise<{ user: User, leveledUpInfo: LevelUpInfo | null }> {
    const userDocRef = doc(db, 'users', authUserData.uid);
    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists()) {
        const existingUser = docSnap.data() as User;
        const loginResult = await handleDailyLogin(authUserData.uid, existingUser);
        if (loginResult) {
          return {
            user: { ...existingUser, level: loginResult.newLevel, lastLoginDate: new Date().toISOString().split('T')[0] },
            leveledUpInfo: { newLevel: loginResult.newLevel, oldLevel: loginResult.oldLevel }
          };
        }
        return { user: existingUser, leveledUpInfo: null };
    } else {
        const todayUtcString = new Date().toISOString().split('T')[0];
        const sanitizedDisplayName = authUserData.displayName 
            ? authUserData.displayName.replace(/[^\p{L}\p{N}\s]/gu, '').trim()
            : `User-${authUserData.uid.substring(0, 5)}`;
            
        const newUser: User = {
            uid: authUserData.uid,
            email: authUserData.email, 
            displayName: sanitizedDisplayName || `User-${authUserData.uid.substring(0, 5)}`,
            photoURL: authUserData.photoURL,
            coverPhotoURL: '',
            isAnonymous: authUserData.isAnonymous || false,
            plan: 'free',
            credits: authUserData.isAnonymous ? 5 : 10,
            role: 'user',
            level: 1,
            lastLoginDate: todayUtcString,
            stats: { booksCreated: 0, piecesCreated: 0, vocabSaved: 0, flashcardsMastered: 0, coversGeneratedByAI: 0, bilingualBooksCreated: 0, vocabAddedToPlaylist: 0, level: 1 },
            achievements: [],
            purchasedBookIds: [],
            ownedBookmarkIds: [],
        };

        await setDoc(userDocRef, newUser);
        return { user: newUser, leveledUpInfo: { oldLevel: 0, newLevel: 1 } };
    }
}

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authUser, loading: authLoading } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [levelUpInfo, setLevelUpInfo] = useState<LevelUpInfo | null>(null);

  const fetchUser = useCallback(async (currentAuthUser: FirebaseUser) => {
    setLoading(true);
    setError(null);
    try {
      const { user: userProfile, leveledUpInfo: levelUpData } = await createOrFetchUserProfile(currentAuthUser);
      setUser(userProfile);
      if (levelUpData) {
          setLevelUpInfo(levelUpData);
      }
    } catch (err) {
      console.error('[USER_CTX] Error fetching user profile:', err);
      setError('Failed to load your profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (authUser) {
      // Fetch user profile when auth state is resolved
      fetchUser(authUser);

      // And set up a real-time listener for profile updates
      const unsubscribe = onSnapshot(doc(db, 'users', authUser.uid), (docSnap) => {
        if (docSnap.exists()) {
          setUser(docSnap.data() as User);
        }
      }, (err) => {
        console.error("[USER_CTX] Snapshot listener error:", err);
        setError("Failed to listen for profile updates.");
      });
      
      return () => unsubscribe();
    } else {
      // User logged out
      setUser(null);
      setLoading(false);
    }
  }, [authUser, authLoading, fetchUser]);
  
  const clearLevelUpInfo = () => setLevelUpInfo(null);
  
  const reloadUser = useCallback(async () => {
    if (authUser) {
      await fetchUser(authUser);
    }
  }, [authUser, fetchUser]);

  const value = {
    user,
    loading: authLoading || loading,
    error,
    levelUpInfo,
    clearLevelUpInfo,
    reloadUser,
    retryUserFetch: reloadUser, // Now they are the same
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export const useUser = (): UserContextType => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
