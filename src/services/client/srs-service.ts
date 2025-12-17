
// src/services/client/srs-service.ts

/**
 * @fileoverview Spaced Repetition System (SRS) Service.
 *
 * ARCHITECTURAL NOTE:
 * This file contains the core, pure logic for calculating SRS updates.
 * This logic is executed on the CLIENT, interacting with the local database (IndexedDB)
 * for immediate UI feedback and offline use.
 *
 * To prevent cheating for achievements (e.g., "Memory Master"), the final step of
 * mastering a word calls a secure server-side function for validation before
 * awarding progress.
 */
'use client';
import { getLocalDbForUser } from './local-database';
import type { VocabularyItem, SrsState, User } from '@/lib/types';
import { POINT_THRESHOLDS, POINT_VALUES, STREAK_BONUSES } from '@/lib/constants';
import { removeUndefinedProps } from '../../lib/utils';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { checkAndUnlockAchievements } from '../server/achievement-service';

// --- NEW SRS Algorithm Constants (Point-based) ---
const MIN_POINTS = 0; // Start at 0 points
const MAX_POINTS = 5000; // Define a max cap for points

// Function to map points to an SRS state
function stateFromPoints(points: number): SrsState {
  if (points >= POINT_THRESHOLDS.LONG_TERM) return 'long-term';
  if (points >= POINT_THRESHOLDS.SHORT_TERM) return 'short-term';
  if (points >= POINT_THRESHOLDS.LEARNING) return 'learning';
  return 'new';
}

function getStreakBonus(streak: number): number {
    if (streak >= 6) return STREAK_BONUSES[5]; // Max bonus
    if (streak >= 1) return STREAK_BONUSES[streak - 1] || 0; // Safe access
    return 0;
}

// Function to calculate the next due date based on the new point system
function intervalFromPoints(points: number): number {
  if (points < POINT_THRESHOLDS.LEARNING) return 1; // Review new words the next day
  if (points < POINT_THRESHOLDS.SHORT_TERM) return 3; // Learning words every 3 days
  if (points < POINT_THRESHOLDS.LONG_TERM) return 7; // Short-term words every week
  
  // Long-term words are reviewed based on their score beyond the threshold
  const daysBeyondMastery = (points - POINT_THRESHOLDS.LONG_TERM) / 100;
  return Math.min(30, 14 + Math.floor(daysBeyondMastery)); 
}


/**
 * A placeholder for a secure server-side function (e.g., Genkit Flow).
 * This function would validate the mastery claim before updating the official user stats.
 * For example, it could check the timestamp to prevent users from mastering
 * hundreds of words in a minute.
 * @param userId The user's ID.
 * @param itemId The ID of the item claimed to be mastered.
 */
async function validateAndRecordMastery(userId: string, itemId: string): Promise<void> {
    console.log(`[Server Validation] User ${userId} claims mastery of item ${itemId}. In a real app, this would be validated.`);
    // 1. (Server-side) Check for rapid-fire submissions.
    // 2. (Server-side) Update user stats securely.
    const userDocRef = doc(db, 'users', userId);
    await updateDoc(userDocRef, { 'stats.flashcardsMastered': increment(1) });
    // 3. (Server-side) Check for achievement unlocks.
    await checkAndUnlockAchievements(userId);
}

/**
 * Updates a vocabulary item based on the SRS algorithm.
 * This is the core logic engine for the flashcard feature.
 * @param user - The authenticated user object.
 * @param itemId - The ID of the vocabulary item to update.
 * @param action - The result of the user's interaction.
 * @returns The updated VocabularyItem.
 */
export async function updateSrsItem(user: User, itemId: string, action: 'remembered' | 'forgot' | 'tested_correct' | 'tested_incorrect'): Promise<VocabularyItem> {
  const localDb = getLocalDbForUser(user.uid);

  try {
    const item = await localDb.vocabulary.get(itemId);
    if (!item) {
      throw new Error(`Vocabulary item with ID ${itemId} not found for user ${user.uid}.`);
    }

    // --- SRS Calculation ---
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    let currentPoints = item.memoryStrength || MIN_POINTS;
    let updatedFields: Partial<VocabularyItem> = {};

    // Do not penalize long-term memory words for incorrect test answers
    if (item.srsState === 'long-term' && action === 'tested_incorrect') {
        updatedFields = {
            lastReviewed: today,
            attempts: (item.attempts || 0) + 1,
        };
    } else if (action === 'tested_correct') {
         updatedFields = {
            lastReviewed: today,
            attempts: (item.attempts || 0) + 1,
        };
    } else { // Handle 'remembered' and 'forgot' for non-long-term items
        let newStreak = item.streak || 0;
        let pointChange = 0;
        const currentState = stateFromPoints(currentPoints);

        if (action === 'remembered') {
            pointChange += POINT_VALUES[currentState].remembered;
            newStreak += 1;
            pointChange += getStreakBonus(newStreak);
        } else { // 'forgot'
            pointChange += POINT_VALUES[currentState].forgot;
            newStreak = 0; // Reset streak on failure
        }
        
        const newPoints = Math.max(MIN_POINTS, Math.min(MAX_POINTS, currentPoints + pointChange));
        
        const newDueDate = new Date(today.getTime());
        const newInterval = intervalFromPoints(newPoints);
        newDueDate.setDate(today.getDate() + newInterval);
        
        updatedFields = {
            memoryStrength: newPoints,
            srsState: stateFromPoints(newPoints),
            streak: newStreak,
            attempts: (item.attempts || 0) + 1,
            lastReviewed: today,
            dueDate: newDueDate,
        };
    }
    
    const finalItem = { ...item, ...updatedFields };
    await localDb.vocabulary.update(itemId, removeUndefinedProps(updatedFields));
    
    // Check for mastery achievement if state transitions to 'long-term'
    if (updatedFields.srsState === 'long-term' && item.srsState !== 'long-term') {
      await validateAndRecordMastery(user.uid, itemId);
    }
    
    return finalItem;

  } catch (error) {
    console.error(`Error updating SRS for item ${itemId}:`, error);
    throw new Error('Failed to update vocabulary progress.');
  }
}
