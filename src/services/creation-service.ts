// src/services/creation-service.ts - PRODUCTION READY
'use server';

import { cookies } from 'next/headers';
import { getAuthAdmin, getAdminDb } from '@/lib/firebase-admin';
import type { CreationFormValues } from '@/lib/types';
import { createBookAndStartGeneration } from './book-creation.service';
import { createPieceAndStartGeneration } from './piece-creation.service';
import { ApiServiceError } from '@/lib/errors';

/**
 * ✅ FIX DEV-002: Extract userId from session cookie instead of using .limit(1)
 */
async function getUserIdFromSession(): Promise<string> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  
  if (!sessionCookie) {
    throw new ApiServiceError('No session cookie found. Please log in again.', 'AUTH');
  }

  try {
    const authAdmin = getAuthAdmin();
    const decodedClaims = await authAdmin.verifySessionCookie(sessionCookie, true);
    return decodedClaims.uid;
  } catch (error: any) {
    console.error('❌ [Creation Service] Session verification failed:', error.code);
    throw new ApiServiceError('Invalid or expired session. Please log in again.', 'AUTH');
  }
}

/**
 * ✅ VALIDATION: Ensure origin format matches spec requirements
 */
function validateOriginFormat(formData: CreationFormValues): void {
  const { origin, primaryLanguage, availableLanguages } = formData;
  
  // Valid formats: "en", "en-vi", "en-vi-ph"
  const parts = origin.split('-');
  const [primary, secondary, format] = parts;
  
  // Check primary language matches
  if (primary !== primaryLanguage) {
    throw new ApiServiceError(
      `Origin primary language (${primary}) doesn't match selected primary language (${primaryLanguage})`,
      'VALIDATION'
    );
  }
  
  // Check bilingual consistency
  if (availableLanguages.length > 1) {
    if (!secondary) {
      throw new ApiServiceError(
        'Bilingual mode selected but origin format is monolingual',
        'VALIDATION'
      );
    }
    if (!availableLanguages.includes(secondary)) {
      throw new ApiServiceError(
        `Origin secondary language (${secondary}) not in available languages`,
        'VALIDATION'
      );
    }
  } else {
    if (secondary) {
      throw new ApiServiceError(
        'Monolingual mode selected but origin format is bilingual',
        'VALIDATION'
      );
    }
  }
  
  // Check format flag
  if (format && format !== 'ph') {
    throw new ApiServiceError(
      `Invalid format flag in origin: ${format}. Only 'ph' is allowed.`,
      'VALIDATION'
    );
  }
}

/**
 * ✅ MAIN FACADE: Route creation requests to appropriate service
 */
export async function createLibraryItem(formData: CreationFormValues): Promise<string> {
  console.log('📝 [Creation Service] Starting creation for type:', formData.type);
  
  // Step 1: Extract authenticated user ID
  const userId = await getUserIdFromSession();
  
  // Step 2: Validate origin format
  validateOriginFormat(formData);
  
  // Step 3: Route to appropriate service
  try {
    if (formData.type === 'book') {
      const bookId = await createBookAndStartGeneration(userId, formData);
      console.log('✅ [Creation Service] Book created:', bookId);
      return bookId;
    } else if (formData.type === 'piece') {
      const pieceId = await createPieceAndStartGeneration(userId, formData);
      console.log('✅ [Creation Service] Piece created:', pieceId);
      return pieceId;
    } else {
      throw new ApiServiceError(
        `Unknown content type: ${formData.type}`,
        'VALIDATION'
      );
    }
  } catch (error: any) {
    console.error('❌ [Creation Service] Failed:', error.message);
    
    // Re-throw with better error message
    if (error instanceof ApiServiceError) {
      throw error;
    }
    
    throw new ApiServiceError(
      error.message || 'Creation failed unexpectedly',
      'UNKNOWN',
      error
    );
  }
}