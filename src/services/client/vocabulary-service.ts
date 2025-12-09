// src/services/client/vocabulary-service.ts
'use client';

/**
 * @fileoverview Client-side service for all vocabulary interactions with IndexedDB (Dexie).
 * All functions in this file run exclusively in the browser.
 */

import { getLocalDbForUser } from '@/services/local-database';
import { enqueueSync } from '@/services/sync-service';
import type { VocabularyItem, SrsState, VocabularyFilters, PaginationState, User } from '@/lib/types';
import { VOCAB_VALIDATION, FOLDER_CONSTANTS } from '@/features/vocabulary/constants';
import { removeUndefinedProps } from '@/lib/utils';
import type { Collection } from 'dexie';
import { checkAndUnlockAchievements } from '@/services/achievement-service';
import { vocabularyEvents, VocabularyEventType } from '@/features/vocabulary/events/vocabulary-events';
import { handleVocabularyError, createVocabularyError, VocabularyErrorCode } from '@/features/vocabulary/utils/error-handler';
import { validateVocabFields } from '@/features/vocabulary/utils/validation.utils';
import { resolveFolderForDisplay } from '@/features/vocabulary/utils/folder.utils';

// ============================================================================
// DATA MODIFICATION FUNCTIONS (Client-side)
// ============================================================================

const generateSearchTerms = (term: string, meaning: string, example?: string): string[] => {
    const terms = new Set<string>();
    
    const tokenize = (text: string | undefined) => {
        if (!text) return;
        text.toLowerCase()
          .split(/[\s,.;:!?()]+/)
          .filter(word => word.length >= VOCAB_VALIDATION.MIN_QUERY_LENGTH)
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

  console.log('[DEBUG] Entering getVocabularyItemsPaginated with options:', { userId, folder, searchTerm, limit, offset, sortBy, sortOrder, context });

  try {
    let query: Collection<VocabularyItem, string> = localDb.vocabulary.where({ userId });
    console.log('[DEBUG] Initial query created for userId:', userId);

    if (context) {
        query = query.and(item => item.context === context);
        console.log('[DEBUG] Applied context filter:', context);
    }
    
    if (folder && folder !== 'all') {
        if (folder === FOLDER_CONSTANTS.UNORGANIZED) {
            query = query.and(item => !item.folder);
            console.log('[DEBUG] Applied folder filter: unorganized');
        } else {
            query = query.and(item => item.folder === folder);
            console.log('[DEBUG] Applied folder filter:', folder);
        }
    }
    
    if (searchTerm && searchTerm.length >= VOCAB_VALIDATION.MIN_QUERY_LENGTH) {
        const searchLower = searchTerm.toLowerCase();
        query = query.and(item => 
            (item.searchTerms || []).some(st => st.includes(searchLower))
        );
        console.log('[DEBUG] Applied search filter:', searchTerm);
    }
    
    let sortedCollection = query.orderBy(sortBy);
    console.log('[DEBUG] Applied sort by:', sortBy);

    if (sortOrder === 'desc') {
        sortedCollection = sortedCollection.reverse();
        console.log('[DEBUG] Applied sort order: desc');
    }

    let items;
    try {
        console.log('[DEBUG] Executing query with offset/limit...', { offset, limit });
        items = await sortedCollection.offset(offset).limit(limit + 1).toArray();
        console.log('[DEBUG] Query successful. Items found:', items.length);
    } catch (e: any) {
        console.error("===================================================");
        console.error("!!! DEXIE QUERY FAILED - RAW ERROR !!!");
        console.error("===================================================");
        console.error("Error Name:", e.name);
        console.error("Error Message:", e.message);
        console.error("Error Stack:", e.stack);
        console.error("Query Details:", { userId, folder, searchTerm, limit, offset, sortBy, sortOrder, context });
        console.error("===================================================");
        // Re-throw the error to be caught by the outer try-catch
        throw e;
    }
    
    const hasMore = items.length > limit;
    const paginatedItems = items.slice(0, limit);
    console.log('[DEBUG] Pagination result:', { hasMore, returnedItems: paginatedItems.length });

    return { items: paginatedItems, hasMore };
  } catch (error) {
    // This will now catch the re-thrown error from the inner block as well.
    handleVocabularyError(error, 'getVocabularyItemsPaginated', VocabularyErrorCode.DB_QUERY_FAILED);
  }
}


export async function getFolderCounts(userId: string): Promise<Record<string, number>> {
  const localDb = getLocalDbForUser(userId);
  try {
    const items = await localDb.vocabulary.where({ userId }).toArray();
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
        await localDb.vocabulary.where({ userId }).each(item => {
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
