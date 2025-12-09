
'use server';

import { createPieceAndStartGeneration } from '@/services/piece-creation.service';
import type { PieceFormValues } from '@/lib/types';

/**
 * @fileoverview This flow is now a thin wrapper. It delegates the entire creation
 * and generation process to the `piece-creation.service`.
 */

export async function generatePieceContent(userId: string, input: PieceFormValues): Promise<string> {
  // Delegate the entire process to the dedicated service.
  return createPieceAndStartGeneration(userId, input);
}

    