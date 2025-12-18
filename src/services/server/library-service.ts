// src/services/server/library.service.ts
'use server';

import type { DocumentData } from 'firebase-admin/firestore';
import { getAdminDb, FieldValue } from '@/lib/firebase-admin';
import type { LibraryItem, Book, OverallStatus } from '@/lib/types';
import { removeUndefinedProps, convertTimestamps } from '@/lib/utils';
import { ApiServiceError } from '@/lib/errors';
// KHÔNG import các hàm từ book-creation-service nữa

const getLibraryCollectionPath = (userId: string) => `users/${userId}/libraryItems`;

interface GetLibraryItemsOptions {
  limit?: number;
  startAfter?: DocumentData | null;
  status?: OverallStatus | 'all';
  contentType?: 'book' | 'piece';
}

/**
 * Server-side function to fetch library items.
 */
export async function getLibraryItems(
  userId: string,
  options: GetLibraryItemsOptions = {}
): Promise<{ items: LibraryItem[]; lastDoc: DocumentData | null }> {
  if (!userId) {
    throw new ApiServiceError('User not authenticated', 'AUTH');
  }

  const {
    limit: queryLimit = 20,
    startAfter: startAfterDoc = null,
    status = 'all',
    contentType,
  } = options;

  const adminDb = getAdminDb();
  const collectionRef = adminDb.collection(getLibraryCollectionPath(userId));
  
  let query: FirebaseFirestore.Query<DocumentData> = collectionRef.orderBy('createdAt', 'desc');

  if (status !== 'all') {
    query = query.where('status', '==', status);
  }
  // ✅ This is the key change: apply the 'type' filter if it's provided.
  if (contentType) {
    query = query.where('type', '==', contentType);
  }
  if (startAfterDoc) {
    // Reconstruct the document snapshot from plain data if necessary
    const startAfterSnapshot = await adminDb.collection(getLibraryCollectionPath(userId)).doc(startAfterDoc.id).get();
    if(startAfterSnapshot.exists) {
        query = query.startAfter(startAfterSnapshot);
    }
  }
  
  query = query.limit(queryLimit);

  try {
    const querySnapshot = await query.get();
    
    const items: LibraryItem[] = querySnapshot.docs.map(docSnap => {
        const rawData = docSnap.data();
        const itemWithId = { id: docSnap.id, ...rawData };
        return convertTimestamps(itemWithId) as LibraryItem;
    });

    const lastVisible = querySnapshot.docs.length > 0 
      ? querySnapshot.docs[querySnapshot.docs.length - 1] 
      : null;
    
    // ✅ FIX: Return serializable data, not the complex DocumentSnapshot object.
    const lastDocData = lastVisible ? { id: lastVisible.id, ...lastVisible.data() } : null;
    
    return {
      items,
      lastDoc: lastDocData ? convertTimestamps(lastDocData) : null,
    };
  } catch (error: any) {
    console.error('[SERVICE] Firestore Query Error in getLibraryItems:', error);
    let code: ApiServiceError['code'] = 'FIRESTORE';
    if (error.code === 'permission-denied') code = 'PERMISSION';
    else if (error.code === 'unavailable') code = 'UNAVAILABLE';
    throw new ApiServiceError(`Failed to fetch library items: ${error.message}`, code);
  }
}

/**
 * Server-side function to delete a library item.
 */
export async function deleteLibraryItem(userId: string, itemId: string): Promise<void> {
  const adminDb = getAdminDb();
  try {
    const docRef = adminDb.collection(getLibraryCollectionPath(userId)).doc(itemId);
    await docRef.delete();
  } catch (error) {
    console.error('Error in deleteLibraryItem (server):', error);
    throw new ApiServiceError('Failed to delete library item.', 'FIRESTORE');
  }
}

/**
 * Server-side function to update a library item.
 */
export async function updateLibraryItem(userId: string, itemId: string, updates: Partial<LibraryItem>): Promise<void> {
  const adminDb = getAdminDb();
  try {
    const docRef = adminDb.collection(getLibraryCollectionPath(userId)).doc(itemId);
    const dataToUpdate = { ...updates, updatedAt: FieldValue.serverTimestamp() };
    await docRef.update(removeUndefinedProps(dataToUpdate));
  } catch (error) {
    console.error('Error in updateLibraryItem (server):', error);
    throw new ApiServiceError('Failed to update library item.', 'FIRESTORE');
  }
}

/**
 * Server-side function to fetch global books.
 */
export async function getGlobalBooks(
  options: { limit?: number; startAfter?: DocumentData | null; all?: boolean, forSale?: boolean },
  signal?: AbortSignal
): Promise<{ items: Book[]; lastDoc: DocumentData | null }> {
  
  const { limit: queryLimit = 20, startAfter: startAfterDoc = null, all = false, forSale = false } = options;
  const adminDb = getAdminDb();
  
  try {
    const collectionRef = adminDb.collection('globalBooks');
    let query: FirebaseFirestore.Query<DocumentData> = collectionRef.orderBy('createdAt', 'desc');

    if (forSale) {
        query = query.where('price', '>', 0);
    } else if (!all) {
        query = query.where('price', '==', 0);
    }
    if (startAfterDoc) {
        const startAfterSnapshot = await adminDb.collection('globalBooks').doc(startAfterDoc.id).get();
        if(startAfterSnapshot.exists) {
           query = query.startAfter(startAfterSnapshot);
        }
    }
    
    query = query.limit(queryLimit);

    const querySnapshot = await query.get();

    if (signal?.aborted) throw new Error("Aborted");

    const items = querySnapshot.docs.map(docSnap => {
      const rawData = docSnap.data();
      return convertTimestamps({ id: docSnap.id, ...rawData }) as Book;
    });

    const lastVisible = querySnapshot.docs.length > 0 ? querySnapshot.docs[querySnapshot.docs.length - 1] : null;
    const lastDocData = lastVisible ? { id: lastVisible.id, ...lastVisible.data() } : null;

    return {
      items,
      lastDoc: lastDocData ? convertTimestamps(lastDocData) : null,
    };
  } catch (error: any) {
    console.error('Error in getGlobalBooks (server):', error);
    throw new ApiServiceError('Failed to fetch global books.', 'FIRESTORE');
  }
}


export async function getLibraryItemById(userId: string, itemId: string): Promise<LibraryItem | null> {
    if (!userId || !itemId) return null;
    const adminDb = getAdminDb();
    const docRef = adminDb.collection(getLibraryCollectionPath(userId)).doc(itemId);
    
    try {
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            const rawData = docSnap.data();
            const item = { id: docSnap.id, ...rawData };
            return convertTimestamps(item) as LibraryItem;
        }
        return null;
    } catch (error) {
        console.error(`Error fetching item ${itemId} (server):`, error);
        throw new ApiServiceError('Failed to fetch library item.', 'FIRESTORE');
    }
}
