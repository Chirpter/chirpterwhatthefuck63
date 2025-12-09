
// src/services/vocabulary-service.ts
'use server'; // This directive applies to syncVocabularyBatch only. Other functions are client-side.

import { collection, writeBatch, query, getDocs, orderBy, doc, serverTimestamp, getDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { User as AuthUser } from 'firebase/auth';

// Client-side DB import - this will NOT be included in the server bundle for server actions.
import { getLocalDbForUser, type ChirpterLocalDB } from '@/services/local-database';
import { enqueueSync } from '@/services/sync-service';
import type { VocabularyItem, SrsState, VocabularyFilters, PaginationState, VocabContext, User } from '@/lib/types';
import { VOCAB_VALIDATION, FOLDER_CONSTANTS } from '@/features/vocabulary/constants';
import { convertTimestamps, removeUndefinedProps } from '@/lib/utils';
import type { SyncAction } from '@/services/local-database';
import type { Collection } from 'dexie';
import { checkAndUnlockAchievements } from './achievement-service';
import { vocabularyEvents, VocabularyEventType } from '@/features/vocabulary/events/vocabulary-events';
import { handleVocabularyError, createVocabularyError, VocabularyErrorCode } from '@/features/vocabulary/utils/error-handler';
import { validateVocabFields } from '@/features/vocabulary/utils/validation.utils';
import { resolveFolderForDisplay } from '@/features/vocabulary/utils/folder.utils';

// ============================================================================
// SERVER-SIDE FUNCTIONS (used for syncing)
// ============================================================================

/**
 * Fetches all vocabulary items for a user directly from Firestore.
 * This is used for the initial one-time sync when a user logs in on a new device.
 * @param userId The UID of the user.
 * @returns A promise that resolves to an array of VocabularyItem objects.
 */
export async function fetchAllVocabularyFromFirestore(userId: string): Promise<VocabularyItem[]> {
  try {
    const vocabCollectionRef = collection(db, `users/${'${userId}'}/vocabulary`);
    const q = query(vocabCollectionRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
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
    const batch = writeBatch(db);
    const vocabCollectionRef = collection(db, `users/${'${userId}'}/vocabulary`);

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


// ============================================================================
// CLIENT-SIDE DATABASE SERVICE (Interacts with IndexedDB)
// These functions run in the browser.
// ============================================================================

const generateSearchTerms = (term: string, meaning: string, example?: string): string[] => {
    const terms = new Set<string>();
    
    const tokenize = (text: string | undefined) => {
        if (!text) return;
        text.toLowerCase()
          .split(/[\s,.;:!?()]+/) // Split by more delimiters
          .filter(word => word.length >= VOCAB_VALIDATION.MIN_SEARCH_QUERY_LENGTH)
          .forEach(t => terms.add(t));
    };

    tokenize(term);
    tokenize(meaning);
    tokenize(example);
    
    terms.add(term.toLowerCase());
    
    return Array.from(terms);
};

export async function addVocabularyItem(
  user: User,
  itemData: Omit<VocabularyItem, 'id' | 'userId' | 'createdAt' | 'srsState' | 'memoryStrength' | 'streak' | 'attempts' | 'lastReviewed' | 'dueDate'>
): Promise<VocabularyItem> {
  const localDb = getLocalDbForUser(user.uid);
  
  try {
    validateVocabFields(itemData);

    const newItem = await localDb.transaction('rw', localDb.vocabulary, async () => {
      const now = new Date();
      const newId = crypto.randomUUID();

      const finalItem: VocabularyItem = {
        ...itemData,
        id: newId,
        userId: user.uid,
        createdAt: now,
        srsState: 'new',
        memoryStrength: 0,
        streak: 0,
        attempts: 0,
        lastReviewed: null,
        dueDate: now,
        sourceTitle: itemData.sourceTitle || { en: 'Manual Entry' },
        folder: itemData.folder === FOLDER_CONSTANTS.UNORGANIZED ? undefined : itemData.folder,
        searchTerms: generateSearchTerms(itemData.term, itemData.meaning, itemData.example),
        context: itemData.context,
      };

      await localDb.vocabulary.add(finalItem);
      return finalItem;
    });

    if (user.plan === 'pro') {
      const { id, userId, ...payload } = newItem;
      await enqueueSync(user.uid, { type: 'create', table: 'vocabulary', key: id, payload });
    }

    vocabularyEvents.emit('vocabulary:item:added', { userId: user.uid, item: newItem, source: 'manual' });
    
    return newItem;
  } catch (error) {
    handleVocabularyError(error, 'addVocabularyItem');
  }
}

export async function updateVocabularyItem(
  user: User,
  itemId: string,
  updates: Partial<VocabularyItem>
): Promise<VocabularyItem> {
  const localDb = getLocalDbForUser(user.uid);

  try {
    const updatedItem = await localDb.transaction('rw', localDb.vocabulary, async () => {
        const existingItem = await localDb.vocabulary.get(itemId);
        if (!existingItem) throw createVocabularyError(VocabularyErrorCode.DB_ITEM_NOT_FOUND);

        const mergedItem = { ...existingItem, ...updates };
        validateVocabFields(mergedItem);

        const finalUpdates: Partial<VocabularyItem> = removeUndefinedProps(updates);
        if (finalUpdates.term || finalUpdates.meaning || finalUpdates.example) {
            finalUpdates.searchTerms = generateSearchTerms(mergedItem.term, mergedItem.meaning, mergedItem.example);
        }

        await localDb.vocabulary.update(itemId, finalUpdates);
        return { ...existingItem, ...finalUpdates };
    });

    if (user.plan === 'pro') {
        await enqueueSync(user.uid, { type: 'update', table: 'vocabulary', key: itemId, payload: updates });
    }
    
    vocabularyEvents.emit('vocabulary:item:updated', { userId: user.uid, itemId, updates, previousState: await localDb.vocabulary.get(itemId) });

    return updatedItem;
  } catch (error) {
    handleVocabularyError(error, 'updateVocabularyItem');
  }
}


export async function deleteVocabularyItem(user: User, itemId: string): Promise<void> {
  const localDb = getLocalDbForUser(user.uid);
  try {
    const itemToDelete = await localDb.vocabulary.get(itemId);
    if (!itemToDelete) return; // Already deleted or never existed

    await localDb.vocabulary.delete(itemId);

    if (user.plan === 'pro') {
        await enqueueSync(user.uid, { type: 'delete', table: 'vocabulary', key: itemId });
    }
    
    vocabularyEvents.emit('vocabulary:item:deleted', { userId: user.uid, itemId, deletedItem: itemToDelete });

  } catch (error) {
    handleVocabularyError(error, 'deleteVocabularyItem');
  }
}

// ============================================
// CLIENT-SIDE QUERY FUNCTIONS
// ============================================

export async function getVocabularyItemsPaginated(
  userId: string,
  options: Partial<VocabularyFilters & PaginationState> = {}
): Promise<{ items: VocabularyItem[]; hasMore: boolean }> {
  const localDb = getLocalDbForUser(userId);
  const {
    folder,
    searchTerm,
    limit = 25,
    offset = 0,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    context,
  } = options;

  // --- DEBUG LOGGING ---
  console.log('[DEBUG] getVocabularyItemsPaginated called with:', { userId, ...options });

  try {
    let query: Collection<VocabularyItem, string> = localDb.vocabulary.where('userId').equals(userId);
    
    if (context) {
      console.log(`[DEBUG] Filtering by context: ${context}`);
      query = query.and(item => item.context === context);
    }
    if (folder && folder !== 'all') {
      console.log(`[DEBUG] Filtering by folder: ${folder}`);
      query = query.and(item => resolveFolderForDisplay(item.folder) === folder);
    }
    if (searchTerm && searchTerm.length >= VOCAB_VALIDATION.MIN_SEARCH_QUERY_LENGTH) {
      const searchLower = searchTerm.toLowerCase();
      console.log(`[DEBUG] Filtering by search term: ${searchLower}`);
      query = query.and(item => 
        (item.searchTerms || []).some(st => st.includes(searchLower))
      );
    }
    
    // Perform sorting and pagination directly in Dexie
    const sortedCollection = query.orderBy(sortBy);

    if (sortOrder === 'desc') {
      sortedCollection.reverse();
    }
    
    // --- DEBUG LOGGING: Wrap query execution in try/catch ---
    let items;
    try {
        console.log(`[DEBUG] Executing query: offset=${offset}, limit=${limit + 1}`);
        items = await sortedCollection.offset(offset).limit(limit + 1).toArray();
        console.log(`[DEBUG] Query successful, received ${items.length} items.`);
    } catch (dexieError) {
        console.error('[DEBUG] Dexie query execution FAILED. Error:', dexieError);
        // Re-throw the original error so it can be caught by the outer handler
        throw dexieError;
    }
    
    const hasMore = items.length > limit;
    const paginatedItems = items.slice(0, limit);

    return { items: paginatedItems, hasMore };
  } catch (error) {
    // This will now catch the error re-thrown from the inner block
    handleVocabularyError(error, 'getVocabularyItemsPaginated', VocabularyErrorCode.DB_QUERY_FAILED);
  }
}


export async function getFolderCounts(userId: string): Promise<Record<string, number>> {
  const localDb = getLocalDbForUser(userId);
  try {
    const items = await localDb.vocabulary.where('userId').equals(userId).toArray();
    const counts: Record<string, number> = { [FOLDER_CONSTANTS.UNORGANIZED]: 0 };
    items.forEach(item => {
      const folder = resolveFolderForDisplay(item.folder);
      counts[folder] = (counts[folder] || 0) + 1;
    });
    return counts;
  } catch (error) {
    handleVocabularyError(error, 'getFolderCounts', VocabularyErrorCode.DB_QUERY_FAILED);
  }
}

export async function getUniqueFolders(userId: string): Promise<string[]> {
    const localDb = getLocalDbForUser(userId);
    try {
        const allItemsWithFolders = await localDb.vocabulary.where('userId').equals(userId).and(item => typeof item.folder === 'string' && item.folder.trim() !== '').toArray();
        const folderSet = new Set(allItemsWithFolders.map(item => item.folder!));
        return Array.from(folderSet).sort((a, b) => a.localeCompare(b));
    } catch (error) {
        handleVocabularyError(error, 'getUniqueFolders', VocabularyErrorCode.DB_QUERY_FAILED);
    }
}


export async function getSrsStateCounts(userId: string): Promise<Record<SrsState, number>> {
    const localDb = getLocalDbForUser(userId);
    const counts: Record<SrsState, number> = { 'new': 0, 'learning': 0, 'short-term': 0, 'long-term': 0 };
    try {
        await localDb.vocabulary.where('userId').equals(userId).each(item => {
            counts[item.srsState] = (counts[item.srsState] || 0) + 1;
        });
        return counts;
    } catch (error) {
        handleVocabularyError(error, 'getSrsStateCounts', VocabularyErrorCode.DB_QUERY_FAILED);
    }
}

export async function getVocabularyItemsByFolderAndSrsState(
    userId: string, 
    folder: string, 
    srsState: SrsState
): Promise<VocabularyItem[]> {
    const localDb = getLocalDbForUser(userId);
    try {
        const items = await localDb.vocabulary.where({ userId }).and(item => {
            return resolveFolderForDisplay(item.folder) === folder && item.srsState === srsState;
        }).toArray();
        return items;
    } catch (error) {
        handleVocabularyError(error, 'getVocabularyItemsByFolderAndSrsState', VocabularyErrorCode.DB_QUERY_FAILED);
    }
}

export async function getVocabularyItemsByFolder(
    userId: string, 
    folder: string
): Promise<VocabularyItem[]> {
    const localDb = getLocalDbForUser(userId);
    try {
        const items = await localDb.vocabulary.where({ userId }).and(item => {
            return resolveFolderForDisplay(item.folder) === folder;
        }).toArray();
        return items;
    } catch (error) {
        handleVocabularyError(error, 'getVocabularyItemsByFolder', VocabularyErrorCode.DB_QUERY_FAILED);
    }
}

    