
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const USERS_COLLECTION = 'users';

/**
 * Grants admin role to a user.
 * In a real-world production app, this would be a secured cloud function.
 * For this development environment, we allow a client-side call for the first admin.
 * @param userId The UID of the user to grant admin role.
 */
export async function grantAdminRole(userId: string): Promise<void> {
  const userDocRef = doc(db, USERS_COLLECTION, userId);
  try {
    await updateDoc(userDocRef, {
      role: 'admin',
    });
    console.log(`Successfully granted admin role to user ${userId}`);
  } catch (error) {
    console.error(`Error granting admin role to ${userId}:`, error);
    throw new Error('Failed to update user role.');
  }
}
