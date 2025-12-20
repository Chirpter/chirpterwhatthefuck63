// src/services/client/local-database.ts
/**
 * @fileoverview This file defines the client-side database using Dexie.js,
 * a wrapper around IndexedDB. This is the primary "Local DB" for storing
 * complex application data like vocabulary, diary entries, and sync queues.
 */

import Dexie, { type Table } from 'dexie';
import type { VocabularyItem, SystemBookmark } from '@/lib/types';
import type { DiaryEntry } from '@/features/diary/types';

// ============================================
// DATABASE SCHEMA DEFINITION
// ============================================

/**
 * Represents an action (create, update, delete) that occurred locally
 * and needs to be synchronized with the server (Firestore).
 */
export interface SyncAction {
  id?: number; // Auto-incrementing primary key
  type: 'create' | 'update' | 'delete';
  table: 'vocabulary'; // The table the action applies to
  key: string; // The primary key of the item being changed (e.g., vocabulary ID)
  payload?: Partial<VocabularyItem>; // Data for create/update actions
  timestamp: number;
}

/**
 * A simplified, denormalized record for full-text search capabilities within IndexedDB.
 */
export interface SearchIndex {
  id?: number;
  userId: string;
  term: string;
  meaning: string;
  vocabularyId: string;
}

/**
 * Stores aggregated data to avoid re-calculating frequently.
 * For example, storing the count of items in each folder.
 */
export interface AggregateCache {
  id?: number;
  userId: string;
  type: 'folder_counts' | 'srs_counts';
  timestamp: number;
  data: any;
}

/**
 * Caches user-specific data to reduce Firestore reads.
 */
export interface UserCacheEntry {
  id: string; // Typically the user ID
  timestamp: number;
  data: any; // The cached data (e.g., user profile)
}

/**
 * A denormalized table to quickly get folder statistics.
 */
export interface FolderStats {
  id?: number;
  userId: string;
  folder: string;
  count: number;
  lastUpdated: Date;
}

/**
 * Defines the database schema using Dexie.
 * Each property represents a table in the IndexedDB database.
 */
export class ChirpterLocalDB extends Dexie {
  // === TABLES ===
  vocabulary!: Table<VocabularyItem, string>; // 'vocabulary' table with string primary key ('id')
  diary!: Table<DiaryEntry, number>; // 'diary' table with number primary key ('id')
  systemBookmarks!: Table<SystemBookmark, string>; // Caches system-wide bookmark designs
  userCache!: Table<UserCacheEntry, string>; // Caches user-related data
  syncQueue!: Table<SyncAction, number>; // Queue for server synchronization
  aggregateCache!: Table<AggregateCache, number>; // Caches computed data like counts
  folderStats!: Table<FolderStats, number>; // Caches folder statistics
  searchIndex!: Table<SearchIndex, number>; // For full-text search

  constructor(dbName: string) {
    super(dbName);
    
    // --- SCHEMA VERSIONING ---
    // The version number is incremented each time the schema changes.
    // Dexie handles the migration automatically.
    this.version(16).stores({
      // The string defines the schema for each table.
      // '++id': Auto-incrementing primary key.
      // 'id': Primary key (must be unique).
      // 'userId, folder': A compound index for fast lookups.
      // '[userId+folder]': A compound index.
      // '*searchTerms': A multi-entry index for full-text search on arrays.
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
    // Check if we're in a transaction context to avoid errors
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

/**
 * Manages database instances to ensure one DB per user and handles cleanup.
 * This is a singleton pattern.
 */
class DatabaseManager {
  private static instance: DatabaseManager;
  private dbInstances = new Map<string, { db: ChirpterLocalDB; lastAccess: number }>();
  private cleanupInterval?: NodeJS.Timeout;

  private constructor() {
    // Periodically checks for inactive database connections to close them.
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveInstances();
    }, 10 * 60 * 1000); // Check every 10 minutes
  }

  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  /**
   * Retrieves or creates a database instance for a specific user.
   * @param userId The UID of the user.
   * @returns An instance of ChirpterLocalDB.
   */
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
    
    // Defer cleanup to avoid ReadOnlyError in liveQuery context
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

/**
 * Public function to get the database instance for a given user.
 * This is the main entry point for other services to access the local DB.
 */
export function getLocalDbForUser(userId: string): ChirpterLocalDB {
  return DatabaseManager.getInstance().getDatabase(userId);
}

/**
 * Public function to clean up all database instances.
 */
export function cleanupDatabases() {
  DatabaseManager.getInstance().cleanup();
}
