

'use server';

import {
  collection,
  addDoc,
  doc,
  runTransaction,
  serverTimestamp,
  increment,
} from "firebase/firestore";
import { getAdminDb } from '@/lib/firebase-admin';
import type { Piece, PieceFormValues, GeneratePieceInput } from "@/lib/types";
import { removeUndefinedProps } from "@/lib/utils";
import { deductCredits } from './user-service';
import { checkAndUnlockAchievements } from './achievement-service';
import { generatePieceContent } from "@/ai/flows/generate-piece-content";
import { updateLibraryItem } from "./library-service";
import { ApiServiceError } from "../lib/errors";

const getLibraryCollectionPath = (userId: string) => `users/${userId}/libraryItems`;
const MAX_RETRY_COUNT = 3;

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
            contentRetryCount: 0, // Reset retry count on success
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

export async function createPieceAndStartGeneration(userId: string, pieceFormData: PieceFormValues, contentInput: GeneratePieceInput): Promise<string> {
    const adminDb = getAdminDb();
    const libraryCollectionRef = collection(adminDb, getLibraryCollectionPath(userId));
    let pieceId = '';
    
    const creditCost = 1;
    const primaryLang = pieceFormData.primaryLanguage;

    const initialWorkData: Omit<Piece, 'id' | 'createdAt' | 'updatedAt' | 'content'> = {
        userId,
        type: 'piece',
        title: {
            [primaryLang]: pieceFormData.aiPrompt.substring(0, 50) + (pieceFormData.aiPrompt.length > 50 ? '...' : ''),
        },
        status: 'processing',
        contentStatus: 'processing',
        contentRetryCount: 0,
        isBilingual: pieceFormData.isBilingual,
        primaryLanguage: primaryLang,
        secondaryLanguage: pieceFormData.isBilingual ? pieceFormData.secondaryLanguage : undefined,
        prompt: pieceFormData.aiPrompt,
        tags: pieceFormData.tags || [],
        presentationStyle: pieceFormData.presentationStyle || 'card',
        aspectRatio: pieceFormData.aspectRatio,
        bilingualFormat: pieceFormData.bilingualFormat,
    };

    await runTransaction(adminDb, async (transaction) => {
        await deductCredits(transaction, userId, creditCost);

        const userDocRef = doc(adminDb, 'users', userId);
        transaction.update(userDocRef, {
            'stats.piecesCreated': increment(1)
        });

        const newWorkRef = doc(libraryCollectionRef); // Create new doc ref within admin context
        transaction.set(newWorkRef, {
            ...removeUndefinedProps(initialWorkData),
            content: [],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        pieceId = newWorkRef.id;
    });

    if (!pieceId) {
        throw new ApiServiceError("Transaction failed: Could not create piece document.", "UNKNOWN");
    }
    
    processPieceGenerationPipeline(userId, pieceId, contentInput).catch(err => {
        console.error(`Unhandled error in generation pipeline for piece ${pieceId}:`, err);
    });

    return pieceId;
}

export async function regeneratePieceContent(userId: string, workId: string, newPrompt?: string): Promise<void> {
    const adminDb = getAdminDb();
    const workDocRef = doc(adminDb, getLibraryCollectionPath(userId), workId);

    const workData = await runTransaction(adminDb, async (transaction) => {
        const workSnap = await transaction.get(workDocRef);
        if (!workSnap.exists()) {
            throw new ApiServiceError("Work not found for content regeneration.", "UNKNOWN");
        }
        const workData = workSnap.data() as Piece;

        if (!newPrompt && (workData.contentRetryCount || 0) >= MAX_RETRY_COUNT) {
            throw new ApiServiceError("Maximum content retry limit reached.", "VALIDATION");
        }

        const updatePayload: any = {
            contentStatus: 'processing',
            status: 'processing',
            contentRetryCount: newPrompt ? 0 : increment(1),
            updatedAt: serverTimestamp(),
        };
        if (newPrompt) {
            updatePayload.prompt = newPrompt;
        }
        transaction.update(workDocRef, updatePayload);
        return workData;
    });

    const promptToUse = newPrompt ?? workData.prompt;
    if (!promptToUse) {
        await updateLibraryItem(userId, workId, { status: 'draft', contentStatus: 'error', contentError: "No prompt available to regenerate content." });
        return;
    }

    const contentInput: GeneratePieceInput = {
        userPrompt: promptToUse,
        primaryLanguage: workData.primaryLanguage,
        isBilingual: workData.isBilingual,
        secondaryLanguage: workData.secondaryLanguage,
        bilingualFormat: workData.bilingualFormat,
    };
    
    processPieceGenerationPipeline(userId, workId, contentInput)
    .catch(async (err) => {
        console.error(`Unhandled error in background content regeneration for work ${workId}:`, err);
        await updateLibraryItem(userId, workId, {
            status: 'draft',
            contentStatus: 'error',
            contentError: (err as Error).message || 'Content regeneration failed again.',
        });
    });
}
