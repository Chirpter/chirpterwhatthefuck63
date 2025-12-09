

'use server';

/**
 * @fileOverview A flow to generate book content. This file is now a thin wrapper
 * that calls the main business logic located in the book-creation service.
 * This adheres to the principle of keeping AI flows focused on AI interaction
 * and separating business logic.
 */

import type { GenerateBookContentInput } from '@/lib/types';
import { createBookAndStartGeneration } from '@/services/book-creation.service';

/**
 * Generates book content by invoking the book creation service.
 * The service handles all the complex logic of prompt engineering, AI calls,
 * data parsing, and final object assembly.
 *
 * @param userId - The ID of the user creating the book.
 * @param input - The structured input data for book generation.
 * @returns A promise that resolves to the ID of the newly created book document.
 */
export async function generateBookContent(userId: string, input: GenerateBookContentInput): Promise<string> {
  // Delegate the entire process to the dedicated service.
  // The service will handle creating the initial document, running the AI pipeline,
  // and updating the document with the final content.
  return createBookAndStartGeneration(userId, input);
}
