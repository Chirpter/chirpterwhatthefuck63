
/**
 * @fileoverview Client-side service to manage the synchronization queue.
 * This service reads from the local IndexedDB queue and sends batches of
 * changes to the server.
 * Implements an optimized sync engine with intelligent batching and operation coalescing.
 */

import { getLocalDbForUser, type SyncAction } from './local-database';
import { syncVocabularyBatch, fetchAllVocabularyFromFirestore } from '@/services/vocabulary-service';

const BATCH_DELAY = 5000; // 5 seconds
const MAX_BATCH_SIZE = 100;

class OptimizedSyncEngine {
  private batchBuffer = new Map<string, SyncAction>();
  private flushTimeout?: NodeJS.Timeout;
  private isFlushing = false;
  private userId: string;
  private maxRetries = 3;
  private retryDelay = 1000;

  constructor(userId: string) {
    this.userId = userId;
  }

  async enqueueSyncAction(action: Omit<SyncAction, 'timestamp' | 'id'>) {
    const key = `${action.table}_${action.key}`;
    const existing = this.batchBuffer.get(key);

    const newAction: SyncAction = {
      ...(action as SyncAction),
      timestamp: Date.now(),
    };

    if (existing) {
      // Coalesce operations: combine multiple updates for the same item.
      if (newAction.type === 'delete') {
        // If it's a delete action, it overrides any previous actions.
        this.batchBuffer.set(key, newAction);
      } else if (existing.type === 'create' && newAction.type === 'update') {
        // If we created and then updated, just send one 'create' with merged data.
        this.batchBuffer.set(key, {
          ...existing,
          payload: { ...existing.payload, ...newAction.payload },
          timestamp: newAction.timestamp,
        });
      } else if (existing.type === 'update' && newAction.type === 'update') {
        // If we updated multiple times, merge the updates into one.
        this.batchBuffer.set(key, {
          ...existing,
          payload: { ...existing.payload, ...newAction.payload },
          timestamp: newAction.timestamp,
        });
      } else {
        // Handle cases like update after delete, which shouldn't happen with good logic but is safe to handle.
        this.batchBuffer.set(key, newAction);
      }
    } else {
      this.batchBuffer.set(key, newAction);
    }
    
    // Flush immediately if the batch is large or contains deletions.
    const hasDeletes = Array.from(this.batchBuffer.values()).some(a => a.type === 'delete');
    if (this.batchBuffer.size >= MAX_BATCH_SIZE || hasDeletes) {
      await this.flushBatch();
    } else {
      this.scheduleFlush();
    }
  }

  private scheduleFlush() {
    if (this.flushTimeout) clearTimeout(this.flushTimeout);
    this.flushTimeout = setTimeout(() => this.flushBatch(), BATCH_DELAY);
  }

  private async flushBatch(retryCount = 0) {
    if (this.isFlushing || this.batchBuffer.size === 0) return;

    this.isFlushing = true;
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = undefined;
    }

    const actionsToSync = Array.from(this.batchBuffer.values());
    this.batchBuffer.clear();

    try {
      await syncVocabularyBatch(this.userId, actionsToSync);
    } catch (error: any) {
      // NEW: Intelligent error handling
      const isPermanentFailure = error.code === 'permission-denied';

      if (isPermanentFailure) {
          console.warn("Sync batch failed due to a permanent error (Permission Denied). The data is invalid and will not be retried.", { failedActions: actionsToSync, error });
          // Do not re-queue the actions, effectively discarding them.
      } else if (retryCount < this.maxRetries) {
          console.error(`Sync batch failed (attempt ${retryCount + 1}), retrying...`, error);
          // If it's not a permanent error, put items back in the buffer to be retried
          actionsToSync.forEach(action => {
            const key = `${action.table}_${action.key}`;
            if (!this.batchBuffer.has(key)) {
               this.batchBuffer.set(key, action);
            }
          });
          
          setTimeout(() => {
            this.flushBatch(retryCount + 1);
          }, this.retryDelay * Math.pow(2, retryCount)); // Exponential backoff
      } else {
          console.error(`Sync batch failed after all ${this.maxRetries} retries. Giving up.`, { failedActions: actionsToSync, error });
          // After all retries, the actions are effectively discarded.
      }
    } finally {
      this.isFlushing = false;
    }
  }

  stop() {
    if (this.flushTimeout) {
        clearTimeout(this.flushTimeout);
    }
  }
}


const syncEngineInstances = new Map<string, OptimizedSyncEngine>();

function getSyncEngine(userId: string): OptimizedSyncEngine {
    if (!syncEngineInstances.has(userId)) {
        syncEngineInstances.set(userId, new OptimizedSyncEngine(userId));
    }
    return syncEngineInstances.get(userId)!;
}


/**
 * Public facing function to add an action to the sync queue for the given user.
 */
export async function enqueueSync(
    userId: string,
    action: Omit<SyncAction, 'timestamp' | 'id'>
): Promise<void> {
    const engine = getSyncEngine(userId);
    await engine.enqueueSyncAction(action);
}


/**
 * Fetches all data from Firestore and populates the local IndexedDB.
 * This is intended to run once per user per device.
 * @param userId The UID of the user.
 */
export async function syncFirestoreToLocal(userId: string): Promise<void> {
    const localDb = getLocalDbForUser(userId);
    try {
        const firestoreItems = await fetchAllVocabularyFromFirestore(userId);
        
        if (firestoreItems.length > 0) {
            await localDb.vocabulary.bulkPut(firestoreItems);
            console.log(`Successfully synced ${firestoreItems.length} items from Firestore to local DB.`);
        }
        
    } catch (error) {
        console.error("Error during Firestore to local sync:", error);
    }
}

const hasInitialSyncBeenPerformed = (userId: string): boolean => {
    const key = `chirpter_initial_sync_done_${userId}`;
    return localStorage.getItem(key) === 'true';
};

const markInitialSyncAsPerformed = (userId: string): void => {
    const key = `chirpter_initial_sync_done_${userId}`;
    localStorage.setItem(key, 'true');
};


export async function performInitialSync(userId: string): Promise<boolean> {
    if (hasInitialSyncBeenPerformed(userId)) {
        return true;
    }
    
    console.log("Performing initial sync for user:", userId);

    try {
        await syncFirestoreToLocal(userId);
        markInitialSyncAsPerformed(userId);
        return true;
    } catch (error) {
        console.error("Initial sync failed, will retry on next load.", error);
        return false;
    }
}
