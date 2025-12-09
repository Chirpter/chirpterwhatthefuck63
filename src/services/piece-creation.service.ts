
'use server';

import { getAdminDb, FieldValue } from '@/lib/firebase-admin';
import type { Piece, PieceFormValues } from "@/lib/types";
import { removeUndefinedProps } from "@/lib/utils";
import { checkAndUnlockAchievements } from './achievement-service';
import { updateLibraryItem } from "./library-service";
import { ApiServiceError } from "../lib/errors";
import { parseMarkdownToSegments } from './MarkdownParser';
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { LANGUAGES, MAX_PROMPT_LENGTH } from '@/lib/constants';

const PieceOutputSchema = z.object({
  markdownContent: z.string().describe("A single, unified Markdown string that contains the entire piece content, including the title (as a Level 1 Markdown heading, e.g., '# Title')."),
});

const PiecePromptInputSchema = z.object({
    fullInstruction: z.string(),
});

function getLibraryCollectionPath(userId: string): string {
    return `users/${userId}/libraryItems`;
}

/**
 * NEW: This is the server action entrypoint.
 * It delegates the entire creation and generation process to other functions in this service.
 */
export async function generatePieceContent(userId: string, input: PieceFormValues): Promise<string> {
  // Delegate the entire process to the dedicated service.
  return createPieceAndStartGeneration(userId, input);
}

/**
 * The main pipeline for processing "piece" generation.
 */
async function processPieceGenerationPipeline(userId: string, pieceId: string, pieceFormData: PieceFormValues): Promise<void> {
    let finalUpdate: Partial<Piece>;

    try {
        const contentResult = await generateSinglePieceContent(pieceFormData);
        if (!contentResult || !contentResult.generatedContent) {
            throw new ApiServiceError("AI returned empty or invalid content for the piece.", "UNKNOWN");
        }

        finalUpdate = {
            title: contentResult.title,
            generatedContent: contentResult.generatedContent,
            contentState: 'ready',
            status: 'draft',
            contentRetryCount: 0,
        };
    } catch (err) {
        const errorMessage = (err as Error).message;
        console.error(`Piece content generation failed for item ${pieceId}:`, errorMessage);
        finalUpdate = {
            contentState: 'error',
            status: 'draft',
            contentError: errorMessage,
        };
    }
    
    await updateLibraryItem(userId, pieceId, finalUpdate);
    
    // Post-generation achievement check
    try {
        await checkAndUnlockAchievements(userId);
    } catch(e) {
        console.warn("[PieceCreation] Achievement check failed post-generation:", e);
    }
}


export async function createPieceAndStartGeneration(userId: string, pieceFormData: PieceFormValues): Promise<string> {
    const adminDb = getAdminDb();
    let pieceId = '';
    
    const creditCost = 1;
    const primaryLanguage = pieceFormData.primaryLanguage;

    await adminDb.runTransaction(async (transaction) => {
        const userDocRef = adminDb.collection('users').doc(userId);
        const userDoc = await transaction.get(userDocRef);
        if (!userDoc.exists) throw new ApiServiceError("User not found.", "AUTH");
        if ((userDoc.data()?.credits || 0) < creditCost) {
            throw new ApiServiceError("Insufficient credits.", "VALIDATION");
        }
        
        transaction.update(userDocRef, {
            credits: FieldValue.increment(-creditCost),
            'stats.piecesCreated': FieldValue.increment(1)
        });

        const newWorkRef = adminDb.collection(getLibraryCollectionPath(userId)).doc();
        const initialWorkData: Omit<Piece, 'id'> = {
            userId,
            type: 'piece',
            title: { [primaryLanguage]: pieceFormData.aiPrompt.substring(0, 50) },
            status: 'processing',
            contentState: 'processing',
            contentRetryCount: 0,
            origin: pieceFormData.origin,
            langs: pieceFormData.availableLanguages,
            prompt: pieceFormData.aiPrompt,
            tags: pieceFormData.tags || [],
            display: pieceFormData.display || 'card',
            aspectRatio: pieceFormData.aspectRatio,
            generatedContent: [],
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            isBilingual: pieceFormData.availableLanguages.length > 1,
        };
        transaction.set(newWorkRef, removeUndefinedProps(initialWorkData));
        pieceId = newWorkRef.id;
    });

    if (!pieceId) {
        throw new ApiServiceError("Transaction failed: Could not create piece document.", "UNKNOWN");
    }
    
    processPieceGenerationPipeline(userId, pieceId, pieceFormData).catch(err => {
        console.error(`[Orphaned Pipeline] Unhandled error for piece ${pieceId}:`, err);
    });

    return pieceId;
}

/**
 * Generates content for a "piece" using a unified Markdown approach.
 */
async function generateSinglePieceContent(pieceFormData: PieceFormValues): Promise<Partial<Piece>> {
    const userPrompt = (pieceFormData.aiPrompt || '').slice(0, MAX_PROMPT_LENGTH);
    if (!userPrompt) {
      throw new Error("A user prompt is required.");
    }
    
    const [primaryLanguage, secondaryLanguage, format] = pieceFormData.origin.split('-');
    const isPhraseMode = format === 'ph';
    const primaryLangLabel = LANGUAGES.find(l => l.value === primaryLanguage)?.label || primaryLanguage;
    
    let languageInstruction: string;
    if (secondaryLanguage) {
        const secondaryLangLabel = LANGUAGES.find(l => l.value === secondaryLanguage)?.label || secondaryLanguage;
        const pairingUnit = isPhraseMode ? 'meaningful chunks' : 'sentences';
        languageInstruction = `Write in bilingual ${primaryLangLabel} and ${secondaryLangLabel}, with ${pairingUnit} paired using ' / ' as a separator.`;
    } else {
        languageInstruction = `Write in ${primaryLangLabel}.`;
    }

    const fullInstruction = `Based on the following instructions, write a piece of content less than 500 words.
Instructions: "${userPrompt}"

CRITICAL RULES:
- Language and Format: ${languageInstruction}
- The title MUST be a Level 1 Markdown heading (e.g., '# Title' or '# Title / Tiêu đề').
- The main content should follow directly after the title.
`.trim();

    const pieceContentGenerationPrompt = ai.definePrompt({
        name: 'generateUnifiedPieceMarkdown_v1',
        input: { schema: PiecePromptInputSchema },
        output: { schema: PieceOutputSchema },
        prompt: `{{{fullInstruction}}}`,
        config: { maxOutputTokens: 1200 }
    });

    try {
        const { output: aiOutput } = await pieceContentGenerationPrompt({ fullInstruction });

        if (!aiOutput || !aiOutput.markdownContent) {
            throw new ApiServiceError('AI returned empty or invalid content for the piece.', "UNKNOWN");
        }

        const lines = aiOutput.markdownContent.trim().split('\n');
        let titleText = `Untitled Piece`;
        let contentMarkdown = aiOutput.markdownContent;

        if (lines[0].startsWith('# ')) {
            titleText = lines[0].substring(2).trim();
            contentMarkdown = lines.slice(1).join('\n');
        }

        const titleParts = titleText.split(/\s+\/\s+/).map(p => p.trim());
        const finalTitle: { [key: string]: string } = { [primaryLanguage]: titleParts[0] };
        if (secondaryLanguage && titleParts[1]) {
            finalTitle[secondaryLanguage] = titleParts[1];
        }

        const segments = parseMarkdownToSegments(contentMarkdown, pieceFormData.origin);
        
        return {
          title: finalTitle,
          generatedContent: segments,
        };

    } catch (error) {
        console.error(`Piece content generation failed:`, (error as Error).message);
        throw new ApiServiceError('AI content generation failed.', "UNKNOWN");
    }
}

/**
 * Regenerates the content for a "piece".
 */
export async function regeneratePieceContent(userId: string, workId: string, newPrompt?: string): Promise<void> {
    const adminDb = getAdminDb();
    const workDocRef = adminDb.collection(getLibraryCollectionPath(userId)).doc(workId);

    const workData = await adminDb.runTransaction(async (transaction) => {
        const workSnap = await transaction.get(workDocRef);
        if (!workSnap.exists) throw new ApiServiceError("Work not found for content regeneration.", "UNKNOWN");
        
        const currentData = workSnap.data() as Piece;
        const updatePayload: any = {
            contentState: 'processing',
            status: 'processing',
            contentRetryCount: newPrompt ? 0 : (currentData.contentRetryCount || 0) + 1,
            updatedAt: FieldValue.serverTimestamp(),
        };
        if (newPrompt) updatePayload.prompt = newPrompt;
        
        transaction.update(workDocRef, updatePayload);
        return currentData;
    });

    const promptToUse = newPrompt ?? workData.prompt;
    if (!promptToUse) {
        await updateLibraryItem(userId, workId, { status: 'draft', contentState: 'error', contentError: "No prompt available." });
        return;
    }
    
    const pieceFormData: PieceFormValues = {
        aiPrompt: promptToUse,
        origin: workData.origin,
        primaryLanguage: workData.langs[0],
        availableLanguages: workData.langs,
        tags: workData.tags || [],
        title: workData.title,
        display: workData.display,
        aspectRatio: workData.aspectRatio,
    };
    
    processPieceGenerationPipeline(userId, workId, pieceFormData)
    .catch(async (err) => {
        console.error(`Background regeneration failed for work ${workId}:`, err);
        await updateLibraryItem(userId, workId, {
            status: 'draft',
            contentState: 'error',
            contentError: (err as Error).message || 'Content regeneration failed.',
        });
    });
}
