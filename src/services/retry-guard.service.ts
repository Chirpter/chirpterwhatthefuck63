// src/services/retry-guard.service.ts
'use server';

import { getAdminDb, FieldValue } from '@/lib/firebase-admin';

/**
 * SECURITY-CRITICAL: Prevents duplicate retry attempts
 * - Race condition protection
 * - Idempotent operations
 * - Auto-cleanup of expired locks
 */

interface RetryLock {
  itemId: string;
  userId: string;
  lockType: 'content' | 'cover';
  expiresAt: any;
  createdAt: any;
  processId: string; // For debugging
}

/**
 * Try to acquire a retry lock (atomic)
 * Returns true if lock acquired, false if already locked
 */
export async function acquireRetryLock(
  userId: string,
  itemId: string,
  lockType: 'content' | 'cover',
  ttlSeconds: number = 300 // 5 minutes default
): Promise<boolean> {
  const adminDb = getAdminDb();
  const lockId = `${userId}_${itemId}_${lockType}`;
  const lockRef = adminDb.collection('retryLocks').doc(lockId);
  const processId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  return await adminDb.runTransaction(async (t) => {
    const lockDoc = await t.get(lockRef);
    const now = Date.now();
    
    if (lockDoc.exists) {
      const lockData = lockDoc.data() as RetryLock;
      const expiresAt = lockData.expiresAt.toMillis();
      
      // SECURITY: Lock still valid, reject
      if (expiresAt > now) {
        console.warn(
          `[RetryGuard] Lock active for ${lockId}, expires in ${Math.ceil((expiresAt - now) / 1000)}s (process: ${lockData.processId})`
        );
        return false;
      }
      
      console.log(`[RetryGuard] Expired lock found for ${lockId}, acquiring new lock`);
    }
    
    // Create or update lock with new expiry
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    
    t.set(
      lockRef,
      {
        itemId,
        userId,
        lockType,
        expiresAt,
        processId,
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    
    console.log(
      `[RetryGuard] Acquired lock for ${lockId} (expires in ${ttlSeconds}s, process: ${processId})`
    );
    return true;
  });
}

/**
 * Release lock after operation completes
 */
export async function releaseRetryLock(
  userId: string,
  itemId: string,
  lockType: 'content' | 'cover'
): Promise<void> {
  const adminDb = getAdminDb();
  const lockId = `${userId}_${itemId}_${lockType}`;
  
  try {
    await adminDb.collection('retryLocks').doc(lockId).delete();
    console.log(`[RetryGuard] Released lock: ${lockId}`);
  } catch (err) {
    console.error(`[RetryGuard] Failed to release lock ${lockId}:`, err);
  }
}

/**
 * BACKGROUND JOB: Cleanup expired locks
 * Should be called by Cloud Scheduler every 5 minutes
 */
export async function cleanupExpiredRetryLocks(): Promise<number> {
  const adminDb = getAdminDb();
  const now = new Date();
  
  const expiredLocks = await adminDb
    .collection('retryLocks')
    .where('expiresAt', '<', now)
    .limit(100)
    .get();
  
  if (expiredLocks.empty) {
    return 0;
  }
  
  const batch = adminDb.batch();
  expiredLocks.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  
  await batch.commit();
  console.log(`[RetryGuard] Cleaned up ${expiredLocks.size} expired locks`);
  
  return expiredLocks.size;
}

/**
 * Check if lock exists (for debugging)
 */
export async function isLockActive(
  userId: string,
  itemId: string,
  lockType: 'content' | 'cover'
): Promise<boolean> {
  const adminDb = getAdminDb();
  const lockId = `${userId}_${itemId}_${lockType}`;
  const lockDoc = await adminDb.collection('retryLocks').doc(lockId).get();
  
  if (!lockDoc.exists) {
    return false;
  }
  
  const lockData = lockDoc.data() as RetryLock;
  const now = Date.now();
  const expiresAt = lockData.expiresAt.toMillis();
  
  return expiresAt > now;
}
