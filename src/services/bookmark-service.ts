
'use server';

import { getAdminDb } from '@/lib/firebase-admin';
import type { SystemBookmark, BookmarkMetadata } from '@/lib/types';
import { ApiServiceError } from '@/lib/errors';
import { convertTimestamps } from '@/lib/utils';
import { initializeApp, getApps, getApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';


/**
 * Fetches the public, visual design data for all published system bookmarks.
 * This function connects directly to Project B's Firestore instance for read-only access.
 * @returns An array of SystemBookmark objects containing design information.
 */
export async function getSystemBookmarks(): Promise<SystemBookmark[]> {
    // Hardcoded HSL values from globals.css to ensure correct rendering inside SVG data URI.
    const accentColor = 'hsl(51 100% 50%)'; // The yellow color
    const primaryColor = 'hsl(348 83% 47%)'; // The red color

    const initialSvg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 100'><polygon points='0,0 80,0 80,100 40,85 0,100' style='fill:${accentColor};'/></svg>`;
    const completedSvg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 100'><polygon points='0,0 80,0 80,100 40,85 0,100' style='fill:${primaryColor};'/></svg>`;

    const defaultBookmark: SystemBookmark = {
        id: 'default',
        name: 'Default Bookmark',
        description: 'The standard bookmark style.',
        initialState: {
          mainVisual: {
            value: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(initialSvg)}`,
          },
        },
        completedState: {
          mainVisual: {
            value: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(completedSvg)}`,
          },
        }
    };
    
    const secondaryFirebaseConfig: FirebaseOptions = {
      apiKey: process.env.NEXT_PUBLIC_SECONDARY_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_SECONDARY_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_SECONDARY_FIREBASE_PROJECT_ID,
    };
    
    if (!secondaryFirebaseConfig.apiKey || secondaryFirebaseConfig.apiKey.includes("YOUR_SECONDARY_API_KEY")) {
      console.warn("Secondary Firebase project is not configured. System bookmarks will not be loaded.");
      return [defaultBookmark];
    }

    try {
        const secondaryAppName = 'client-secondary-firebase-app';
        const existingApp = getApps().find(app => app.name === secondaryAppName);
        const secondaryApp = existingApp || initializeApp(secondaryFirebaseConfig, secondaryAppName);
        const secondaryDb = getFirestore(secondaryApp);

        const bookmarksCollection = collection(secondaryDb, "chirpter_consumableBookmarks");
        const q = query(bookmarksCollection, where("status", "==", "published"));
        const querySnapshot = await getDocs(q);

        const publishedBookmarks = querySnapshot.docs.map(doc => {
            const data = doc.data();
            // Ensure all required fields are mapped correctly and safely
            return {
                id: doc.id,
                name: data.name,
                description: data.description,
                initialState: {
                    mainVisual: data.initialState?.mainVisual,
                    customCss: data.initialState?.customCss,
                    sound: data.initialState?.sound,
                },
                completedState: {
                    mainVisual: data.completedState?.mainVisual,
                    customCss: data.completedState?.customCss,
                    sound: data.completedState?.sound,
                },
            } as SystemBookmark;
        });
        
        const filteredBookmarks = publishedBookmarks.filter(b => b.id !== 'default');
        return [defaultBookmark, ...filteredBookmarks];

    } catch (error) {
        console.error("Error fetching system bookmarks directly:", error);
        return [defaultBookmark];
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
