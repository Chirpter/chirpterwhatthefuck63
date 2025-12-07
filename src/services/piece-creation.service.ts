

'use server';

import { getAdminDb, FieldValue } from '@/lib/firebase-admin';
import type { Piece, PieceFormValues, GeneratePieceInput } from "@/lib/types";
import { removeUndefinedProps } from "@/lib/utils";
import { checkAndUnlockAchievements } from './achievement-service';
import { generatePieceContent } from "@/ai/flows/generate-piece-content";
import { updateLibraryItem } from "./library-service";
import { ApiServiceError } from "../lib/errors";

const getLibraryCollectionPath = (userId: string) => `users/${userId}/libraryItems`;
const MAX_RETRY_COUNT = 3;

/**
 * The main pipeline for processing "piece" generation.
 * @param userId - The ID of the user.
 * @param pieceId - The ID of the piece being processed.
 * @param contentInput - The input for the AI content generation flow.
 */
async function processPieceGenerationPipeline(userId: string, pieceId: string, contentInput: GeneratePieceInput): Promise<void> {
    let finalUpdate: Partial<Piece>;

    try {
        const contentResult = await generatePieceContent(contentInput);
        if (!contentResult || !contentResult.generatedContent) {
            throw new ApiServiceError("AI returned empty or invalid content for the piece.", "UNKNOWN");
        }

        finalUpdate = {
            title: contentResult.title,
            content: contentResult.generatedContent,
            contentStatus: 'ready',
            status: 'draft',
            contentRetryCount: 0,
        };
    } catch (err) {
        const errorMessage = (err as Error).message;
        console.error(`Piece content generation failed for item ${pieceId}:`, errorMessage);
        finalUpdate = {
            contentStatus: 'error',
            status: 'draft',
            contentError: errorMessage,
        };
    }
    
    await updateLibraryItem(userId, pieceId, finalUpdate);
    await checkAndUnlockAchievements(userId);
}

/**
 * Creates a "piece" document and initiates the generation pipeline.
 * @param userId - The ID of the user.
 * @param pieceFormData - The data from the creation form.
 * @param contentInput - The input for the AI content generation flow.
 * @returns The ID of the newly created piece.
 */
export async function createPieceAndStartGeneration(userId: string, pieceFormData: PieceFormValues, contentInput: GeneratePieceInput): Promise<string> {
    const adminDb = getAdminDb();
    let pieceId = '';
    
    const creditCost = 1;
    const primaryLang = pieceFormData.primaryLanguage;

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

        const availableLanguages = [primaryLang];
        if (pieceFormData.isBilingual && pieceFormData.secondaryLanguage) {
            availableLanguages.push(pieceFormData.secondaryLanguage);
        }

        const newWorkRef = adminDb.collection(getLibraryCollectionPath(userId)).doc();
        const initialWorkData: Omit<Piece, 'id'> = {
            userId,
            type: 'piece',
            title: { [primaryLang]: pieceFormData.aiPrompt.substring(0, 50) },
            status: 'processing',
            contentStatus: 'processing',
            contentRetryCount: 0,
            primaryLanguage: primaryLang,
            availableLanguages: [...new Set(availableLanguages)],
            prompt: pieceFormData.aiPrompt,
            tags: pieceFormData.tags || [],
            presentationStyle: pieceFormData.presentationStyle || 'card',
            aspectRatio: pieceFormData.aspectRatio,
            bilingualFormat: pieceFormData.bilingualFormat,
            content: [],
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        };
        transaction.set(newWorkRef, removeUndefinedProps(initialWorkData));
        pieceId = newWorkRef.id;
    });

    if (!pieceId) {
        throw new ApiServiceError("Transaction failed: Could not create piece document.", "UNKNOWN");
    }
    
    processPieceGenerationPipeline(userId, pieceId, contentInput).catch(err => {
        console.error(`[Orphaned Pipeline] Unhandled error for piece ${pieceId}:`, err);
    });

    return pieceId;
}

/**
 * Retries the content generation for a "piece".
 * @param userId - The ID of the user.
 * @param workId - The ID of the piece to regenerate.
 * @param newPrompt - An optional new prompt to use for regeneration.
 */
export async function regeneratePieceContent(userId: string, workId: string, newPrompt?: string): Promise<void> {
    const adminDb = getAdminDb();
    const workDocRef = adminDb.collection(getLibraryCollectionPath(userId)).doc(workId);

    const workData = await adminDb.runTransaction(async (transaction) => {
        const workSnap = await transaction.get(workDocRef);
        if (!workSnap.exists()) throw new ApiServiceError("Work not found for content regeneration.", "UNKNOWN");
        
        const workData = workSnap.data() as Piece;
        if (!newPrompt && (workData.contentRetryCount || 0) >= MAX_RETRY_COUNT) {
            throw new ApiServiceError("Maximum content retry limit reached.", "VALIDATION");
        }

        const updatePayload: any = {
            contentStatus: 'processing',
            status: 'processing',
            contentRetryCount: newPrompt ? 0 : FieldValue.increment(1),
            updatedAt: FieldValue.serverTimestamp(),
        };
        if (newPrompt) updatePayload.prompt = newPrompt;
        
        transaction.update(workDocRef, updatePayload);
        return workData;
    });

    const promptToUse = newPrompt ?? workData.prompt;
    if (!promptToUse) {
        await updateLibraryItem(userId, workId, { status: 'draft', contentStatus: 'error', contentError: "No prompt available." });
        return;
    }

    const contentInput: GeneratePieceInput = {
        userPrompt: promptToUse,
        primaryLanguage: workData.primaryLanguage,
        isBilingual: workData.availableLanguages.length > 1,
        secondaryLanguage: workData.availableLanguages.find(l => l !== workData.primaryLanguage),
        bilingualFormat: workData.bilingualFormat,
    };
    
    processPieceGenerationPipeline(userId, workId, contentInput)
    .catch(async (err) => {
        console.error(`Background regeneration failed for work ${workId}:`, err);
        await updateLibraryItem(userId, workId, {
            status: 'draft',
            contentStatus: 'error',
            contentError: (err as Error).message || 'Content regeneration failed.',
        });
    });
}
