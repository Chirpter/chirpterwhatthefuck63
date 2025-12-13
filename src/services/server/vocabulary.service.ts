// src/services/server/vocabulary.service.ts
'use server'; // This directive applies to all functions in this file.

import { collection, writeBatch, query, getDocs, orderBy, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase'; // This should be the client-side db instance
import { convertTimestamps, removeUndefinedProps } from '@/lib/utils';
import type { SyncAction } from '@/services/client/local-database';
import { handleVocabularyError, VocabularyErrorCode } from '@/features/vocabulary/utils/error-handler';
import type { VocabularyItem } from '@/lib/types';

// ============================================================================
// SERVER-SIDE DATABASE SERVICE (Interacts with Firestore)
// These functions are intended to be called from the client as Server Actions.
// ============================================================================


/**
 * Fetches all vocabulary items for a user directly from Firestore.
 * This is used for the initial one-time sync when a user logs in on a new device.
 * @param userId The UID of the user.
 * @returns A promise that resolves to an array of VocabularyItem objects.
 */
export async function fetchAllVocabularyFromFirestore(userId: string): Promise<VocabularyItem[]> {
  try {
    const vocabCollectionRef = collection(db, `users/${userId}/vocabulary`);
    const q = query(vocabCollectionRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(docSnap => {
      const data = docSnap.data() as Omit<VocabularyItem, 'id'>;
      // Note: `convertTimestamps` is a server-side utility here.
      return convertTimestamps({ id: docSnap.id, ...data });
    });
  } catch (error) {
    handleVocabularyError(error, 'fetchAllVocabularyFromFirestore', VocabularyErrorCode.DB_QUERY_FAILED);
  }
}

/**
 * [SERVER ACTION] Processes a batch of sync actions and applies them to Firestore.
 * This is the dedicated server endpoint for our client-side sync engine.
 * @param userId The UID of the user performing the sync.
 * @param actions An array of sync actions to perform.
 */
export async function syncVocabularyBatch(userId: string, actions: SyncAction[]): Promise<void> {
  try {
    const batch = writeBatch(db);
    const vocabCollectionRef = collection(db, `users/${userId}/vocabulary`);

    for (const action of actions) {
      const docRef = doc(vocabCollectionRef, action.key);
      switch (action.type) {
        case 'create':
          if (action.payload) {
            batch.set(docRef, { ...action.payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
          }
          break;
        case 'update':
          if (action.payload) {
            batch.update(docRef, { ...action.payload, updatedAt: serverTimestamp() });
          }
          break;
        case 'delete':
          batch.delete(docRef);
          break;
      }
    }
    await batch.commit();
  } catch (error) {
    handleVocabularyError(error, 'syncVocabularyBatch', VocabularyErrorCode.DB_UPDATE_FAILED);
  }
}
