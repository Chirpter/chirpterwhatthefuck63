// src/services/client/local-database.ts
import Dexie, { type Table } from 'dexie';
import type { VocabularyItem, SystemBookmark } from '@/lib/types';
import type { DiaryEntry } from '@/features/diary/types';

export interface SyncAction {
  id?: number;
  type: 'create' | 'update' | 'delete';
  table: 'vocabulary';
  key: string;
  payload?: Partial<VocabularyItem>;
  timestamp: number;
}

export interface SearchIndex {
  id?: number;
  userId: string;
  term: string;
  meaning: string;
  vocabularyId: string;
}

export interface AggregateCache {
  id?: number;
  userId: string;
  type: 'folder_counts' | 'srs_counts';
  timestamp: number;
  data: any;
}

export interface UserCacheEntry {
  id: string;
  timestamp: number;
  data: any;
}

export interface FolderStats {
  id?: number;
  userId: string;
  folder: string;
  count: number;
  lastUpdated: Date;
}

export class ChirpterLocalDB extends Dexie {
  vocabulary!: Table<VocabularyItem, string>;
  diary!: Table<DiaryEntry, number>;
  systemBookmarks!: Table<SystemBookmark, string>;
  userCache!: Table<UserCacheEntry, string>;
  syncQueue!: Table<SyncAction, number>;
  aggregateCache!: Table<AggregateCache, number>;
  folderStats!: Table<FolderStats, number>;
  searchIndex!: Table<SearchIndex, number>;

  constructor(dbName: string) {
    super(dbName);
    this.version(16).stores({
      vocabulary: `
        id,
        userId,
        folder,
        srsState,
        dueDate,
        createdAt,
        [userId+folder],
        [userId+srsState],
        [userId+createdAt],
        *searchTerms
      `,
      diary: 'id',
      systemBookmarks: 'id',
      userCache: 'id, timestamp', 
      syncQueue: '++id, timestamp, [table+type]',
      aggregateCache: `
        ++id,
        [userId+type]
      `,
      searchIndex: `
        ++id,
        vocabularyId,
        [userId+term],
        [userId+meaning]
      `,
      folderStats: `
        ++id,
        [userId+folder]
      `,
    });
  }

  async cleanup() {
    // ✅ Check if we're in a transaction context
    if (Dexie.currentTransaction) {
      console.warn('[ChirpterLocalDB] Skipping cleanup in transaction context');
      return;
    }

    try {
      const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      await this.userCache.where('timestamp').below(oneWeekAgo).delete();
      
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      await this.syncQueue.where('timestamp').below(oneDayAgo).delete();
      
      console.log('[ChirpterLocalDB] Cleanup completed successfully');
    } catch (error) {
      console.warn('[ChirpterLocalDB] Cleanup failed:', error);
    }
  }
}

class DatabaseManager {
  private static instance: DatabaseManager;
  private dbInstances = new Map<string, { db: ChirpterLocalDB; lastAccess: number }>();
  private cleanupInterval?: NodeJS.Timeout;

  private constructor() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveInstances();
    }, 10 * 60 * 1000);
  }

  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  getDatabase(userId: string): ChirpterLocalDB {
    if (!userId) {
      throw new Error("Cannot create a local database without a user ID.");
    }

    const instance = this.dbInstances.get(userId);
    const now = Date.now();

    if (instance) {
      instance.lastAccess = now;
      return instance.db;
    }

    const db = new ChirpterLocalDB(`chirpterDB_${userId}`);
    this.dbInstances.set(userId, { db, lastAccess: now });
    
    // ✅ FIX: Defer cleanup to avoid ReadOnlyError in liveQuery context
    // This ensures cleanup runs AFTER any liveQuery setup is complete
    setTimeout(() => {
      db.cleanup().catch(err => 
        console.warn('[DatabaseManager] Cleanup error:', err)
      );
    }, 0);
    
    return db;
  }

  private cleanupInactiveInstances() {
    const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
    
    for (const [userId, instance] of this.dbInstances.entries()) {
      if (instance.lastAccess < tenMinutesAgo) {
        instance.db.close();
        this.dbInstances.delete(userId);
      }
    }
  }

  cleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    for (const instance of this.dbInstances.values()) {
      instance.db.close();
    }
    this.dbInstances.clear();
  }
}

export function getLocalDbForUser(userId: string): ChirpterLocalDB {
  return DatabaseManager.getInstance().getDatabase(userId);
}

export function cleanupDatabases() {
  DatabaseManager.getInstance().cleanup();
}
