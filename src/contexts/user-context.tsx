
"use client";

import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback, useRef } from 'react';
import type { User } from '@/lib/types';
import { useAuth } from '@/contexts/auth-context';
import { doc, getDoc, onSnapshot, setDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logAuthEvent } from '@/lib/analytics';
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

// --- HELPER FUNCTIONS MOVED HERE FOR COHESION ---

/**
 * Handles the daily login logic, including leveling up and awarding credits.
 * This is now a self-contained function within the UserContext.
 */
async function handleDailyLogin(userId: string, currentUserData: User): Promise<{ leveledUp: boolean, newLevel: number, oldLevel: number, reward: number } | null> {
  const todayUtcString = new Date().toISOString().split('T')[0];

  // If already logged in today, do nothing.
  if (currentUserData.lastLoginDate === todayUtcString) {
    return null;
  }

  const userDocRef = doc(db, 'users', userId);
  const oldLevel = currentUserData.level || 0;
  const newLevel = oldLevel + 1;

  // Find the daily login achievement definition
  const dailyLoginAchievement = ACHIEVEMENTS.find(a => a.id === 'daily_login');
  if (!dailyLoginAchievement || dailyLoginAchievement.tiers.length === 0) {
    console.warn("Daily login achievement not configured. Skipping reward.");
    return null;
  }

  const tier = dailyLoginAchievement.tiers[0];
  let reward = tier.creditReward; // Base reward

  // Calculate level bonus
  const userLevelTier = getLevelStyles(oldLevel, currentUserData.plan).tier;
  if (tier.levelBonus && userLevelTier !== 'gold') {
      reward += tier.levelBonus[userLevelTier] || 0;
  }
  
  // Calculate pro bonus
  if (currentUserData.plan === 'pro' && tier.proBonus) {
      reward += tier.proBonus;
  }

  // Perform the update in a transaction for atomicity
  await updateDoc(userDocRef, {
    lastLoginDate: todayUtcString,
    level: newLevel,
    'stats.level': newLevel,
    credits: increment(reward),
  });

  // After successfully updating, check for any milestone achievements
  await checkAndUnlockAchievements(userId);

  return { leveledUp: true, newLevel, oldLevel, reward };
}


async function createUserProfile(authUserData: FirebaseUser): Promise<User> {
  const userDocRef = doc(db, 'users', authUserData.uid);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayUtcString = today.toISOString().split('T')[0];

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
    stats: {
      booksCreated: 0, 
      piecesCreated: 0, 
      vocabSaved: 0, 
      flashcardsMastered: 0,
      coversGeneratedByAI: 0, 
      bilingualBooksCreated: 0, 
      vocabAddedToPlaylist: 0, 
      level: 1,
    },
    achievements: [],
    purchasedBookIds: [],
    ownedBookmarkIds: [],
  };

  await setDoc(userDocRef, newUser);
  return newUser;
}


// --- PROVIDER COMPONENT ---

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authUser, loading: authLoading } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [levelUpInfo, setLevelUpInfo] = useState<LevelUpInfo | null>(null);
  const authUserRef = useRef(authUser);

  // Tracks if a daily login check is in progress to prevent duplicates
  const dailyLoginInProgress = useRef(false);

  const fetchOrCreateUser = useCallback(async (currentAuthUser: FirebaseUser) => {
    setLoading(true);
    setError(null);
    
    try {
      const userDocRef = doc(db, 'users', currentAuthUser.uid);
      const docSnap = await getDoc(userDocRef);
      
      let userData: User;
      
      if (docSnap.exists()) {
        userData = docSnap.data() as User;
        setUser(userData); // Set user immediately for faster UI response
      } else {
        // User doesn't exist, create new profile. The onSnapshot will pick it up.
        userData = await createUserProfile(currentAuthUser);
      }
      
      // ✅ SIMPLIFIED: Daily login logic is now cleaner and self-contained
      if (!dailyLoginInProgress.current) {
        dailyLoginInProgress.current = true;
        try {
          const loginResult = await handleDailyLogin(currentAuthUser.uid, userData);
          if (loginResult?.leveledUp) {
            setLevelUpInfo({ newLevel: loginResult.newLevel, oldLevel: loginResult.oldLevel });
          }
        } catch (err) {
          console.warn('[USER_CTX] Daily login logic failed (non-critical):', err);
        } finally {
          dailyLoginInProgress.current = false;
        }
      }
      
    } catch (err) {
      console.error('[USER_CTX] 🚨 Error in fetchOrCreateUser:', err);
      setError('Failed to load your profile. Some features may be limited.');
      logAuthEvent('auth_error', { error: (err as Error).message || 'unknown_profile_error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // If auth is still loading, do nothing yet.
    if (authLoading) {
        setLoading(true);
        return;
    }

    // When auth is done:
    if (!authUser) {
      setUser(null);
      setLoading(false);
      setError(null);
      dailyLoginInProgress.current = false; // Reset on logout
      return;
    }

    // Set up real-time listener for the logged-in user
    const userDocRef = doc(db, 'users', authUser.uid);
    const unsubscribe = onSnapshot(userDocRef, 
      (docSnap) => {
        if (docSnap.exists()) {
          const userData = docSnap.data() as User;
          setUser(userData);
          setError(null);
          
          // Initial fetch/create on first snapshot
          if (authUserRef.current?.uid !== authUser.uid) {
             fetchOrCreateUser(authUser);
          }
          
        } else {
          // If the doc doesn't exist, it means we need to create it.
          fetchOrCreateUser(authUser);
        }
        setLoading(false);
      }, 
      (err) => {
        console.error("[USER_CTX] 🚨 Snapshot listener error:", err);
        setError("Failed to listen for profile updates.");
        setLoading(false);
      }
    );
    
    authUserRef.current = authUser;

    return () => unsubscribe();
  }, [authUser, authLoading, fetchOrCreateUser]);
  
  const clearLevelUpInfo = () => setLevelUpInfo(null);
  
  const reloadUser = useCallback(async () => {
    if (authUserRef.current) {
      await fetchOrCreateUser(authUserRef.current);
    }
  }, [fetchOrCreateUser]);
  
  const retryUserFetch = useCallback(() => {
    if (authUserRef.current) {
      fetchOrCreateUser(authUserRef.current);
    }
  }, [fetchOrCreateUser]);

  const value = {
    user,
    loading: authLoading || loading,
    error,
    levelUpInfo,
    clearLevelUpInfo,
    reloadUser,
    retryUserFetch
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
