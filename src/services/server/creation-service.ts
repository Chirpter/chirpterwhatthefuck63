// src/services/server/creation-service.ts
'use server';

import type { CreationFormValues, Book, Piece } from '@/lib/types';
import { createBookAndStartGeneration, regenerateBookContent, editBookCover } from './book-creation-service';
import { createPieceAndStartGeneration, regeneratePieceContent } from './piece-creation-service';
import { getAuthAdmin } from '@/lib/firebase-admin';
import { cookies } from 'next/headers';
import { OriginService } from '../shared/origin-service';

/**
 * @fileoverview Main entry point for content creation.
 * This server action validates the user's session and credit status,
 * then delegates the creation task to the appropriate service (book or piece).
 * It acts as a secure gateway for all content generation requests.
 */


// Helper to get user ID and validate session
async function getUserId(): Promise<string> {
    const sessionCookie = cookies().get('__session')?.value;
    if (!sessionCookie) {
        throw new Error('No session cookie found');
    }
    try {
        const decodedClaims = await getAuthAdmin().verifySessionCookie(sessionCookie, true);
        return decodedClaims.uid;
    } catch (error) {
        console.error("Invalid session cookie", error);
        throw new Error('Invalid or expired session');
    }
}

/**
 * Validates the origin format against the provided language settings.
 * This is a critical security and logic check before proceeding.
 */
function validateOrigin(formData: CreationFormValues): void {
    const { origin, availableLanguages, unit, primaryLanguage } = formData;

    const { 
        primary: originPrimary, 
        secondary: originSecondary, 
        isPhrase: originIsPhrase 
    } = OriginService.parse(origin);

    // 1. Primary language must match
    if (originPrimary !== primaryLanguage) {
        throw new Error(`Origin format '${origin}' doesn't match selected primary language '${primaryLanguage}'.`);
    }

    // 2. Bilingual mode consistency
    const isBilingualForm = availableLanguages.length > 1;
    const isBilingualOrigin = !!originSecondary;
    if (isBilingualForm !== isBilingualOrigin) {
        throw new Error(`Bilingual mode selected (${isBilingualForm}) but origin format is ${isBilingualOrigin ? 'bilingual' : 'monolingual'} ('${origin}').`);
    }

    // 3. Phrase mode consistency
    const isPhraseForm = unit === 'phrase';
    if (isPhraseForm !== originIsPhrase) {
        throw new Error(`Unit type '${unit}' does not match origin format's phrase flag.`);
    }
    
    // 4. Validate structure
    OriginService.validate(origin);
}


/**
 * Creates a library item (book or piece) based on the form data.
 * This is the primary server action called from the client.
 */
export async function createLibraryItem(formData: CreationFormValues): Promise<string> {
    const userId = await getUserId();
    
    // Server-side validation of the origin
    validateOrigin(formData);

    if (formData.type === 'book') {
        const bookId = await createBookAndStartGeneration(userId, formData);
        return bookId;
    } else if (formData.type === 'piece') {
        const pieceId = await createPieceAndStartGeneration(userId, formData);
        return pieceId;
    } else {
        throw new Error('Unknown content type specified');
    }
}
