
'use server';

import { getAdminDb } from '@/lib/firebase-admin';
import type { SystemBookmark, BookmarkMetadata } from '@/lib/types';
import { ApiServiceError } from '@/lib/errors';
import { convertTimestamps } from '@/lib/utils';

/**
 * Fetches all system-defined bookmarks from Firestore.
 * This is a server-side function.
 */
export async function getSystemBookmarks(): Promise<SystemBookmark[]> {
    try {
        const adminDb = getAdminDb();
        const querySnapshot = await adminDb.collection('systemBookmarks').get();
        return querySnapshot.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() }) as SystemBookmark);
    } catch (error) {
        console.error("Error fetching system bookmarks:", error);
        throw new ApiServiceError('Failed to fetch system bookmarks.', 'FIRESTORE', error as Error);
    }
}

/**
 * Fetches all metadata for bookmarks, such as price and status.
 * This is a server-side function.
 */
export async function getBookmarkMetadata(): Promise<BookmarkMetadata[]> {
    try {
        const adminDb = getAdminDb();
        const querySnapshot = await adminDb.collection('bookmarkMetadata').get();
        return querySnapshot.docs.map(doc => convertTimestamps({ id: doc.id, ...doc.data() }) as BookmarkMetadata);
    } catch (error) {
        console.error("Error fetching bookmark metadata:", error);
        throw new ApiServiceError('Failed to fetch bookmark metadata.', 'FIRESTORE', error as Error);
    }
}
