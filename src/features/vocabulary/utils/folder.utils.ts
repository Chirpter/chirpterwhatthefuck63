// src/features/vocabulary/utils/folder.utils.ts

import { FOLDER_CONSTANTS } from '../constants';

/**
 * Resolves the folder name for database storage.
 * - 'unorganized' becomes undefined.
 * - 'new' uses the newFolderName provided.
 * @returns The processed folder name or undefined.
 */
export function resolveFolderForStorage(
  folder: string,
  isCreatingNew: boolean,
  newFolderName: string
): string | undefined {
  if (isCreatingNew) {
    const trimmed = newFolderName.trim();
    if (!trimmed) {
      throw new Error("Folder name cannot be empty");
    }
    return trimmed;
  }
  
  return folder === FOLDER_CONSTANTS.UNORGANIZED ? undefined : folder;
}

/**
 * Resolves the folder name for display purposes.
 * - undefined or empty string becomes 'unorganized'.
 * @returns The display-friendly folder name.
 */
export function resolveFolderForDisplay(folder: string | undefined): string {
  return folder?.trim() || FOLDER_CONSTANTS.UNORGANIZED;
}

/**
 * Checks if a folder name represents the "unorganized" state.
 * @returns True if the folder is unorganized, false otherwise.
 */
export function isUnorganizedFolder(folder: string | undefined): boolean {
  return !folder || folder.trim() === '' || folder === FOLDER_CONSTANTS.UNORGANIZED;
}
