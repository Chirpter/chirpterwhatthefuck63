

'use server';

import { getAdminDb, FieldValue } from '@/lib/firebase-admin';
import { ref as storageRef, uploadString, getDownloadURL } from "firebase/storage";
import { storage } from '@/lib/firebase';
import type { Book, CreationFormValues, Cover, CoverJobType, GenerateBookContentInput, Chapter, PresentationMode } from "@/lib/types";
import { removeUndefinedProps } from "@/lib/utils";
import { getUserProfile } from './user-service';
import { checkAndUnlockAchievements } from './achievement-service';
import { generateBookContent } from "@/ai/flows/generate-book-content";
import { generateCoverImage } from "@/ai/flows/generate-cover-image-flow";
import { updateLibraryItem } from "./library-service";
import sharp from 'sharp';
import { ApiServiceError } from "../lib/errors";
import { parseMarkdownToSegments, segmentsToChapterStructure } from './MarkdownParser';

const getLibraryCollectionPath = (userId: string) => `users/${userId}/libraryItems`;
const MAX_RETRY_COUNT = 3;

/**
 * The main pipeline for processing book generation. It runs content and cover generation in parallel.
 * @param userId - The ID of the user.
 * @param bookId - The ID of the book being processed.
 * @param contentInput - The input for the AI content generation flow.
 * @param coverOption - The type of cover to generate.
 * @param coverData - The data for cover generation (prompt or file).
 */
async function processBookGenerationPipeline(
  userId: string,
  bookId: string,
  contentInput: GenerateBookContentInput,
  coverOption: CoverJobType,
  coverData: File | string | null
) {
  const [contentResult, coverResult] = await Promise.allSettled([
    processContentGenerationForBook(userId, bookId, contentInput),
    coverOption !== 'none'
      ? processCoverImageForBook(userId, bookId, coverOption, coverData, contentInput.prompt)
      : Promise.resolve({ coverState: 'ignored' as const })
  ]);

  const finalUpdate: Partial<Book> = { status: 'draft' };

  if (contentResult.status === 'fulfilled') {
    Object.assign(finalUpdate, contentResult.value);
  } else {
    finalUpdate.contentState = 'error';
    finalUpdate.contentError = (contentResult.reason as Error).message || 'Content generation failed.';
  }

  if (coverResult.status === 'fulfilled') {
    Object.assign(finalUpdate, coverResult.value);
  } else {
    finalUpdate.coverState = 'error';
    finalUpdate.coverError = (coverResult.reason as Error).message || 'Cover generation failed.';
  }

  await updateLibraryItem(userId, bookId, finalUpdate);
  await checkAndUnlockAchievements(userId);
}

/**
 * Creates a book document and initiates the generation pipeline.
 * This is the entry point for creating a new book.
 * @param userId - The ID of the user.
 * @param bookFormData - The data from the creation form.
 * @returns The ID of the newly created book.
 */
export async function createBookAndStartGeneration(userId: string, bookFormData: CreationFormValues): Promise<string> {
  const adminDb = getAdminDb();
  let bookId = '';

  const userProfile = await getUserProfile(userId);
  if (!userProfile) throw new ApiServiceError("User profile not found.", "AUTH");

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

  // --- Construct the origin string ---
  const primaryLanguage = bookFormData.primaryLanguage;
  
  await adminDb.runTransaction(async (transaction) => {
    const userDocRef = adminDb.collection('users').doc(userId);
    const userDoc = await transaction.get(userDocRef);
    if (!userDoc.exists) throw new ApiServiceError("User not found.", "AUTH");
    if ((userDoc.data()?.credits || 0) < creditCost) {
      throw new ApiServiceError("Insufficient credits.", "VALIDATION");
    }

    transaction.update(userDocRef, {
        credits: FieldValue.increment(-creditCost),
        'stats.booksCreated': FieldValue.increment(1),
        'stats.bilingualBooksCreated': bookFormData.availableLanguages.length > 1 ? FieldValue.increment(1) : FieldValue.increment(0)
    });
    
    const newBookRef = adminDb.collection(getLibraryCollectionPath(userId)).doc();
    const initialBookData: Omit<Book, 'id'> = {
        userId,
        type: 'book',
        title: { [primaryLanguage]: bookFormData.aiPrompt.substring(0, 50) },
        status: 'processing',
        contentState: 'processing',
        coverState: bookFormData.coverImageOption === 'none' ? 'ignored' : 'processing',
        origin: bookFormData.origin,
        langs: bookFormData.availableLanguages.filter(Boolean),
        prompt: bookFormData.aiPrompt,
        tags: bookFormData.tags || [],
        intendedLength: bookFormData.bookLength,
        isComplete: false,
        display: 'book',
        contentRetryCount: 0,
        coverRetryCount: 0,
        chapters: [],
        cover: {
          type: bookFormData.coverImageOption,
          inputPrompt: coverImageAiPrompt,
        },
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    };
    transaction.set(newBookRef, removeUndefinedProps(initialBookData));
    bookId = newBookRef.id;
  });

  if (!bookId) {
    throw new ApiServiceError("Transaction failed: Could not create book document.", "UNKNOWN");
  }

  const contentInput: GenerateBookContentInput = {
    prompt: bookFormData.aiPrompt,
    origin: bookFormData.origin,
    chaptersToGenerate: bookFormData.targetChapterCount,
    totalChapterOutlineCount: bookFormData.targetChapterCount,
    bookLength: bookFormData.bookLength,
    generationScope: bookFormData.generationScope,
  };

  const coverInput = bookFormData.coverImageOption === 'upload' ? bookFormData.coverImageFile : coverImageAiPrompt;
  
  processBookGenerationPipeline(userId, bookId, contentInput, bookFormData.coverImageOption, coverInput)
    .catch(err => console.error(`[Orphaned Pipeline] Unhandled error for book ${bookId}:`, err));

  return bookId;
}

/**
 * Handles the AI content generation part of the pipeline.
 * @returns A partial Book object with the generated content and updated status.
 */
async function processContentGenerationForBook(userId: string, bookId: string, contentInput: GenerateBookContentInput): Promise<Partial<Book>> {
  try {
    const [primaryLanguage] = contentInput.origin.split('-');
    const contentResult = await generateBookContent({ ...contentInput });
    
    if (!contentResult || !contentResult.chapters || contentResult.chapters.length === 0) {
      throw new ApiServiceError("AI returned empty or invalid content. This might be due to safety filters or an issue with the prompt.", "UNKNOWN");
    }
    return {
      title: contentResult.bookTitle,
      chapters: contentResult.chapters,
      outline: contentResult.chapterOutline,
      contentState: 'ready',
      contentRetryCount: 0,
    };
  } catch (err) {
    console.error(`Content generation failed for book ${bookId}:`, (err as Error).message);
    throw err;
  }
}

/**
 * Handles the cover image generation/upload part of the pipeline.
 * @returns A partial Book object with the cover information and updated status.
 */
async function processCoverImageForBook(
  userId: string,
  bookId: string,
  coverOption: CoverJobType,
  imageData: File | string | null,
  fallbackPrompt?: string
): Promise<Partial<Book>> {
  const coverInputPrompt = (coverOption === 'ai' && typeof imageData === 'string') ? imageData : fallbackPrompt;

  try {
    let optimizedBuffer: Buffer | null = null;
    if (coverOption === 'upload' && imageData instanceof File) {
      const arrayBuffer = await imageData.arrayBuffer();
      optimizedBuffer = await sharp(Buffer.from(arrayBuffer))
        .resize(512, 683, { fit: 'cover', position: 'center' })
        .webp({ quality: 80 }).toBuffer();
    } else if (coverOption === 'ai' && coverInputPrompt?.trim()) {
      const { imageUrl } = await generateCoverImage({ prompt: coverInputPrompt, bookId });
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
        createdAt: new Date().toISOString(),
        inputPrompt: coverInputPrompt,
      };

      return {
        cover: removeUndefinedProps(coverUpdate),
        coverState: 'ready',
        coverRetryCount: 0,
      };
    }

    return { coverState: 'ignored' };
  } catch (err) {
    console.error(`Error in cover generation for book ${bookId}:`, (err as Error).message);
    throw err;
  }
}

/**
 * Permanently upgrades a book's content structure from 'sentence' to 'phrase' format.
 * This is a one-way operation that processes the existing content into a more granular structure.
 * @param userId - The ID of the user.
 * @param bookId - The ID of the book to upgrade.
 */
export async function upgradeBookToPhraseMode(userId: string, bookId: string): Promise<void> {
    const adminDb = getAdminDb();
    const bookDocRef = adminDb.collection(getLibraryCollectionPath(userId)).doc(bookId);

    try {
        const bookDoc = await bookDocRef.get();
        if (!bookDoc.exists) {
            throw new ApiServiceError("Book not found.", "UNKNOWN");
        }

        const book = bookDoc.data() as Book;
        const [primaryLanguage, secondaryLanguage, format] = book.origin.split('-');

        // Prevent re-processing if it's already in phrase format or not eligible (not bilingual)
        if (format === 'ph' || !secondaryLanguage) {
            console.log(`[Upgrade] Book ${bookId} is already in phrase format or is not eligible. Skipping.`);
            return;
        }

        const upgradedChapters: Chapter[] = book.chapters.map(chapter => {
            const upgradedSegments = chapter.segments.map(segment => {
                if (segment.phrases) {
                    return segment;
                }
                if (!segment.content) {
                    return segment;
                }

                const primarySentence = segment.content[primaryLanguage] || '';
                const secondarySentence = segment.content[secondaryLanguage] || '';
                
                const primaryPhrases = primarySentence.match(/[^,;]+[,;]?/g) || [primarySentence];
                const secondaryPhrases = secondarySentence.match(/[^,;]+[,;]?/g) || [secondarySentence];

                const phrases = primaryPhrases.map((phrase, i) => ({
                    [primaryLanguage]: phrase.trim(),
                    [secondaryLanguage as string]: (secondaryPhrases[i] || '').trim(),
                }));
                
                const newSegment = { ...segment };
                newSegment.phrases = phrases;
                return newSegment;
            });
            
            return { ...chapter, segments: upgradedSegments };
        });

        // Update the book in Firestore with the new structure
        await bookDocRef.update({
            chapters: upgradedChapters,
            origin: `${book.origin}-ph`, // Append '-ph' to mark as upgraded
            updatedAt: FieldValue.serverTimestamp(),
        });

        console.log(`[Upgrade] Successfully upgraded book ${bookId} to phrase mode.`);

    } catch (error) {
        console.error(`Error upgrading book ${bookId} to phrase mode:`, error);
        throw new ApiServiceError("Failed to upgrade book format.", "FIRESTORE", error as Error);
    }
}


// ... other functions (addChaptersToBook, editBookCover) would be similarly refactored ...

export async function addChaptersToBook(userId: string, bookId: string, contentInput: GenerateBookContentInput): Promise<void> {
  // This logic remains largely the same but would call the standardized processContentGenerationForBook if needed.
  // For simplicity, we'll keep the existing logic but ensure it uses Admin SDK correctly.
  const adminDb = getAdminDb();
  const bookDocRef = adminDb.collection(getLibraryCollectionPath(userId)).doc(bookId);

  try {
      const bookDoc = await bookDocRef.get();
      if (!bookDoc.exists) {
          throw new ApiServiceError("Book not found.", "UNKNOWN");
      }

      const book = bookDoc.data() as Book;
      const [primaryLanguage] = book.origin.split('-');

      const contentResult = await generateBookContent({ ...contentInput });
      
      if (!contentResult || !contentResult.chapters || contentResult.chapters.length === 0) {
        throw new ApiServiceError("AI returned empty or invalid content. This might be due to safety filters or an issue with the prompt.", "UNKNOWN");
      }

      // Ensure new chapters have unique IDs and correct order
      const existingChaptersCount = book.chapters.length;
      const newChapters = contentResult.chapters.map((chapter, index) => ({
          ...chapter,
          id: chapter.id || chapter.segments[0]?.id || chapter.segments[0]?.content?.[primaryLanguage] || `new-chapter-${existingChaptersCount + index}`, // Ensure unique ID
          order: existingChaptersCount + index, // Set correct order
      }));

      // Update the book in Firestore with the new chapters
      await bookDocRef.update({
          chapters: FieldValue.arrayUnion(...newChapters),
          outline: contentResult.chapterOutline,
          updatedAt: FieldValue.serverTimestamp(),
      });

      console.log(`Successfully added ${newChapters.length} chapters to book ${bookId}.`);

  } catch (error) {
      console.error(`Error adding chapters to book ${bookId}:`, error);
      throw new ApiServiceError("Failed to add chapters to book.", "FIRESTORE", error as Error);
  }
}

export async function editBookCover(userId: string, bookId: string, newCoverOption: 'ai' | 'upload', data: File | string | null): Promise<void> {
  try {
      const adminDb = getAdminDb();
      const bookDocRef = adminDb.collection(getLibraryCollectionPath(userId)).doc(bookId);

      const bookDoc = await bookDocRef.get();
      if (!bookDoc.exists) {
          throw new ApiServiceError("Book not found.", "UNKNOWN");
      }

      const book = bookDoc.data() as Book;

      const [contentResult, coverResult] = await Promise.allSettled([
          processContentGenerationForBook(userId, bookId, {
              prompt: book.prompt,
              origin: book.origin,
              chaptersToGenerate: book.chapters.length,
              totalChapterOutlineCount: book.chapters.length,
              bookLength: book.intendedLength,
              generationScope: 'full',
          }),
          processCoverImageForBook(userId, bookId, newCoverOption, data, book.prompt)
      ]);

      const finalUpdate: Partial<Book> = { status: 'draft' };

      if (contentResult.status === 'fulfilled') {
          Object.assign(finalUpdate, contentResult.value);
      } else {
          finalUpdate.contentState = 'error';
          finalUpdate.contentError = (contentResult.reason as Error).message || 'Content generation failed.';
      }

      if (coverResult.status === 'fulfilled') {
          Object.assign(finalUpdate, coverResult.value);
      } else {
          finalUpdate.coverState = 'error';
          finalUpdate.coverError = (coverResult.reason as Error).message || 'Cover generation failed.';
      }

      await bookDocRef.update(finalUpdate);
      await checkAndUnlockAchievements(userId);
  } catch (error) {
      console.error(`Error Regenerating Book :`, error);
      throw new ApiServiceError("Failed to Regenerate Book", "FIRESTORE", error as Error);
  }
}

export async function regenerateBookContent(userId: string, bookId: string, newPrompt?: string): Promise<void> {
    try {
        const adminDb = getAdminDb();
        const bookDocRef = adminDb.collection(getLibraryCollectionPath(userId)).doc(bookId);

        const bookDoc = await bookDocRef.get();
        if (!bookDoc.exists) {
            throw new ApiServiceError("Book not found.", "UNKNOWN");
        }

        const book = bookDoc.data() as Book;
        const updatedPrompt = newPrompt || book.prompt;

        const updatePayload: any = {
            contentState: 'processing',
            status: 'processing',
            updatedAt: FieldValue.serverTimestamp(),
        };
        if (newPrompt) updatePayload.prompt = newPrompt;

        await bookDocRef.update(updatePayload);
        
        //Construct the content input
        const contentInput: GenerateBookContentInput = {
            prompt: updatedPrompt,
            origin: book.origin,
            chaptersToGenerate: book.chapters.length,
            totalChapterOutlineCount: book.chapters.length,
            bookLength: book.intendedLength,
            generationScope: 'full',
        };

        const [contentResult, coverResult] = await Promise.allSettled([
            processContentGenerationForBook(userId, bookId, contentInput),
            processCoverImageForBook(userId, bookId, book.cover.type, book.cover.inputPrompt, book.prompt)
        ]);

        const finalUpdate: Partial<Book> = { status: 'draft' };

        if (contentResult.status === 'fulfilled') {
            Object.assign(finalUpdate, contentResult.value);
        } else {
            finalUpdate.contentState = 'error';
            finalUpdate.contentError = (contentResult.reason as Error).message || 'Content generation failed.';
        }

        if (coverResult.status === 'fulfilled') {
            Object.assign(finalUpdate, coverResult.value);
        } else {
            finalUpdate.coverState = 'error';
            finalUpdate.coverError = (coverResult.reason as Error).message || 'Cover generation failed.';
        }
        
        await bookDocRef.update(finalUpdate);
        await checkAndUnlockAchievements(userId);
    } catch (error) {
        console.error(`Error Regenerating Book :`, error);
        throw new ApiServiceError("Failed to Regenerate Book", "FIRESTORE", error as Error);
    }
}

export async function regenerateBookCover(userId: string, bookId: string): Promise<void> {
    try {
        const adminDb = getAdminDb();
        const bookDocRef = adminDb.collection(getLibraryCollectionPath(userId)).doc(bookId);

        const bookDoc = await bookDocRef.get();
        if (!bookDoc.exists) {
            throw new ApiServiceError("Book not found.", "UNKNOWN");
        }

        const book = bookDoc.data() as Book;

        const [contentResult, coverResult] = await Promise.allSettled([
            processContentGenerationForBook(userId, bookId, {
                prompt: book.prompt,
                origin: book.origin,
                chaptersToGenerate: book.chapters.length,
                totalChapterOutlineCount: book.chapters.length,
                bookLength: book.intendedLength,
                generationScope: 'full',
            }),
            processCoverImageForBook(userId, bookId, book.cover.type, book.cover.inputPrompt, book.prompt)
        ]);

        const finalUpdate: Partial<Book> = { status: 'draft' };

        if (contentResult.status === 'fulfilled') {
            Object.assign(finalUpdate, contentResult.value);
        } else {
            finalUpdate.contentState = 'error';
            finalUpdate.contentError = (contentResult.reason as Error).message || 'Content generation failed.';
        }

        if (coverResult.status === 'fulfilled') {
            Object.assign(finalUpdate, coverResult.value);
        } else {
            finalUpdate.coverState = 'error';
            finalUpdate.coverError = (coverResult.reason as Error).message || 'Cover generation failed.';
        }
        await bookDocRef.update(finalUpdate);
        await checkAndUnlockAchievements(userId);
    } catch (error) {
        console.error(`Error Regenerating Book :`, error);
        throw new ApiServiceError("Failed to Regenerate Book", "FIRESTORE", error as Error);
    }
}
