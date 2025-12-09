'use server';

import type { CreationFormValues } from '@/lib/types';
import { createBookAndStartGeneration } from './book-creation.service';
import { createPieceAndStartGeneration } from './piece-creation.service';
import { ApiServiceError } from '@/lib/errors';
import { getAdminDb } from '@/lib/firebase-admin';

/**
 * @fileoverview This service acts as a "Facade" for all content creation requests.
 * The client-side hooks call the single `createLibraryItem` function, which then
 * delegates the request to the appropriate specialized service (`book` or `piece`).
 * This decouples the client from the server-side implementation details.
 */

/**
 * The single entry point for creating any type of library item from the client.
 * It validates the request and routes it to the correct generation service.
 * @param formData - The data from the creation form, including the `type` field.
 * @returns The ID of the newly created and processing library item.
 */
export async function createLibraryItem(formData: CreationFormValues): Promise<string> {
    // On the server, you must always validate the user's identity.
    const adminDb = getAdminDb();
    // In a real app, you'd get the UID from a verified session token.
    // For this context, we'll assume a single-user development environment
    // and fetch the first user as a placeholder for the current user.
    const userSnapshot = await adminDb.collection('users').limit(1).get();
    if (userSnapshot.empty) {
        throw new ApiServiceError("No users found in the database.", "AUTH");
    }
    const user = userSnapshot.docs[0].data();
    
    if (!user) {
        throw new ApiServiceError("User not authenticated. Please log in.", "AUTH");
    }

    // Route the request based on the `type` property in the form data.
    switch (formData.type) {
        case 'book':
            return createBookAndStartGeneration(user.uid, formData);
        case 'piece':
            return createPieceAndStartGeneration(user.uid, formData);
        default:
            // This ensures that if a new type is added to the union but not here, TypeScript will error.
            const _exhaustiveCheck: never = formData.type;
            throw new ApiServiceError("Invalid item type provided.", "VALIDATION");
    }
}
