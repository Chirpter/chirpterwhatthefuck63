// src/services/credit-escrow.service.ts
'use server';

import { getAdminDb, FieldValue } from '@/lib/firebase-admin';

/**
 * SECURITY-CRITICAL: Credit Escrow Pattern
 * - Prevents credit loss on AI failures
 * - Prevents double-charging on race conditions
 * - All operations are atomic via Firestore transactions
 */

export interface CreditTransaction {
  id: string;
  userId: string;
  amount: number;
  status: 'pending' | 'spent' | 'refunded';
  reason: string;
  itemId: string;
  itemType: 'book-content' | 'book-cover' | 'piece-content';
  createdAt: any;
  updatedAt: any;
  refundReason?: string;
  expiresAt: any; // Auto-refund after 15 minutes
}

/**
 * Reserve credits in escrow (atomic)
 * Returns transaction ID for tracking
 */
export async function reserveCredits(
  userId: string,
  amount: number,
  reason: string,
  itemId: string,
  itemType: 'book-content' | 'book-cover' | 'piece-content'
): Promise<string> {
  const adminDb = getAdminDb();
  
  if (amount <= 0) {
    throw new Error('Credit amount must be positive');
  }
  
  const transactionId = await adminDb.runTransaction(async (t) => {
    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await t.get(userRef);
    
    if (!userDoc.exists) {
      throw new Error('User not found');
    }
    
    const userData = userDoc.data()!;
    const availableCredits = userData.credits || 0;
    const pendingCredits = userData.pendingCredits || 0;
    
    // SECURITY: Check available credits
    if (availableCredits < amount) {
      throw new Error(
        `Insufficient credits. Required: ${amount}, Available: ${availableCredits}`
      );
    }
    
    // SECURITY: Check for existing pending transaction for same item
    const existingTxQuery = await adminDb
      .collection('creditTransactions')
      .where('userId', '==', userId)
      .where('itemId', '==', itemId)
      .where('itemType', '==', itemType)
      .where('status', '==', 'pending')
      .limit(1)
      .get();
    
    if (!existingTxQuery.empty) {
      throw new Error(
        'A pending transaction already exists for this item. Please wait for it to complete.'
      );
    }
    
    // Create transaction record FIRST (for audit trail)
    const txRef = adminDb.collection('creditTransactions').doc();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    
    const txData: Omit<CreditTransaction, 'id'> = {
      userId,
      amount,
      status: 'pending',
      reason,
      itemId,
      itemType,
      expiresAt,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    
    t.set(txRef, txData);
    
    // Move credits from available to pending (atomic)
    t.update(userRef, {
      credits: FieldValue.increment(-amount),
      pendingCredits: FieldValue.increment(amount),
      updatedAt: FieldValue.serverTimestamp(),
    });
    
    console.log(`[CreditEscrow] Reserved ${amount} credits for ${itemId} (tx: ${txRef.id})`);
    return txRef.id;
  });
  
  return transactionId;
}

/**
 * Commit credits after successful generation (atomic)
 */
export async function commitCredits(transactionId: string): Promise<void> {
  const adminDb = getAdminDb();
  
  await adminDb.runTransaction(async (t) => {
    const txRef = adminDb.collection('creditTransactions').doc(transactionId);
    const txDoc = await t.get(txRef);
    
    if (!txDoc.exists) {
      throw new Error(`Transaction ${transactionId} not found`);
    }
    
    const txData = txDoc.data() as CreditTransaction;
    
    // SECURITY: Only commit if still pending
    if (txData.status !== 'pending') {
      console.warn(
        `[CreditEscrow] Cannot commit transaction ${transactionId}: status is ${txData.status}`
      );
      return;
    }
    
    const userRef = adminDb.collection('users').doc(txData.userId);
    
    // Move credits from pending to spent (atomic)
    t.update(userRef, {
      pendingCredits: FieldValue.increment(-txData.amount),
      'stats.creditsSpent': FieldValue.increment(txData.amount),
      updatedAt: FieldValue.serverTimestamp(),
    });
    
    t.update(txRef, {
      status: 'spent',
      updatedAt: FieldValue.serverTimestamp(),
    });
    
    console.log(`[CreditEscrow] Committed ${txData.amount} credits (tx: ${transactionId})`);
  });
}

/**
 * Refund credits on failure (atomic)
 */
export async function refundCredits(
  transactionId: string,
  reason: string = 'Generation failed'
): Promise<void> {
  const adminDb = getAdminDb();
  
  await adminDb.runTransaction(async (t) => {
    const txRef = adminDb.collection('creditTransactions').doc(transactionId);
    const txDoc = await t.get(txRef);
    
    if (!txDoc.exists) {
      throw new Error(`Transaction ${transactionId} not found`);
    }
    
    const txData = txDoc.data() as CreditTransaction;
    
    // SECURITY: Only refund if still pending
    if (txData.status !== 'pending') {
      console.warn(
        `[CreditEscrow] Cannot refund transaction ${transactionId}: status is ${txData.status}`
      );
      return;
    }
    
    const userRef = adminDb.collection('users').doc(txData.userId);
    
    // Return credits from pending to available (atomic)
    t.update(userRef, {
      credits: FieldValue.increment(txData.amount),
      pendingCredits: FieldValue.increment(-txData.amount),
      updatedAt: FieldValue.serverTimestamp(),
    });
    
    t.update(txRef, {
      status: 'refunded',
      refundReason: reason,
      updatedAt: FieldValue.serverTimestamp(),
    });
    
    console.log(
      `[CreditEscrow] Refunded ${txData.amount} credits (tx: ${transactionId}): ${reason}`
    );
  });
}

/**
 * BACKGROUND JOB: Auto-refund stale pending transactions
 * Should be called by Cloud Scheduler every 5 minutes
 */
export async function cleanupStalePendingCredits(): Promise<number> {
  const adminDb = getAdminDb();
  const now = new Date();
  
  const staleTransactions = await adminDb
    .collection('creditTransactions')
    .where('status', '==', 'pending')
    .where('expiresAt', '<', now)
    .limit(50)
    .get();
  
  let refundedCount = 0;
  
  for (const doc of staleTransactions.docs) {
    try {
      await refundCredits(doc.id, 'Auto-refunded: Transaction expired');
      refundedCount++;
    } catch (err) {
      console.error(`[CreditEscrow] Failed to auto-refund ${doc.id}:`, err);
    }
  }
  
  if (refundedCount > 0) {
    console.log(`[CreditEscrow] Auto-refunded ${refundedCount} stale transactions`);
  }
  
  return refundedCount;
}

/**
 * Get transaction status (for debugging)
 */
export async function getTransactionStatus(
  transactionId: string
): Promise<CreditTransaction | null> {
  const adminDb = getAdminDb();
  const txDoc = await adminDb.collection('creditTransactions').doc(transactionId).get();
  
  if (!txDoc.exists) {
    return null;
  }
  
  return { id: txDoc.id, ...txDoc.data() } as CreditTransaction;
}
