
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
import { ref as storageRef, uploadString, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase"; // Using client-side `db` for some ops
import { getAdminDb } from '@/lib/firebase-admin'; // Using admin `db` for transactions
import type { Book, CreationFormValues, Cover, CoverJobType, GenerateBookContentInput, ChapterTitle } from "@/lib/types";
import { removeUndefinedProps } from "@/lib/utils";
import { deductCredits, getUserProfile } from './user-service';
import { checkAndUnlockAchievements } from './achievement-service';
import { generateBookContent } from "@/ai/flows/generate-book-content";
import { generateCoverImage } from "@/ai/flows/generate-cover-image-flow";
import { updateLibraryItem } from "./library-service";
import sharp from 'sharp';
import { ApiServiceError } from "../lib/errors";

const getLibraryCollectionPath = (userId: string) => `users/${userId}/libraryItems`;
const MAX_RETRY_COUNT = 3;

async function processBookGenerationPipeline(
  userId: string,
  bookId: string,
  initialData: Partial<Book>,
  contentInput: GenerateBookContentInput,
  coverOption: CoverJobType,
  coverData: File | string | null
) {
  const [contentResult, coverResult] = await Promise.allSettled([
    processContentGenerationForBook(userId, bookId, contentInput),
    coverOption !== 'none'
      ? processCoverImageForBook(userId, bookId, coverOption, coverData)
      : Promise.resolve({ coverStatus: 'ignored' as const })
  ]);

  const finalUpdate: Partial<Book> = { status: 'draft' };

  if (contentResult.status === 'fulfilled') {
    Object.assign(finalUpdate, contentResult.value);
  } else {
    finalUpdate.contentStatus = 'error';
    finalUpdate.contentError = (contentResult.reason as Error).message || 'Content generation failed.';
  }

  if (coverResult.status === 'fulfilled') {
    Object.assign(finalUpdate, coverResult.value);
  } else {
    finalUpdate.coverStatus = 'error';
    finalUpdate.coverError = (coverResult.reason as Error).message || 'Cover generation failed.';
  }

  await updateLibraryItem(userId, bookId, finalUpdate);
  
  // After everything, check for achievement unlocks
  await checkAndUnlockAchievements(userId);
}

export async function createBookAndStartGeneration(userId: string, bookFormData: CreationFormValues): Promise<string> {
  const adminDb = getAdminDb(); // Use Admin DB for transaction
  const libraryCollectionRef = collection(adminDb, getLibraryCollectionPath(userId));
  let bookId = '';

  const userProfile = await getUserProfile(userId);
  if (!userProfile) {
    throw new ApiServiceError("User profile not found.", "AUTH");
  }
  const isProUser = userProfile.plan === 'pro';

  if (bookFormData.coverImageOption === 'upload' && !isProUser) {
    throw new ApiServiceError("You must be a Pro user to upload custom covers.", "AUTH");
  }

  let creditCost = 0;
  switch (bookFormData.bookLength) {
    case 'short-story': creditCost += 1; break;
    case 'mini-book': creditCost += 2; break;
    case 'standard-book': creditCost += (bookFormData.generationScope === 'full' ? 8 : 2); break;
    case 'long-book': creditCost += 15; break;
  }
  if (bookFormData.coverImageOption === 'ai') {
    creditCost += 1;
  }

  const coverImageAiPrompt = bookFormData.coverImageAiPrompt?.trim() || bookFormData.aiPrompt.trim();
  const primaryLang = bookFormData.primaryLanguage;

  const initialBookData: Omit<Book, 'id' | 'createdAt' | 'updatedAt' | 'chapters'> = {
    userId,
    type: 'book',
    title: {
      [primaryLang]: bookFormData.aiPrompt.substring(0, 50) + (bookFormData.aiPrompt.length > 50 ? '...' : ''),
    },
    status: 'processing',
    contentStatus: 'processing',
    coverStatus: bookFormData.coverImageOption === 'none' ? 'ignored' : 'processing',
    isBilingual: bookFormData.isBilingual,
    primaryLanguage: primaryLang,
    secondaryLanguage: bookFormData.isBilingual ? bookFormData.secondaryLanguage : undefined,
    bilingualFormat: bookFormData.isBilingual ? bookFormData.bilingualFormat : undefined,
    chapterOutline: [],
    prompt: bookFormData.aiPrompt,
    tags: bookFormData.tags || [],
    intendedLength: bookFormData.bookLength,
    isComplete: false,
    presentationStyle: 'book',
    contentRetryCount: 0,
    coverRetryCount: 0,
    cover: {
      type: bookFormData.coverImageOption,
      inputPrompt: bookFormData.coverImageOption === 'ai' ? coverImageAiPrompt : undefined,
    }
  };

  await runTransaction(adminDb, async (transaction) => {
    await deductCredits(transaction, userId, creditCost);
    
    const userDocRef = adminDb.collection('users').doc(userId); // Use adminDb ref
    transaction.update(userDocRef, {
        'stats.booksCreated': increment(1),
        'stats.bilingualBooksCreated': bookFormData.isBilingual ? increment(1) : increment(0)
    });

    const newBookRef = doc(libraryCollectionRef); // Create new doc ref within admin context
    transaction.set(newBookRef, {
      ...removeUndefinedProps(initialBookData),
      chapters: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    bookId = newBookRef.id;
  });

  if (!bookId) {
    throw new ApiServiceError("Transaction failed: Could not create book document.", "UNKNOWN");
  }

  const contentInput: GenerateBookContentInput = {
    prompt: bookFormData.aiPrompt,
    primaryLanguage: bookFormData.primaryLanguage,
    isBilingual: bookFormData.isBilingual,
    secondaryLanguage: bookFormData.secondaryLanguage,
    bilingualFormat: bookFormData.bilingualFormat,
    chaptersToGenerate: bookFormData.targetChapterCount,
    totalChapterOutlineCount: bookFormData.targetChapterCount,
    bookLength: bookFormData.bookLength,
    generationScope: bookFormData.generationScope,
  };

  const coverInput = bookFormData.coverImageOption === 'upload' ? bookFormData.coverImageFile : coverImageAiPrompt;

  processBookGenerationPipeline(
    userId,
    bookId,
    initialBookData,
    contentInput,
    bookFormData.coverImageOption,
    coverInput,
  ).catch(err => {
    console.error(`Unhandled error in generation pipeline for book ${bookId}:`, err);
  });

  return bookId;
}

async function processContentGenerationForBook(userId: string, bookId: string, contentInput: GenerateBookContentInput): Promise<Partial<Book>> {
  try {
    const contentResult = await generateBookContent(contentInput);
    if (!contentResult || !contentResult.chapters || contentResult.chapters.length === 0) {
      throw new ApiServiceError("AI returned empty or invalid content. This might be due to safety filters or an issue with the prompt.", "UNKNOWN");
    }
    
    return {
      title: contentResult.bookTitle,
      chapters: contentResult.chapters,
      chapterOutline: contentResult.chapterOutline,
      contentStatus: 'ready',
      contentRetryCount: 0, // Reset retry count on success
    };
  } catch (err) {
    console.error(`Content generation failed for book ${bookId}:`, (err as Error).message);
    throw err;
  }
}

async function processCoverImageForBook(
  userId: string,
  bookId: string,
  coverOption: CoverJobType,
  imageData: File | string | null
): Promise<Partial<Book>> {
  const coverInputPrompt = (coverOption === 'ai' && typeof imageData === 'string') ? imageData : undefined;

  try {
    let optimizedBuffer: Buffer | null = null;
    if (coverOption === 'upload' && imageData instanceof File) {
        const arrayBuffer = await imageData.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        optimizedBuffer = await sharp(buffer)
            .resize(512, 683, { fit: 'cover', position: 'center' })
            .webp({ quality: 80 })
            .toBuffer();
    } else if (coverOption === 'ai' && typeof imageData === 'string' && imageData.trim()) {
      const { imageUrl } = await generateCoverImage({ prompt: imageData, bookId });
      // The generateCoverImage flow already returns an optimized WebP data URI
      if (imageUrl.startsWith('data:image/webp;base64,')) {
        optimizedBuffer = Buffer.from(imageUrl.split(',')[1], 'base64');
      }
    }

    if (optimizedBuffer) {
      const storagePath = `covers/${userId}/${bookId}/cover.webp`;
      const imageRef = storageRef(storage, storagePath);
      await uploadString(imageRef, `data:image/webp;base64,${optimizedBuffer.toString('base64')}`, 'data_url');
      const downloadURL = await getDownloadURL(imageRef);

      const coverUpdate: Cover = {
        type: coverOption,
        url: downloadURL,
        filename: storagePath,
        storageProvider: 'firebase',
        createdAt: new Date().toISOString(),
        inputPrompt: coverInputPrompt,
      };

      return {
        cover: removeUndefinedProps(coverUpdate),
        coverStatus: 'ready',
        imageHint: coverInputPrompt,
        coverRetryCount: 0, // Reset retry count on success
      };
    }

    return { coverStatus: 'ignored' };

  } catch (err) {
    console.error(`Error in cover generation for book ${bookId}:`, (err as Error).message);
    throw err;
  }
}

export async function addChaptersToBook(userId: string, bookId: string, contentInput: GenerateBookContentInput): Promise<void> {
  const bookDocRef = doc(db, getLibraryCollectionPath(userId), bookId);
  try {
    await updateDoc(bookDocRef, {
      status: 'processing',
      updatedAt: serverTimestamp(),
    });

    const contentResult = await generateBookContent(contentInput);

    const bookDoc = await getDoc(bookDocRef);
    if (!bookDoc.exists()) throw new ApiServiceError(`Book with ID ${bookId} does not exist!`, "UNKNOWN");

    const existingBookData = bookDoc.data() as Book;
    const existingChapters = existingBookData.chapters || [];
    const updatedChapters = [...existingChapters, ...contentResult.chapters];

    let updatedOutline = existingBookData.chapterOutline || [];
    const newGeneratedChapterTitles = new Set(contentResult.chapters.map(c => c.title[c.metadata.primaryLanguage] || ''));

    updatedOutline = updatedOutline.map(item => {
      const primaryTitle = item.title[item.metadata.primaryLanguage] || '';
      if (newGeneratedChapterTitles.has(primaryTitle.replace(/Chapter \\d+: /, '').trim())) {
        return { ...item, isGenerated: true };
      }
      return item;
    });

    const updateData: Partial<Book> = {
      chapters: updatedChapters,
      chapterOutline: updatedOutline,
      status: 'draft',
      updatedAt: serverTimestamp(),
    };

    await updateDoc(bookDocRef, removeUndefinedProps(updateData));

  } catch (err) {
    console.error(`Adding chapters failed for book ${bookId}:`, (err as Error).message);
    await updateDoc(bookDocRef, { status: 'draft', updatedAt: serverTimestamp() });
    throw err;
  }
}

export async function editBookCover(userId: string, bookId: string, newCoverOption: 'ai' | 'upload', data: File | string | null): Promise<void> {
    const adminDb = getAdminDb(); // Use admin for transaction
    const itemDocRef = adminDb.collection(getLibraryCollectionPath(userId)).doc(bookId);
    
    await adminDb.runTransaction(async (transaction) => {
        const userDocRef = adminDb.collection('users').doc(userId);
        const userDoc = await transaction.get(userDocRef);
        if (!userDoc.exists()) throw new ApiServiceError("User not found.", "AUTH");

        const currentCredits = userDoc.data()?.credits || 0;
        if (currentCredits < 1) {
            throw new ApiServiceError("Insufficient credits to generate a new cover.", "VALIDATION");
        }
        
        transaction.update(userDocRef, { 
            credits: increment(-1),
            'stats.coversGeneratedByAI': increment(1)
        });
        
        transaction.update(itemDocRef, {
            coverStatus: 'processing',
            coverRetryCount: 0, // Reset retry count for a new paid generation
            updatedAt: serverTimestamp(),
        });
    });

    processCoverImageForBook(userId, bookId, newCoverOption, data)
        .then(async (coverUpdateResult) => {
            const finalUpdate: Partial<Book> = { ...coverUpdateResult, status: 'draft' };
            await updateLibraryItem(userId, bookId, finalUpdate);
            await checkAndUnlockAchievements(userId);
        })
        .catch(err => {
            console.error(`Background cover edit failed for book ${bookId}:`, err);
             updateLibraryItem(userId, bookId, {
                status: 'draft',
                coverStatus: 'error',
                coverError: (err as Error).message || 'Cover regeneration failed.',
            });
        });
}

export async function regenerateBookContent(userId: string, bookId: string, newPrompt?: string): Promise<void> {
  const bookDocRef = doc(db, getLibraryCollectionPath(userId), bookId);

  const bookSnap = await getDoc(bookDocRef);
  if (!bookSnap.exists()) {
    throw new ApiServiceError("Book not found for content regeneration.", "UNKNOWN");
  }
  const bookData = bookSnap.data() as Book;

  if (!newPrompt && (bookData.contentRetryCount || 0) >= MAX_RETRY_COUNT) {
    throw new ApiServiceError("Maximum content retry limit reached.", "UNKNOWN");
  }

  const promptToUse = newPrompt ?? bookData.prompt;
  if (!promptToUse) {
    throw new ApiServiceError("No prompt available to regenerate content.", "UNKNOWN");
  }

  // If a new prompt is provided, reset the retry count. Otherwise, increment it.
  const updatePayload: any = {
    contentStatus: 'processing',
    status: 'processing',
    contentRetryCount: newPrompt ? 0 : increment(1),
  };

  if (newPrompt) {
    updatePayload.prompt = newPrompt;
  }

  await updateDoc(bookDocRef, updatePayload);

  const chaptersToGenerate = bookData.chapterOutline 
    ? Math.ceil((bookData.chapterOutline.length) / 4)
    : 1;

  const contentInput: GenerateBookContentInput = {
    prompt: promptToUse,
    primaryLanguage: bookData.primaryLanguage,
    isBilingual: bookData.isBilingual,
    secondaryLanguage: bookData.secondaryLanguage,
    bilingualFormat: bookData.bilingualFormat || 'sentence',
    chaptersToGenerate: chaptersToGenerate,
    totalChapterOutlineCount: bookData.chapterOutline?.length || chaptersToGenerate,
    bookLength: bookData.intendedLength,
    generationScope: 'firstFew',
  };

  processContentGenerationForBook(userId, bookId, contentInput)
    .then((contentUpdateResult) => {
      const finalUpdate: Partial<Book> = { ...contentUpdateResult, status: 'draft' };
      updateLibraryItem(userId, bookId, finalUpdate);
    })
    .catch(async (err) => {
      console.error(`Unhandled error in background content regeneration for book ${bookId}:`, err);
      await updateLibraryItem(userId, bookId, {
        status: 'draft',
        contentStatus: 'error',
        contentError: (err as Error).message || 'Content regeneration failed again.',
      });
    });
}

export async function regenerateBookCover(userId: string, bookId: string): Promise<void> {
  const bookDocRef = doc(db, getLibraryCollectionPath(userId), bookId);

  const bookSnap = await getDoc(bookDocRef);
  if (!bookSnap.exists()) {
    throw new ApiServiceError("Book not found for cover regeneration.", "UNKNOWN");
  }
  const bookData = bookSnap.data() as Book;

  if (bookData.cover?.type === 'upload') {
    throw new ApiServiceError("Cannot regenerate an uploaded cover with AI.", "VALIDATION");
  }
  
  if ((bookData.coverRetryCount || 0) >= MAX_RETRY_COUNT) {
    throw new ApiServiceError("Maximum cover retry limit reached.", "UNKNOWN");
  }

  const promptToUse = bookData.cover?.inputPrompt || bookData.prompt;
  if (!promptToUse) {
    throw new ApiServiceError("No prompt available to regenerate cover.", "UNKNOWN");
  }
  
  await updateDoc(bookDocRef, {
    coverStatus: 'processing',
    status: 'processing',
    coverRetryCount: increment(1),
  });

  processCoverImageForBook(userId, bookId, 'ai', promptToUse)
    .then((coverUpdateResult) => {
      const finalUpdate: Partial<Book> = { ...coverUpdateResult, status: 'draft' };
      updateLibraryItem(userId, bookId, finalUpdate);
    })
    .catch(async (err) => {
      console.error(`Unhandled error in background cover regeneration for book ${bookId}:`, err);
      await updateLibraryItem(userId, bookId, {
        status: 'draft',
        coverStatus: 'error',
        coverError: (err as Error).message || 'Cover regeneration failed again.',
      });
    });
}


// THIS FUNCTION IS NOW OBSOLETE AND MOVED TO piece-creation.service.ts
// It is kept here temporarily to avoid breaking existing imports.
// It should be removed in a future cleanup.
export async function regeneratePieceContent(userId: string, workId: string, newPrompt?: string): Promise<void> {
    console.warn("regeneratePieceContent is deprecated in book-creation.service.ts. Please use the function from piece-creation.service.ts");
    // In a real scenario, you'd import and call the new service function here.
    // For now, we'll leave it as a no-op to avoid circular dependencies if we were to import it.
    return Promise.resolve();
}
