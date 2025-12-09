
// src/services/vocabulary-service.ts
import Dexie, { type Table } from 'dexie';
import type { VocabularyItem, SystemBookmark } from '@/lib/types';
import { collection, writeBatch, query, getDocs, orderBy, doc, serverTimestamp, getDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getLocalDbForUser, type ChirpterLocalDB } from '@/services/local-database';
import { enqueueSync } from '@/services/sync-service';
import type { User, SrsState, VocabularyFilters, PaginationState, VocabContext } from '@/lib/types';
import { VOCABULARY_CONSTANTS } from '@/lib/constants';
import { convertTimestamps, removeUndefinedProps } from '@/lib/utils';
import type { SyncAction } from '@/services/local-database';
import type { Collection } from 'dexie';
import { checkAndUnlockAchievements } from './achievement-service';
import type { User as AuthUser } from 'firebase/auth';


const UNORGANIZED_FOLDER_NAME = 'unorganized';

export async function fetchAllVocabularyFromFirestore(userId: string): Promise<VocabularyItem[]> {
  const vocabCollectionRef = collection(db, `users/${userId}/vocabulary`);
  const q = query(vocabCollectionRef, orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(docSnap => {
    const data = docSnap.data() as Omit<VocabularyItem, 'id'>;
    return convertTimestamps({ id: docSnap.id, ...data });
  });
}

export async function syncVocabularyBatch(userId: string, actions: SyncAction[]): Promise<void> {
  const batch = writeBatch(db);
  const vocabCollectionRef = collection(db, `users/${userId}/vocabulary`);

  for (const action of actions) {
    const docRef = doc(vocabCollectionRef, action.key);
    switch (action.type) {
      case 'create':
        if (action.payload) {
          batch.set(docRef, { ...action.payload, createdAt: serverTimestamp() });
        }
        break;
      case 'update':
        if (action.payload) {
          batch.update(docRef, action.payload);
        }
        break;
      case 'delete':
        batch.delete(docRef);
        break;
    }
  }

  await batch.commit();
}

export async function getFolderCounts(userId: string): Promise<Record<string, number>> {
  const db = getLocalDbForUser(userId);
  try {
    const items = await db.vocabulary.where('userId').equals(userId).toArray();
    const counts: Record<string, number> = { [UNORGANIZED_FOLDER_NAME]: 0 };
    
    items.forEach(item => {
      const folder = item.folder?.trim() || UNORGANIZED_FOLDER_NAME;
      counts[folder] = (counts[folder] || 0) + 1;
    });

    return counts;
  } catch (error) {
    console.error('Error getting folder counts:', error);
    return { [UNORGANIZED_FOLDER_NAME]: 0 };
  }
}

export async function getUniqueFolders(userId: string): Promise<string[]> {
  const db = getLocalDbForUser(userId);
  try {
    const items = await db.vocabulary.where('userId').equals(userId).toArray();
    const folderSet = new Set<string>();
    
    items.forEach(item => {
      if (item.folder?.trim()) {
        folderSet.add(item.folder.trim());
      }
    });
    
    return Array.from(folderSet);
  } catch (error) {
    console.error('Error getting folders:', error);
    return [];
  }
}

export async function getVocabularyItemsPaginated(
  userId: string,
  options: Partial<VocabularyFilters & PaginationState> = {}
): Promise<{ items: VocabularyItem[]; hasMore: boolean }> {
  const localDb = getLocalDbForUser(userId);
  const {
    folder = 'unorganized',
    searchTerm = '',
    limit = 25,
    offset = 0,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    scope = 'global',
    context = 'vocab-videos',
  } = options;

  try {
    let baseQuery: Collection<VocabularyItem, string>;

    if (scope === 'local') {
        baseQuery = localDb.vocabulary.where({ userId, context });
    } else {
        baseQuery = localDb.vocabulary.where('userId').equals(userId);
    }
    
    if (folder === UNORGANIZED_FOLDER_NAME) {
      baseQuery = baseQuery.filter(item => !item.folder || item.folder.trim() === '');
    } else if (folder !== 'all') {
      baseQuery = baseQuery.filter(item => item.folder === folder);
    }

    if (searchTerm.length >= VOCABULARY_CONSTANTS.SEARCH.MIN_QUERY_LENGTH) {
      const searchLower = searchTerm.toLowerCase();
      baseQuery = baseQuery.filter(item => 
        (item.searchTerms || []).some(st => st.includes(searchLower))
      );
    }
    
    const sortedCollection = baseQuery.sortBy(sortBy);
    const sortedItems = sortOrder === 'desc' ? (await sortedCollection).reverse() : await sortedCollection;

    const totalCount = sortedItems.length;
    const paginatedItems = sortedItems.slice(offset, offset + limit);
    const hasMore = offset + limit < totalCount;

    return { items: paginatedItems, hasMore };
    
  } catch (error: any) {
    console.error('Error getting paginated vocabulary:', error);
    throw new Error(`Failed to retrieve vocabulary items: ${error.message}`);
  }
}

// FIXED: Generate unique ID with collision check
const generateUniqueId = async (db: ChirpterLocalDB, userId: string): Promise<string> => {
  const maxAttempts = 10;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Use timestamp + UUID for better uniqueness
    const timestamp = Date.now();
    const uuid = crypto.randomUUID();
    const candidateId = `${userId.substring(0, 4)}-${timestamp}-${uuid}`;
    
    console.log(`[generateUniqueId] Attempt ${attempt + 1}: ${candidateId}`);
    
    // CRITICAL: Check if ID already exists BEFORE using it
    const existing = await db.vocabulary.get(candidateId);
    
    if (!existing) {
      console.log(`[generateUniqueId] ✅ Unique ID generated: ${candidateId}`);
      return candidateId;
    }
    
    console.warn(`[generateUniqueId] ⚠️  ID collision detected: ${candidateId}`);
    
    // Add small delay to avoid rapid collision
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  
  throw new Error(`Failed to generate unique ID after ${maxAttempts} attempts`);
};

const validateVocabItem = (item: Partial<VocabularyItem>): void => {
  if (!item.term?.trim()) throw new Error('Term is required');
  if (!item.meaning?.trim()) throw new Error('Meaning is required');
  
  const hasHTML = /<[^>]*>/g;
  if (hasHTML.test(item.term) || hasHTML.test(item.meaning) || (item.example && hasHTML.test(item.example))) {
    throw new Error('HTML tags are not allowed in vocabulary fields.');
  }
  
  const hasSpecialChars = /[<>()\[\]{}]/;
  if (hasSpecialChars.test(item.term) || hasSpecialChars.test(item.meaning) || (item.example && hasSpecialChars.test(item.example))) {
    throw new Error('Special characters like < > ( ) [ ] { } are not allowed.');
  }

  if (item.term.length > VOCABULARY_CONSTANTS.VALIDATION.MAX_TERM_LENGTH) throw new Error('Term exceeds maximum length');
  if (item.meaning.length > VOCABULARY_CONSTANTS.VALIDATION.MAX_MEANING_LENGTH) throw new Error('Meaning exceeds maximum length');
  if (item.example && item.example.length > VOCABULARY_CONSTANTS.VALIDATION.MAX_EXAMPLE_LENGTH) throw new Error('Example exceeds maximum length');
};

const generateSearchTerms = (term: string, meaning: string, example?: string): string[] => {
  const terms = new Set<string>();
  const { STOP_WORDS } = VOCABULARY_CONSTANTS.SEARCH;
  
  const tokenize = (text: string | undefined) => {
    if (!text) return;
    text.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2 && !STOP_WORDS.has(word))
      .forEach(t => terms.add(t));
  };

  tokenize(term);
  tokenize(meaning);
  tokenize(example);
  
  terms.add(term.toLowerCase());
  terms.add(meaning.toLowerCase());
  
  return Array.from(terms);
};

export async function addVocabularyItem(
  user: AuthUser,
  itemData: Omit<VocabularyItem, 'id' | 'userId' | 'createdAt' | 'srsState' | 'memoryStrength' | 'streak' | 'attempts' | 'lastReviewed' | 'dueDate'>
): Promise<VocabularyItem> {
  console.log('[addVocabularyItem] START - Term:', itemData.term);
  
  validateVocabItem(itemData);
  const localDb = getLocalDbForUser(user.uid);
  const folderName = itemData.folder?.trim() || UNORGANIZED_FOLDER_NAME;

  try {
    // Generate ID OUTSIDE the transaction to check for collisions properly
    const itemId = await generateUniqueId(localDb, user.uid);
    console.log('[addVocabularyItem] Generated ID:', itemId);
    
    const addedItem = await localDb.transaction('rw', localDb.vocabulary, async () => {
      const now = new Date();
      
      const newItemData: VocabularyItem = {
        ...itemData,
        id: itemId,
        userId: user.uid,
        createdAt: now,
        srsState: 'new',
        memoryStrength: 0,
        streak: 0,
        attempts: 0,
        lastReviewed: null,
        dueDate: now,
        sourceTitle: itemData.sourceTitle || { en: 'Manual Entry' },
        folder: folderName === UNORGANIZED_FOLDER_NAME ? undefined : folderName,
        searchTerms: generateSearchTerms(itemData.term, itemData.meaning, itemData.example),
        context: itemData.context,
      };

      const finalItem = removeUndefinedProps(newItemData);
      
      console.log('[addVocabularyItem] About to add to DB:', finalItem.id);
      
      // CRITICAL FIX: Use put() instead of add() to handle potential duplicates gracefully
      // Actually, let's stick with add() but with better error handling
      try {
        await localDb.vocabulary.add(finalItem);
        console.log('[addVocabularyItem] ✅ Successfully added to DB');
      } catch (addError: any) {
        console.error('[addVocabularyItem] ❌ Error adding to DB:', addError);
        if (addError.name === 'ConstraintError') {
          // Check if item actually exists
          const existing = await localDb.vocabulary.get(itemId);
          console.error('[addVocabularyItem] Existing item:', existing);
        }
        throw addError;
      }
      
      return finalItem;
    });

    if (!addedItem) {
      throw new Error("Failed to create vocabulary item in local database transaction.");
    }
    
    console.log('[addVocabularyItem] Transaction complete, enqueuing sync');
    
    const payloadForSync: Partial<VocabularyItem> = { ...addedItem };
    delete (payloadForSync as any).id;

    await enqueueSync(user.uid, {
      type: 'create',
      table: 'vocabulary',
      key: addedItem.id,
      payload: payloadForSync,
    });
    
    const userDocRef = doc(db, 'users', user.uid);
    await updateDoc(userDocRef, { 'stats.vocabSaved': increment(1) });
    
    await checkAndUnlockAchievements(user.uid);

    console.log('[addVocabularyItem] ✅ COMPLETE - ID:', addedItem.id);
    return addedItem;
  } catch (error: any) {
    console.error('[addVocabularyItem] ❌ FAILED:', error);
    console.error('[addVocabularyItem] Error name:', error.name);
    console.error('[addVocabularyItem] Error message:', error.message);
    throw error;
  }
}

export async function updateVocabularyItem(
  user: AuthUser,
  itemId: string,
  updates: Partial<Omit<VocabularyItem, 'id' | 'userId' | 'createdAt'>>
): Promise<VocabularyItem> {
  const localDb = getLocalDbForUser(user.uid);
  if (!itemId) throw new Error('Item ID is required for update');

  try {
    const updatedItem = await localDb.transaction('rw', localDb.vocabulary, async () => {
      const existingItem = await localDb.vocabulary.get(itemId);
      if (!existingItem) throw new Error('Vocabulary item not found');

      const mergedItem = { ...existingItem, ...updates };
      validateVocabItem(mergedItem);

      const finalUpdates: Partial<VocabularyItem> = removeUndefinedProps(updates);
      
      if (finalUpdates.term || finalUpdates.meaning || finalUpdates.example) {
        const newTerm = (finalUpdates.term || existingItem.term);
        const newMeaning = (finalUpdates.meaning || existingItem.meaning);
        const newExample = (finalUpdates.example || existingItem.example);
        
        finalUpdates.searchTerms = generateSearchTerms(newTerm, newMeaning, newExample);
      }
      
      await localDb.vocabulary.update(itemId, finalUpdates);
      return { ...existingItem, ...finalUpdates };
    });
    
    if (!updatedItem) {
        throw new Error("Failed to update item in local database transaction.");
    }

    const payloadForSync: Partial<VocabularyItem> = removeUndefinedProps(updates);
    
    await enqueueSync(user.uid, {
        type: 'update',
        table: 'vocabulary',
        key: itemId,
        payload: payloadForSync,
    });

    return updatedItem;
  } catch (error: any) {
    console.error('Error updating vocabulary item:', error);
    throw new Error(`Failed to update vocabulary item: ${error.message}`);
  }
}

export async function deleteVocabularyItem(user: AuthUser, itemId: string): Promise<void> {
  const localDb = getLocalDbForUser(user.uid);
  if (!itemId) throw new Error('Item ID is required for deletion');

  try {
    await localDb.transaction('rw', localDb.vocabulary, async () => {
      const existingItem = await localDb.vocabulary.get(itemId);
      if (existingItem) {
        await localDb.vocabulary.delete(itemId);
      }
    });
    
    await enqueueSync(user.uid, { type: 'delete', table: 'vocabulary', key: itemId });
  } catch (error: any) {
    console.error('Error deleting vocabulary item:', error);
    throw new Error(`Failed to delete vocabulary item: ${error.message}`);
  }
}

export async function getVocabularyItemsByFolder(
  userId: string,
  folder: string,
  startAfter?: any,
  itemLimit?: number,
  excludeSrsState?: SrsState,
): Promise<VocabularyItem[]> {
  const localDb = getLocalDbForUser(userId);

  try {
    let query: Collection<VocabularyItem, string>;
    
    if (folder === UNORGANIZED_FOLDER_NAME) {
      query = localDb.vocabulary.where('userId').equals(userId).filter((item: VocabularyItem) => !item.folder || item.folder.trim() === '');
    } else {
      query = localDb.vocabulary.where({ userId: userId, folder: folder });
    }

    if (excludeSrsState) {
      query = query.filter((item: VocabularyItem) => item.srsState !== excludeSrsState);
    }

    const items = await query.toArray();
    return itemLimit ? items.slice(0, itemLimit) : items;

  } catch (error) {
    console.error('Error getting vocabulary by folder:', error);
    return [];
  }
}

export async function getFoldersBySrsState(userId: string, srsState: SrsState): Promise<{ id: string; name: string; count: number }[]> {
  const localDb = getLocalDbForUser(userId);
  try {
    const items = await localDb.vocabulary.where({ userId: userId, srsState: srsState }).toArray();
    const folderMap = new Map<string, number>();
    
    items.forEach((item: VocabularyItem) => {
      const folder = (item.folder && item.folder.trim()) ? item.folder.trim() : UNORGANIZED_FOLDER_NAME;
      folderMap.set(folder, (folderMap.get(folder) || 0) + 1);
    });
    
    return Array.from(folderMap.entries()).map(([name, count]) => ({
      id: name,
      name: name === UNORGANIZED_FOLDER_NAME ? 'Unorganized' : name,
      count: count
    }));
  } catch (error) {
    console.error('Error getting folders by SRS state:', error);
    return [];
  }
}

export async function getSrsStateCounts(userId: string): Promise<Record<SrsState, number>> {
  const localDb = getLocalDbForUser(userId);
  const counts: Record<SrsState, number> = { 'new': 0, 'learning': 0, 'short-term': 0, 'long-term': 0 };
  
  try {
    await localDb.vocabulary.where('userId').equals(userId).each((item: VocabularyItem) => {
      counts[item.srsState] = (counts[item.srsState] || 0) + 1;
    });
    return counts;
  } catch (error) {
    console.error('Error getting SRS state counts:', error);
    return counts;
  }
}

export async function getVocabularyItemsByFolderAndSrsState(
  userId: string, 
  folder: string, 
  srsState: SrsState
): Promise<VocabularyItem[]> {
  const localDb = getLocalDbForUser(userId);

  try {
    let query: Collection<VocabularyItem, string>;
    
    if (folder === UNORGANIZED_FOLDER_NAME) {
      query = localDb.vocabulary
        .where('userId')
        .equals(userId)
        .filter((item: VocabularyItem) => 
          (!item.folder || item.folder.trim() === '') && 
          item.srsState === srsState
        );
    } else {
      query = localDb.vocabulary
        .where({ userId: userId, folder: folder })
        .filter((item: VocabularyItem) => item.srsState === srsState);
    }

    const items = await query.toArray();
    return items;

  } catch (error) {
    console.error(`Error getting vocabulary for folder ${folder} and state ${srsState}:`, error);
    return [];
  }
}

export async function renameFolder(userId: string, oldName: string, newName: string): Promise<number> {
    const localDb = getLocalDbForUser(userId);

    const itemsToUpdate = await localDb.vocabulary
      .where({ userId: userId, folder: oldName })
      .toArray();

    if (itemsToUpdate.length === 0) {
      return 0;
    }

    await localDb.transaction('rw', localDb.vocabulary, async () => {
        const updates = itemsToUpdate.map(item => {
            return localDb.vocabulary.update(item.id, { folder: newName });
        });
        await Promise.all(updates);
    });

    for (const item of itemsToUpdate) {
        await enqueueSync(userId, {
            type: 'update',
            table: 'vocabulary',
            key: item.id,
            payload: { folder: newName }
        });
    }
    
    return itemsToUpdate.length;
}

    
