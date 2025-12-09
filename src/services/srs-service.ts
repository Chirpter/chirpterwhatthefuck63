
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
import { LEARNING_THRESHOLD_DAYS, MASTERED_THRESHOLD_DAYS } from '@/lib/constants';
import { calculateVirtualMS } from '@/lib/utils';
import { removeUndefinedProps } from '../lib/utils';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { checkAndUnlockAchievements } from './achievement-service';

// --- SRS Algorithm Constants ---
const MIN_MS = 1; // Minimum Memory Strength
const BASE_GAIN = 2.3; // Increased from 2.5 → 2.3
const BASE_PENALTY = 1.5; // Decreased from 2.0 → 1.5
const MASTERED_TEST_PENALTY = 5; // Penalty in days if a mastered word is failed

// Streak Bonus System: 1.2x, 2.3x, 3.6x, 5.0x
function getStreakBonus(streak: number): number {
  if (streak >= 4) return 5.0;    // Super strong
  if (streak >= 3) return 3.6;    // Very strong
  if (streak >= 2) return 2.3;    // Quite strong  
  if (streak >= 1) return 1.2;    // Light bonus
  return 1.0;
}

// Trust Factor Adjustment
function getTrustFactor(elapsed: number, predicted: number): number {
  const trustFactor = elapsed / predicted;
  
  if (trustFactor < 0.5) return 0.8;    // Early review → less reward
  if (trustFactor > 1.5) return 1.2;    // Late review → more reward
  return 1.0;                           // On time → normal
}

// Function to map memory strength (in days) to a new interval
function intervalFromMs(ms: number): number {
  if (ms <= 1) return 1;
  // Exponential growth for the interval
  const interval = Math.floor(0.5 * Math.pow(ms, 1.3));
  return Math.max(1, interval);
}

// Function to map memory strength to an SRS state
function stateFromMs(ms: number): SrsState {
  if (ms === 0) return 'new';
  if (ms >= MASTERED_THRESHOLD_DAYS) return 'long-term';
  if (ms >= LEARNING_THRESHOLD_DAYS) return 'short-term';
  return 'learning';
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

    let currentMs = calculateVirtualMS(item, today);
    
    if (!isFinite(currentMs) || currentMs < 0) {
        console.warn(`Invalid MS detected: ${currentMs}, resetting to 1`);
        currentMs = 1;
    }
    
    let updatedFields: Partial<VocabularyItem> = {};
    
    if (item.srsState === 'long-term' && (action === 'tested_correct' || action === 'tested_incorrect')) {
        if (action === 'tested_incorrect') {
            currentMs = MASTERED_THRESHOLD_DAYS - MASTERED_TEST_PENALTY;
        } else {
            currentMs = Math.max(MASTERED_THRESHOLD_DAYS, currentMs + 15);
        }
        const newDueDate = new Date(today.getTime());
        const newInterval = intervalFromMs(currentMs);
        newDueDate.setDate(today.getDate() + newInterval);
        
        updatedFields = {
            memoryStrength: currentMs,
            srsState: stateFromMs(currentMs),
            lastReviewed: today,
            dueDate: newDueDate,
        };
    } else {
        let newStreak = item.streak || 0;
        const totalAttempts = (item.attempts || 0) + 1;
        
        if (action === 'remembered' || action === 'tested_correct') {
            const lastReview = item.lastReviewed ? new Date((item.lastReviewed as any).seconds ? (item.lastReviewed as any).seconds * 1000 : item.lastReviewed) : today;
            const dueDate = item.dueDate ? new Date((item.dueDate as any).seconds ? (item.dueDate as any).seconds * 1000 : item.dueDate) : today;
            const elapsed = Math.max(0, (today.getTime() - lastReview.getTime()) / (1000 * 3600 * 24));
            const predicted_span = item.srsState === 'new' ? 1 : Math.max(1, (dueDate.getTime() - lastReview.getTime()) / (1000 * 3600 * 24));
            
            const trustFactor = getTrustFactor(elapsed, predicted_span);
            
            const streakBonus = getStreakBonus(newStreak + 1);
            
            newStreak += 1;
            
            const gain = BASE_GAIN * trustFactor * streakBonus;
            currentMs += gain;

        } else {
            const lastReview = item.lastReviewed ? new Date((item.lastReviewed as any).seconds ? (item.lastReviewed as any).seconds * 1000 : item.lastReviewed) : today;
            const dueDate = item.dueDate ? new Date((item.dueDate as any).seconds ? (item.dueDate as any).seconds * 1000 : item.dueDate) : today;
            const elapsed = Math.max(0, (today.getTime() - lastReview.getTime()) / (1000 * 3600 * 24));
            const predicted_span = item.srsState === 'new' ? 1 : Math.max(1, (dueDate.getTime() - lastReview.getTime()) / (1000 * 3600 * 24));
            
            const trustFactor = getTrustFactor(elapsed, predicted_span);
                
            let penaltyFactor = 1.0;
            if (trustFactor < 0.5) penaltyFactor = 1.6; 
            else if (trustFactor > 1.5) penaltyFactor = 0.7;

            const penalty = BASE_PENALTY * penaltyFactor;
            currentMs = Math.max(MIN_MS, currentMs - penalty);
            newStreak = 0;
        }
        
        if (!isFinite(currentMs) || currentMs < 0) {
            console.warn(`Final MS invalid: ${currentMs}, resetting to ${MIN_MS}`);
            currentMs = MIN_MS;
        }
        
        const newDueDate = new Date(today.getTime());
        const newInterval = intervalFromMs(currentMs);
        newDueDate.setDate(today.getDate() + newInterval);
        
        updatedFields = {
            memoryStrength: currentMs,
            srsState: stateFromMs(currentMs),
            streak: newStreak,
            attempts: totalAttempts,
            lastReviewed: today,
            dueDate: newDueDate,
        };
    }
    
    if (!isFinite(currentMs) || currentMs < 0) {
        currentMs = MIN_MS;
        updatedFields.memoryStrength = currentMs;
        updatedFields.srsState = stateFromMs(currentMs);
    }
    
    const finalItem = { ...item, ...updatedFields };
    await localDb.vocabulary.update(itemId, removeUndefinedProps(updatedFields));
    
    if (updatedFields.srsState === 'long-term' && item.srsState !== 'long-term') {
      await validateAndRecordMastery(user.uid, itemId);
    }
    
    return finalItem;

  } catch (error) {
    console.error(`Error updating SRS for item ${itemId}:`, error);
    throw new Error('Failed to update vocabulary progress.');
  }
}
