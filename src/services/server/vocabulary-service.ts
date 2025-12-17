// src/services/server/vocabulary.service.ts
'use server'; // This directive applies to all functions in this file.

import { getAdminDb } from '@/lib/firebase-admin'; // ✅ FIX: Use admin SDK on the server
import { convertTimestamps } from '@/lib/utils';
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
    const adminDb = getAdminDb(); // ✅ FIX: Use admin DB instance
    const vocabCollectionRef = adminDb.collection(`users/${userId}/vocabulary`);
    const q = vocabCollectionRef.orderBy('createdAt', 'desc');
    const querySnapshot = await q.get(); // ✅ FIX: Use .get() for admin SDK
    
    return querySnapshot.docs.map(docSnap => {
      const data = docSnap.data() as Omit<VocabularyItem, 'id'>;
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
    const adminDb = getAdminDb(); // ✅ FIX: Use admin DB instance
    const batch = adminDb.batch(); // ✅ FIX: Get batch from admin DB
    const vocabCollectionRef = adminDb.collection(`users/${userId}/vocabulary`);

    for (const action of actions) {
      const docRef = vocabCollectionRef.doc(action.key); // ✅ FIX: Use .doc() for admin SDK
      switch (action.type) {
        case 'create':
          if (action.payload) {
            // Note: serverTimestamp is handled by FieldValue in firebase-admin, but we assume it's set on payload
            batch.set(docRef, { ...action.payload, createdAt: new Date(), updatedAt: new Date() });
          }
          break;
        case 'update':
          if (action.payload) {
            batch.update(docRef, { ...action.payload, updatedAt: new Date() });
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
