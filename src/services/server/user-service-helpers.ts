// src/services/server/user-service-helpers.ts
'use server';

import { cookies } from 'next/headers';
import { getAuthAdmin } from '@/lib/firebase-admin';
import { ApiServiceError } from '@/lib/errors';

/**
 * Extracts the user ID from the session cookie.
 * This is a helper function to be used by other server actions/components.
 */
export async function getUserIdFromSession(): Promise<string> {
  const cookieStore = cookies(); // ✅ FIX: Removed unnecessary 'await'
  const sessionCookie = cookieStore.get('__session')?.value;
  
  if (!sessionCookie) {
    throw new ApiServiceError('No session cookie found. Please log in again.', 'AUTH');
  }

  try {
    const authAdmin = getAuthAdmin();
    const decodedClaims = await authAdmin.verifySessionCookie(sessionCookie, true);
    return decodedClaims.uid;
  } catch (error: any) {
    console.error('❌ [USER HELPER] Session verification failed:', error.code);
    throw new ApiServiceError('Invalid or expired session. Please log in again.', 'AUTH');
  }
}
