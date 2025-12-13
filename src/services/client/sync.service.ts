// src/services/client/sync.service.ts
'use client';

/**
 * @fileoverview Client-side service to manage the synchronization queue.
 * This service collects changes made in IndexedDB and sends them to the server.
 */

import { getLocalDbForUser, type SyncAction } from './local-database';
import { syncVocabularyBatch, fetchAllVocabularyFromFirestore } from '../server/vocabulary.service';
import { ApiServiceError } from '@/lib/errors';

const BATCH_DELAY = 10000; // 10 seconds
const MAX_BATCH_SIZE = 50;

class OptimizedSyncEngine {
  private batchBuffer = new Map<string, SyncAction>();
  private flushTimeout?: NodeJS.Timeout;
  private isFlushing = false;
  private userId: string;
  private maxRetries = 3;
  private retryDelay = 2000;

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
      if (newAction.type === 'delete') {
        this.batchBuffer.set(key, newAction);
      } else if (existing.type === 'create' && newAction.type === 'update') {
        this.batchBuffer.set(key, { ...existing, payload: { ...existing.payload, ...newAction.payload }, timestamp: newAction.timestamp });
      } else if (existing.type === 'update' && newAction.type === 'update') {
        this.batchBuffer.set(key, { ...existing, payload: { ...existing.payload, ...newAction.payload }, timestamp: newAction.timestamp });
      } else {
        this.batchBuffer.set(key, newAction);
      }
    } else {
      this.batchBuffer.set(key, newAction);
    }
    
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
      const isPermanentFailure = error instanceof ApiServiceError && error.code === 'PERMISSION';

      if (isPermanentFailure) {
        console.warn("Sync batch failed due to a permanent error (Permission Denied). The data will not be retried.", { failedActions: actionsToSync, error });
      } else if (retryCount < this.maxRetries) {
        console.error(`Sync batch failed (attempt ${retryCount + 1}), retrying...`, error);
        actionsToSync.forEach(action => {
          const key = `${action.table}_${action.key}`;
          if (!this.batchBuffer.has(key)) {
             this.batchBuffer.set(key, action);
          }
        });
        
        setTimeout(() => this.flushBatch(retryCount + 1), this.retryDelay * Math.pow(2, retryCount));
      } else {
        console.error(`Sync batch failed after all ${this.maxRetries} retries. Giving up.`, { failedActions: actionsToSync, error });
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

export async function enqueueSync(
    userId: string,
    action: Omit<SyncAction, 'timestamp' | 'id'>
): Promise<void> {
    const engine = getSyncEngine(userId);
    await engine.enqueueSyncAction(action);
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
    
    try {
        const localDb = getLocalDbForUser(userId);
        const firestoreItems = await fetchAllVocabularyFromFirestore(userId);
        
        if (firestoreItems.length > 0) {
            await localDb.vocabulary.bulkPut(firestoreItems);
        }
        
        markInitialSyncAsPerformed(userId);
        return true;
    } catch (error) {
        console.error("Initial sync failed, will retry on next load.", error);
        return false;
    }
}
