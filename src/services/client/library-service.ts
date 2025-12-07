// src/services/client/library-service.ts
'use client';

import { collection, query, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { LibraryItem } from '@/lib/types';
import { convertTimestamps } from '@/lib/utils';
import { ApiServiceError } from '@/lib/errors';

const getLibraryCollectionPath = (userId: string) => `users/${userId}/libraryItems`;

/**
 * Fetches multiple library items by their IDs from the client side.
 * @param userId - The user's UID.
 * @param itemIds - An array of item IDs to fetch.
 * @returns A promise that resolves to an array of LibraryItem objects.
 */
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
      console.error('Error in getLibraryItemsByIds (client):', error);
      throw new ApiServiceError('Failed to fetch library items by IDs.', 'FIRESTORE', error as Error);
    }
}
