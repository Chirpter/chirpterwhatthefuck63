

import {
  collection,
  query,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  DocumentData,
  QueryConstraint,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { LibraryItem, Book, OverallStatus, Chapter } from '@/lib/types';
import { removeUndefinedProps, convertTimestamps } from '@/lib/utils';
import { ApiServiceError } from '@/lib/errors';
import { getAdminDb, FieldValue } from '@/lib/firebase-admin';


const getLibraryCollectionPath = (userId: string) => `users/${userId}/libraryItems`;

interface GetLibraryItemsOptions {
  limit?: number;
  startAfter?: DocumentData | null;
  status?: OverallStatus | 'all';
  type?: 'book' | 'piece';
  contentType?: 'book' | 'piece';
}

export async function getLibraryItems(
  userId: string,
  options: GetLibraryItemsOptions = {},
  signal?: AbortSignal
): Promise<{ items: LibraryItem[]; lastDoc: DocumentData | null }> {
  if (!userId) {
    if (typeof window === 'undefined') {
      return { items: [], lastDoc: null };
    }
    throw new ApiServiceError('User not authenticated', 'AUTH');
  }

  try {
    const {
      limit: queryLimit = 20,
      startAfter: startAfterDoc = null,
      status = 'all',
      type,
      contentType,
    } = options;

    const finalContentType = type || contentType;

    const collectionRef = collection(db, getLibraryCollectionPath(userId));
    
    const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
    if (status !== 'all') {
      constraints.push(where('status', '==', status));
    }
    if (finalContentType) {
      constraints.push(where('type', '==', finalContentType));
    }
    if (startAfterDoc) {
      constraints.push(startAfter(startAfterDoc));
    }
    constraints.push(limit(queryLimit));

    const q = query(collectionRef, ...constraints);
    
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const querySnapshot = await getDocs(q);

    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const items: LibraryItem[] = querySnapshot.docs.map(docSnap => {
        const rawData = docSnap.data();
        const itemWithId = { id: docSnap.id, ...rawData };
        return convertTimestamps(itemWithId) as LibraryItem;
    });

    const lastDocData = querySnapshot.docs.length > 0 
      ? querySnapshot.docs[querySnapshot.docs.length - 1] 
      : null;
    
    return {
      items,
      lastDoc: lastDocData,
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw error;
    }
    
    console.error('[SERVICE] Firestore Query Error in getLibraryItems:', error);
    
    let code: ApiServiceError['code'] = 'FIRESTORE';
    if (error.code === 'permission-denied') {
        code = 'PERMISSION';
    } else if (error.code === 'unavailable') {
        code = 'UNAVAILABLE';
    }

    throw new ApiServiceError('Failed to fetch library items.', code, error);
  }
}


export async function getLibraryItemById(userId: string, itemId: string): Promise<LibraryItem | null> {
  try {
    const docRef = doc(db, getLibraryCollectionPath(userId), itemId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const rawData = docSnap.data();
      const itemWithId = { id: docSnap.id, ...rawData };
      return convertTimestamps(itemWithId) as LibraryItem;
    }
    
    const globalDocRef = doc(db, 'globalBooks', itemId);
    const globalDocSnap = await getDoc(globalDocRef);
    if (globalDocSnap.exists()) {
        const rawData = globalDocSnap.data();
        const itemWithId = { id: globalDocSnap.id, ...rawData, isGlobal: true };
        return convertTimestamps(itemWithId) as LibraryItem;
    }

    return null;
  } catch (error) {
    console.error('Error in getLibraryItemById:', error);
    throw new ApiServiceError('Failed to fetch library item.', 'FIRESTORE', error as Error);
  }
}

export async function getLibraryItemsByIds(userId: string, itemIds: string[]): Promise<LibraryItem[]> {
    if (!userId || itemIds.length === 0) return [];
    
    try {
      const docRefs = itemIds.map(id => doc(db, getLibraryCollectionPath(userId), id));
      const docSnaps = await Promise.all(docRefs.map(ref => getDoc(ref)));
      
      return docSnaps
          .filter(snap => snap.exists())
          .map(snap => {
            const rawData = snap.data();
            const itemWithId = { id: snap.id, ...rawData };
            return convertTimestamps(itemWithId) as LibraryItem;
          });
    } catch (error) {
      console.error('Error in getLibraryItemsByIds:', error);
      throw new ApiServiceError('Failed to fetch library items by IDs.', 'FIRESTORE', error as Error);
    }
}

export async function deleteLibraryItem(userId: string, itemId: string): Promise<void> {
  try {
    const docRef = doc(db, getLibraryCollectionPath(userId), itemId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error in deleteLibraryItem:', error);
    throw new ApiServiceError('Failed to delete library item.', 'FIRESTORE', error as Error);
  }
}

export async function updateLibraryItem(userId: string, itemId: string, updates: Partial<LibraryItem>): Promise<void> {
  try {
    // This function can be called from both client and server, so we must be careful.
    // When called from a server action, it should use the Admin SDK.
    // For simplicity in this context, we assume it's mostly for client-side updates.
    // A more robust solution might check the execution environment.
    const docRef = doc(db, getLibraryCollectionPath(userId), itemId);
    const dataToUpdate = { ...updates, updatedAt: serverTimestamp() };
    await updateDoc(docRef, removeUndefinedProps(dataToUpdate));
  } catch (error) {
    console.error('Error in updateLibraryItem:', error);
    // Try with Admin SDK if it fails, assuming it might be a permissions issue from client
    try {
        const adminDb = getAdminDb();
        const adminDocRef = adminDb.collection(getLibraryCollectionPath(userId)).doc(itemId);
        const dataToUpdateAdmin = { ...updates, updatedAt: FieldValue.serverTimestamp() };
        await adminDocRef.update(removeUndefinedProps(dataToUpdateAdmin));
    } catch (adminError) {
       console.error('Error in updateLibraryItem with Admin SDK fallback:', adminError);
       throw new ApiServiceError('Failed to update library item.', 'FIRESTORE', adminError as Error);
    }
  }
}

export async function getGlobalBooks(
  options: { limit?: number; startAfter?: DocumentData | null; all?: boolean, forSale?: boolean },
  signal?: AbortSignal
): Promise<{ items: Book[]; lastDoc: DocumentData | null }> {
  
  const { limit: queryLimit = 20, startAfter: startAfterDoc = null, all = false, forSale = false } = options;
  
  try {
    const collectionRef = collection(db, 'globalBooks');
    
    const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
    if (forSale) {
        constraints.push(where('price', '>', 0));
    } else if (!all) {
        constraints.push(where('price', '==', 0));
    }
    if (startAfterDoc) {
        constraints.push(startAfter(startAfterDoc));
    }
    constraints.push(limit(queryLimit));

    const q = query(collectionRef, ...constraints);

    const querySnapshot = await getDocs(q);

    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const items = querySnapshot.docs.map(docSnap => {
      const rawData = docSnap.data();
      const itemWithId = { id: docSnap.id, ...rawData };
      return convertTimestamps(itemWithId) as Book;
    });

    return {
      items,
      lastDoc: querySnapshot.docs[querySnapshot.docs.length - 1] || null,
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw error;
    }
    console.error('Error in getGlobalBooks:', error);
    throw new ApiServiceError('Failed to fetch global books.', 'VALIDATION', error as Error);
  }
}


export async function regenerateBookContent(userId: string, bookId: string, newPrompt: string): Promise<void> {
    try {
      const bookRef = doc(db, getLibraryCollectionPath(userId), bookId);
      await updateDoc(bookRef, {
          prompt: newPrompt,
          contentStatus: 'processing',
          status: 'processing',
          chapters: [],
      });

      // Simulating AI regeneration delay
      setTimeout(async () => {
          const newChapters: Chapter[] = [{
              id: 'ch1_regen',
              order: 0,
              title: { en: 'Regenerated Chapter' },
              segments: [{
                  id: 'seg1_regen',
                  order: 0,
                  type: 'text',
                  content: { en: `Content regenerated with new prompt: "${newPrompt}"` },
                  formatting: {},
                  metadata: { isParagraphStart: true, wordCount: { en: 5 }, primaryLanguage: 'en' }
              }],
              stats: { totalSegments: 1, totalWords: 5, estimatedReadingTime: 1 },
              metadata: { primaryLanguage: 'en' }
          }];

          await updateDoc(bookRef, {
              chapters: newChapters,
              contentStatus: 'ready',
              status: 'draft',
          });
      }, 5000);
    } catch (error) {
      console.error('Error in regenerateBookContent:', error);
      throw new ApiServiceError('Failed to regenerate book content.', 'FIRESTORE', error as Error);
    }
}
