
'use server';

import {
  collection,
  addDoc,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  updateDoc,
  increment,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
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
    const libraryCollectionRef = collection(db, getLibraryCollectionPath(userId));
    let pieceId = '';
    
    const creditCost = 1;
    const primaryLang = pieceFormData.primaryLanguage;

    const initialWorkData: Omit<Piece, 'id' | 'createdAt' | 'updatedAt'> = {
        userId,
        type: 'piece',
        title: {
            [primaryLang]: pieceFormData.aiPrompt.substring(0, 50) + (pieceFormData.aiPrompt.length > 50 ? '...' : ''),
        },
        status: 'processing',
        contentStatus: 'processing',
        content: [],
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

    await runTransaction(db, async (transaction) => {
        await deductCredits(transaction, userId, creditCost);
        transaction.update(doc(db, 'users', userId), {
            'stats.piecesCreated': increment(1)
        });
        const newWorkRef = doc(libraryCollectionRef);
        transaction.set(newWorkRef, {
            ...removeUndefinedProps(initialWorkData),
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
    const workDocRef = doc(db, getLibraryCollectionPath(userId), workId);

    const workSnap = await getDoc(workDocRef);
    if (!workSnap.exists()) throw new ApiServiceError("Work not found for content regeneration.", "UNKNOWN");
    const workData = workSnap.data() as Piece;

    if ((workData.contentRetryCount || 0) >= MAX_RETRY_COUNT) {
        throw new ApiServiceError("Maximum content retry limit reached.", "UNKNOWN");
    }

    const promptToUse = newPrompt ?? workData.prompt;
    if (!promptToUse) {
        throw new ApiServiceError("No prompt available to regenerate content.", "UNKNOWN");
    }

    const updatePayload: any = {
        contentStatus: 'processing',
        status: 'processing',
        contentRetryCount: increment(1),
    };
    
    if (newPrompt) {
        updatePayload.prompt = newPrompt;
    }

    await updateDoc(workDocRef, updatePayload);

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
