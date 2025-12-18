// src/services/server/piece-creation.service.ts
'use server';

import { getAdminDb, FieldValue } from '@/lib/firebase-admin';
import type { Piece, CreationFormValues, MultilingualContent } from "@/lib/types";
import { removeUndefinedProps } from '@/lib/utils';
import { checkAndUnlockAchievements } from './achievement-service';
import { updateLibraryItem } from "./library-service";
import { OriginService } from '../shared/origin-service';
import { SegmentParser } from '../shared/segment-parser';
import { ai } from '@/services/ai/genkit';
import { z } from 'zod';
import { LANGUAGES, MAX_PROMPT_LENGTH } from '@/lib/constants';

const MAX_RETRIES = 3;

const PieceOutputSchema = z.object({
  title: z.string(),
  markdownContent: z.string(),
});

const PiecePromptInputSchema = z.object({
  userPrompt: z.string(),
  systemPrompt: z.string(),
});

/**
 * Piece Creation Service - Simplified
 * 
 * Similar to BookCreationService but for shorter content
 */
export class PieceCreationService {
  
  /**
   * Create piece and start generation
   */
  static async create(userId: string, formData: CreationFormValues): Promise<string> {
    const adminDb = getAdminDb();
    let pieceId = '';
    const creditCost = 1;

    // Transaction: Create piece + deduct credits
    await adminDb.runTransaction(async (transaction) => {
      const userDocRef = adminDb.collection('users').doc(userId);
      const userDoc = await transaction.get(userDocRef);
      
      if (!userDoc.exists) throw new Error("User not found");
      if ((userDoc.data()?.credits || 0) < creditCost) {
        throw new Error("Insufficient credits");
      }
      
      transaction.update(userDocRef, {
        credits: FieldValue.increment(-creditCost),
        'stats.piecesCreated': FieldValue.increment(1)
      });

      // Create piece document
      const newPieceRef = adminDb.collection(`users/${userId}/libraryItems`).doc();
      
      const initialPieceData: Omit<Piece, 'id'> = {
        userId,
        type: 'piece',
        title: { [formData.primaryLanguage]: formData.aiPrompt.substring(0, 50) },
        status: 'processing',
        contentState: 'processing',
        contentRetries: 0,
        origin: formData.origin, // Locked here
        langs: formData.availableLanguages,
        unit: formData.unit,
        prompt: formData.aiPrompt,
        tags: [],
        presentationStyle: formData.presentationStyle as 'doc' | 'card',
        aspectRatio: formData.aspectRatio,
        content: [],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        isBilingual: formData.availableLanguages.length > 1,
        labels: [],
      };
      
      transaction.set(newPieceRef, removeUndefinedProps(initialPieceData));
      pieceId = newPieceRef.id;
    });

    if (!pieceId) throw new Error("Failed to create piece");

    // Start background generation
    this.generateContent(userId, pieceId).catch(err => {
      console.error(`[Piece ${pieceId}] Generation failed:`, err);
    });

    return pieceId;
  }

  /**
   * Generate piece content
   */
  private static async generateContent(userId: string, pieceId: string): Promise<void> {
    const adminDb = getAdminDb();
    const pieceRef = adminDb.collection(`users/${userId}/libraryItems`).doc(pieceId);
    
    try {
      // Read piece from DB
      const pieceDoc = await pieceRef.get();
      if (!pieceDoc.exists) throw new Error('Piece not found');
      
      const piece = pieceDoc.data() as Piece;
      const { origin, prompt } = piece;

      // Parse origin
      const { primary, secondary } = OriginService.parse(origin);

      // Build prompt
      const { userPrompt, systemPrompt } = this.buildContentPrompt(
        prompt || '',
        primary,
        secondary
      );

      // Call AI
      const piecePrompt = ai.definePrompt({
        name: 'generateUnifiedPieceMarkdown_v7',
        input: { schema: PiecePromptInputSchema },
        output: { schema: PieceOutputSchema },
        prompt: `{{{userPrompt}}}\n\n{{{systemPrompt}}}`,
        config: { maxOutputTokens: 1200 }
      });

      const { output } = await piecePrompt({ userPrompt, systemPrompt });

      if (!output || !output.markdownContent) {
        throw new Error('AI returned empty content');
      }

      // Parse title
      const title = this.extractBilingualTitle(output.title, primary, secondary);

      // Parse content to segments
      const segments = SegmentParser.parse(output.markdownContent, origin);

      // Update piece
      await pieceRef.update({
        title,
        content: segments,
        contentState: 'ready',
        status: 'draft',
        contentRetries: 0,
        updatedAt: FieldValue.serverTimestamp()
      });

      // Unlock achievements
      try {
        await checkAndUnlockAchievements(userId);
      } catch (e) {
        console.warn('[Piece] Achievement check failed:', e);
      }

    } catch (error) {
      await this.handleError(userId, pieceId, error as Error);
    }
  }

  /**
   * Handle generation error with retry logic
   */
  private static async handleError(
    userId: string,
    pieceId: string,
    error: Error
  ): Promise<void> {
    
    const adminDb = getAdminDb();
    const pieceRef = adminDb.collection(`users/${userId}/libraryItems`).doc(pieceId);
    const pieceDoc = await pieceRef.get();
    const retries = (pieceDoc.data()?.contentRetries || 0) + 1;

    if (retries < MAX_RETRIES) {
      // Retry
      console.log(`[Piece ${pieceId}] Retry ${retries}/${MAX_RETRIES}`);
      await pieceRef.update({
        contentRetries: retries,
        updatedAt: FieldValue.serverTimestamp()
      });

      // Schedule retry with exponential backoff
      setTimeout(() => {
        this.generateContent(userId, pieceId);
      }, 1000 * retries);

    } else {
      // Max retries reached
      await pieceRef.update({
        contentState: 'error',
        contentError: error.message,
        status: 'draft',
        updatedAt: FieldValue.serverTimestamp()
      });
    }
  }

  /**
   * Regenerate content
   */
  static async regenerateContent(
    userId: string,
    pieceId: string,
    newPrompt?: string
  ): Promise<void> {
    
    const adminDb = getAdminDb();
    const pieceRef = adminDb.collection(`users/${userId}/libraryItems`).doc(pieceId);

    // Update status
    await adminDb.runTransaction(async (transaction) => {
      const pieceSnap = await transaction.get(pieceRef);
      if (!pieceSnap.exists) throw new Error("Piece not found");
      
      const currentData = pieceSnap.data() as Piece;
      const retries = currentData.contentRetries || 0;

      if (retries >= MAX_RETRIES) {
        throw new Error("Max retries reached");
      }

      const updates: any = {
        contentState: 'processing',
        status: 'processing',
        contentRetries: newPrompt ? 0 : retries + 1,
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (newPrompt) updates.prompt = newPrompt;
      
      transaction.update(pieceRef, updates);
    });

    // Re-run generation
    this.generateContent(userId, pieceId).catch(async (err) => {
      await updateLibraryItem(userId, pieceId, {
        status: 'draft',
        contentState: 'error',
        contentError: err.message,
      });
    });
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private static buildContentPrompt(
    userInput: string,
    primary: string,
    secondary?: string
  ): { userPrompt: string; systemPrompt: string } {
    
    const primaryLabel = LANGUAGES.find(l => l.value === primary)?.label || primary;
    const secondaryLabel = secondary ? LANGUAGES.find(l => l.value === secondary)?.label : null;

    let langInstruction = `- Write in ${primaryLabel}.`;
    let titleExample = `- Title format: My Title`;
    let sectionExample = `- Section format (if needed): # Section 1`;

    if (secondaryLabel) {
      langInstruction = `- Bilingual ${primaryLabel} and ${secondaryLabel}. Each sentence followed by translation in {curly braces}.`;
      titleExample = `- Title format: My Title {Bản dịch}`;
      sectionExample = `- Section format: # Section 1 {Phần 1}`;
    }

    const systemInstructions = [
      langInstruction,
      titleExample,
      "- Content in markdown format",
      sectionExample,
      "- Keep content under 500 words"
    ];

    const userPrompt = `Write a short piece: "${userInput.slice(0, MAX_PROMPT_LENGTH)}"`;
    const systemPrompt = `CRITICAL INSTRUCTIONS:\n${systemInstructions.join('\n')}`;

    return { userPrompt, systemPrompt };
  }

  private static extractBilingualTitle(
    title: string,
    primary: string,
    secondary?: string
  ): MultilingualContent {
    
    const cleanTitle = title.replace(/^#+\s*/, '').trim();
    
    if (secondary) {
      const match = cleanTitle.match(/^(.*?)\s*\{(.*)\}\s*$/);
      if (match) {
        return {
          [primary]: match[1].trim(),
          [secondary]: match[2].trim(),
        };
      }
    }
    
    return { [primary]: cleanTitle };
  }
}