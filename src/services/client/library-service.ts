// src/services/client/library-service.ts
'use client';

import { collection, query, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { LibraryItem, Segment } from '@/lib/types';
import { convertTimestamps } from '@/lib/utils';
import { ApiServiceError } from '@/lib/errors';
import { segmentize } from '../shared/SegmentParser';

const getLibraryCollectionPath = (userId: string) => `users/${userId}/libraryItems`;

/**
 * Fetches a single library item by its ID from the client side.
 * @param userId - The user's UID.
 * @param itemId - The ID of the item to fetch.
 * @returns A promise that resolves to the LibraryItem object or null if not found.
 */
export async function getLibraryItemById(userId: string, itemId: string): Promise<LibraryItem | null> {
    if (!userId || !itemId) return null;

    const docRef = doc(db, getLibraryCollectionPath(userId), itemId);

    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const rawData = docSnap.data();
            const item = { id: docSnap.id, ...rawData };
            
            const convertedItem = convertTimestamps(item) as LibraryItem;

            // This client-side parsing step is now DEPRECATED as content is pre-structured.
            // However, we keep it for backward compatibility with old data.
            // @ts-ignore
            if (convertedItem.content && typeof convertedItem.content === 'string') {
                console.warn(`[Compatibility] Parsing legacy string content for item ${itemId}`);
                // @ts-ignore
                const segments = segmentize(convertedItem.content as string, convertedItem.origin);
                convertedItem.content = segments;
            }


            return convertedItem;
        }
        return null;
    } catch (error) {
        console.error(`Error in getLibraryItemById (client) for item ${itemId}:`, error);
        throw new ApiServiceError('Failed to fetch library item.', 'FIRESTORE', error as Error);
    }
}


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
            const convertedItem = convertTimestamps(itemWithId) as LibraryItem;

            // @ts-ignore
            if (convertedItem.content && typeof convertedItem.content === 'string') {
                // @ts-ignore
                const segments = segmentize(convertedItem.content as string, convertedItem.origin);
                convertedItem.content = segments;
            }
            return convertedItem;
          });
    } catch (error) {
      console.error('Error in getLibraryItemsByIds (client):', error);
      throw new ApiServiceError('Failed to fetch library items by IDs.', 'FIRESTORE', error as Error);
    }
}
