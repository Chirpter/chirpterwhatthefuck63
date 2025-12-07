
'use server';

import { getAdminDb } from '@/lib/firebase-admin';

const USERS_COLLECTION = 'users';

/**
 * Grants admin role to a user.
 * In a real-world production app, this would be a secured cloud function.
 * For this development environment, we allow a client-side call for the first admin.
 * @param userId The UID of the user to grant admin role.
 */
export async function grantAdminRole(userId: string): Promise<void> {
  const adminDb = getAdminDb();
  const userDocRef = adminDb.collection(USERS_COLLECTION).doc(userId);
  try {
    await userDocRef.update({
      role: 'admin',
    });
    console.log(`Successfully granted admin role to user ${userId}`);
  } catch (error) {
    console.error(`Error granting admin role to ${userId}:`, error);
    throw new Error('Failed to update user role.');
  }
}
