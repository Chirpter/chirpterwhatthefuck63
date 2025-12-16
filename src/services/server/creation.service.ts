// src/services/server/creation.service.ts
'use server';

import { getUserIdFromSession } from './user-service-helpers';
import { getAdminDb, FieldValue } from '@/lib/firebase-admin';
import type { CreationFormValues } from '@/lib/types';
import { createBookAndStartGeneration } from './book-creation.service';
import { createPieceAndStartGeneration } from './piece-creation.service';
import { ApiServiceError } from '@/lib/errors';

/**
 * Validates the origin format against other form data.
 */
function validateOriginFormat(formData: CreationFormValues): void {
  const { origin, primaryLanguage, availableLanguages, unit } = formData;
  
  const parts = origin.split('-');
  const [primary, secondary, format] = parts;
  
  if (primary !== primaryLanguage) {
    throw new ApiServiceError(`Origin primary language (${primary}) doesn't match selected primary language (${primaryLanguage})`, 'VALIDATION');
  }
  
  if (availableLanguages.length > 1) {
    if (!secondary) throw new ApiServiceError('Bilingual mode selected but origin format is monolingual', 'VALIDATION');
    if (!availableLanguages.includes(secondary)) throw new ApiServiceError(`Origin secondary language (${secondary}) not in available languages`, 'VALIDATION');
  } else {
    if (secondary) throw new ApiServiceError('Monolingual mode selected but origin format is bilingual', 'VALIDATION');
  }
  
  if (format && format !== 'ph') {
    throw new ApiServiceError(`Invalid format flag in origin: ${format}. Only 'ph' is allowed.`, 'VALIDATION');
  }
  
  if ((unit === 'phrase' && format !== 'ph') || (unit !== 'phrase' && format === 'ph')) {
    throw new ApiServiceError(`Origin format mismatch: unit is '${unit}' and origin format flag is '${format || 'none'}'.`, 'VALIDATION');
  }
}

/**
 * ✅ MAIN FACADE: Routes creation requests to the appropriate service.
 */
export async function createLibraryItem(type: 'book' | 'piece', formData: CreationFormValues): Promise<string> {
  console.log('📝 [Creation Service] Starting creation for type:', type);
  
  const userId = await getUserIdFromSession();
  
  validateOriginFormat(formData);
  
  try {
    if (type === 'book') {
      const bookId = await createBookAndStartGeneration(userId, formData);
      console.log('✅ [Creation Service] Book created:', bookId);
      return bookId;
    } else if (type === 'piece') {
      const pieceId = await createPieceAndStartGeneration(userId, formData);
      console.log('✅ [Creation Service] Piece created:', pieceId);
      return pieceId;
    } else {
      throw new ApiServiceError(`Unknown content type: ${type}`, 'VALIDATION');
    }
  } catch (error: any) {
    console.error('❌ [Creation Service] Failed:', error.message);
    
    if (error instanceof ApiServiceError) {
      throw error;
    }
    
    throw new ApiServiceError(error.message || 'Creation failed unexpectedly', 'UNKNOWN', error);
  }
}
