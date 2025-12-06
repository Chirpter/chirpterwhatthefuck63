
// src/features/diary/services/diary-service.ts

import { getLocalDbForUser } from './local-database';
import type { DiaryEntry, DiaryObject } from '@/features/diary/types';

/**
 * Gets all diary entries for a user, sorted by id.
 * @param userId The UID of the user.
 * @returns A promise that resolves to an array of DiaryEntry objects.
 */
export async function getDiaryEntries(userId: string): Promise<DiaryEntry[]> {
  const db = getLocalDbForUser(userId);
  return await db.diary.orderBy('id').toArray();
}

/**
 * Creates the first two diary entries for a new user to ensure a full spread.
 * This function is idempotent and safe to call multiple times.
 * It now ensures consistent, sequential IDs.
 * @param userId The UID of the user.
 */
export async function createInitialDiaryEntries(userId: string): Promise<void> {
    const db = getLocalDbForUser(userId);
    const count = await db.diary.count();
    
    if (count > 0) {
      return;
    }

    await db.transaction('rw', db.diary, async () => {
        const newEntry1: DiaryEntry = { id: 1, date: '', objects: [] };
        const newEntry2: DiaryEntry = { id: 2, date: '', objects: [] };
        await db.diary.bulkAdd([newEntry1, newEntry2]);
    });
}

/**
 * Adds a new two-page spread to the diary with explicit, sequential IDs.
 * @param userId The UID of the user.
 */
export async function addNewPageSpread(userId: string): Promise<void> {
  const db = getLocalDbForUser(userId);

  await db.transaction('rw', db.diary, async () => {
    const lastEntry = await db.diary.orderBy('id').last();
    let nextId = lastEntry ? lastEntry.id! + 1 : 1;

    const newPages: DiaryEntry[] = [];
    
    // If the current number of pages (based on last ID) is odd, add one page to complete the spread.
    if ((lastEntry?.id || 0) % 2 !== 0) {
        newPages.push({ id: nextId++, date: '', objects: [] });
    }
    
    // Then add a new full spread.
    newPages.push(
      { id: nextId++, date: '', objects: [] },
      { id: nextId++, date: '', objects: [] }
    );
    
    await db.diary.bulkAdd(newPages);
  });
}


/**
 * REFACTORED: Automatically cleans up empty "sheets" (pairs of pages) from the end of the diary.
 * This version uses a simpler, more robust logic to ensure correctness.
 * It will not remove the first sheet (pages 1 and 2).
 * @param userId The UID of the user.
 */
export async function cleanupEmptyTrailingPages(userId: string): Promise<void> {
    const db = getLocalDbForUser(userId);

    await db.transaction('rw', db.diary, async () => {
        // Fetch all entries, sort by ID descending to start from the end.
        const allEntries = await db.diary.orderBy('id').reverse().toArray();

        if (allEntries.length <= 2) {
            return; // Don't clean up the first sheet
        }

        const idsToDelete: number[] = [];
        
        // Iterate through the entries in pairs from the end.
        for (let i = 0; i < allEntries.length; i += 2) {
            const page1 = allEntries[i];
            const page2 = allEntries[i + 1];

            // Stop if we reach the first sheet (ID 1 or 2).
            if (page1?.id <= 2 || page2?.id <= 2) {
                break;
            }

            const isPage1Empty = !page1 || page1.objects.length === 0;
            const isPage2Empty = !page2 || page2.objects.length === 0;

            if (isPage1Empty && isPage2Empty) {
                if (page1?.id) idsToDelete.push(page1.id);
                if (page2?.id) idsToDelete.push(page2.id);
            } else {
                // Stop at the first non-empty sheet from the end.
                break;
            }
        }
        
        if (idsToDelete.length > 0) {
            await db.diary.bulkDelete(idsToDelete);
        }
    });
}

/**
 * Adds multiple new objects to a specific diary entry.
 * @param userId The UID of the user.
 * @param entryId The ID of the diary entry.
 * @param objects An array of new DiaryObject to add.
 * @returns A promise that resolves when the operation is complete.
 */
export async function addObjectsToDiary(userId: string, entryId: number, objects: DiaryObject[]): Promise<void> {
  const db = getLocalDbForUser(userId);
  await db.diary.where('id').equals(entryId).modify((entry: DiaryEntry) => {
    entry.objects.push(...objects);
  });
}


/**
 * Updates an existing object within a diary entry.
 * @param userId The UID of the user.
 * @param entryId The ID of the diary entry.
 * @param objectId The ID of the object to update.
 * @param updates A partial object with the fields to update.
 * @returns A promise that resolves when the operation is complete.
 */
export async function updateDiaryObject(userId: string, entryId: number, objectId: string, updates: Partial<DiaryObject>): Promise<void> {
  const db = getLocalDbForUser(userId);
  await db.diary.where('id').equals(entryId).modify((entry: DiaryEntry) => {
    const objectIndex = entry.objects.findIndex(obj => obj.id === objectId);
    if (objectIndex !== -1) {
      const originalObject = entry.objects[objectIndex];
      const newMetadata = updates.metadata 
        ? { ...originalObject.metadata, ...updates.metadata } 
        : originalObject.metadata;
      
      entry.objects[objectIndex] = { ...originalObject, ...updates, metadata: newMetadata } as DiaryObject;
    }
  });
}

/**
 * Deletes an object from a diary entry.
 * @param userId The UID of the user.
 * @param entryId The ID of the diary entry.
 * @param objectId The ID of the object to delete.
 * @returns A promise that resolves when the operation is complete.
 */
export async function deleteDiaryObject(userId: string, entryId: number, objectId: string): Promise<void> {
  const db = getLocalDbForUser(userId);
  await db.diary.where('id').equals(entryId).modify((entry: DiaryEntry) => {
    entry.objects = entry.objects.filter(obj => obj.id !== objectId);
  });
}

/**
 * Updates top-level properties of a diary entry, like its date.
 * @param userId The UID of the user.
 * @param entryId The ID of the diary entry.
 * @param updates A partial object with the fields to update.
 */
export async function updateDiaryEntry(userId: string, entryId: number, updates: Partial<Pick<DiaryEntry, 'date' | 'mood'>>): Promise<void> {
    const db = getLocalDbForUser(userId);
    await db.diary.update(entryId, updates);
}
