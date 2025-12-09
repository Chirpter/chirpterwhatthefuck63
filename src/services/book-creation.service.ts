

'use server';

import { getAdminDb, FieldValue } from '@/lib/firebase-admin';
import { ref as storageRef, uploadString, getDownloadURL } from "firebase/storage";
import { storage } from '@/lib/firebase';
import type { Book, CreationFormValues, Cover, CoverJobType, GenerateBookContentInput, Chapter, ChapterTitle, PresentationMode, MultilingualContent } from "@/lib/types";
import { removeUndefinedProps } from '@/lib/utils';
import { getUserProfile } from './user-service';
import { checkAndUnlockAchievements } from './achievement-service';
import { generateCoverImage } from "@/ai/flows/generate-cover-image-flow";
import { updateLibraryItem } from "./library-service";
import { ApiServiceError } from "../lib/errors";
import { parseMarkdownToSegments, segmentsToChapterStructure } from './MarkdownParser';
import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { LANGUAGES, MAX_PROMPT_LENGTH, BOOK_LENGTH_OPTIONS, MAX_IMAGE_SIZE_BYTES } from '@/lib/constants';
import sharp from 'sharp';

/**
 * REFACTORED: The new, simpler output schema for the AI.
 * AI now returns simple strings for titles, and the server handles language keys.
 * This is more robust and less prone to AI formatting errors.
 */
const BookOutputSchema = z.object({
    bookTitle: z.string().describe('A concise, creative title for the entire book (1-7 words). This should be a simple string.'),
    chapters: z.array(z.object({
        title: z.string().describe("The title for this specific chapter. This should be a simple string, e.g., 'The Awakening'."),
        content: z.string().describe("The full Markdown content for this chapter. For chapters that are only part of an outline, this MUST be an EMPTY STRING."),
    })).describe("An array of ALL chapter objects for the entire book outline.")
});


/**
 * REFACTORED: A much simpler input schema for the AI prompt.
 */
const BookPromptInputSchema = z.object({
  contextInstruction: z.string(),
  structureInstruction: z.string(),
  languageInstruction: z.string(),
});


/**
 * The main pipeline for processing book generation. It runs content and cover generation in parallel.
 * This is a "fire-and-forget" background process.
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
  // Use Promise.allSettled to run content and cover generation in parallel.
  // This ensures that even if one pipeline fails, the other can still complete.
  const [contentResult, coverResult] = await Promise.allSettled([
    // Pipeline 1: Content Generation (Always runs)
    processContentGenerationForBook(userId, bookId, contentInput),
    
    // Pipeline 2: Cover Generation (Runs conditionally based on user choice)
    coverOption !== 'none'
      ? processCoverImageForBook(userId, bookId, coverOption, coverData, contentInput.prompt)
      // If 'none', the pipeline resolves instantly with an 'ignored' status.
      : Promise.resolve({ coverState: 'ignored' as const })
  ]);

  // Aggregate results from both pipelines
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

  // Update the Firestore document with the final results.
  // The client, which is listening to this document, will automatically receive this update.
  await updateLibraryItem(userId, bookId, finalUpdate);
  await checkAndUnlockAchievements(userId);
}

/**
 * Creates a book document and initiates the generation pipeline. This is the entry point.
 * This function performs critical server-side validation.
 * @param userId - The ID of the user.
 * @param bookFormData - The data from the creation form.
 * @returns The ID of the newly created book.
 */
export async function createBookAndStartGeneration(userId: string, bookFormData: CreationFormValues): Promise<string> {
  const adminDb = getAdminDb();
  let bookId = '';

  // SERVER-SIDE VALIDATION 1: User Profile check.
  const userProfile = await getUserProfile(userId);
  if (!userProfile) throw new ApiServiceError("User profile not found.", "AUTH");
  
  // SERVER-SIDE VALIDATION 2: Recalculate credit cost on the server to prevent manipulation.
  let creditCost = 0;
  const bookLengthOption = BOOK_LENGTH_OPTIONS.find(opt => opt.value === bookFormData.bookLength);
  if (bookLengthOption) {
    if (bookFormData.bookLength === 'standard-book') {
        creditCost = bookFormData.generationScope === 'full' ? 8 : 2;
    } else {
        creditCost = { 'short-story': 1, 'mini-book': 2, 'long-book': 15 }[bookFormData.bookLength] || 1;
    }
  }
  if (bookFormData.coverImageOption === 'ai' || bookFormData.coverImageOption === 'upload') {
      creditCost += 1;
  }
  
  const primaryLanguage = bookFormData.primaryLanguage;

  // STEP 1: ATOMIC TRANSACTION for safety (deduct credits, create document).
  await adminDb.runTransaction(async (transaction) => {
    const userDocRef = adminDb.collection('users').doc(userId);
    const userDoc = await transaction.get(userDocRef);
    if (!userDoc.exists) throw new ApiServiceError("User not found.", "AUTH");
    
    // SERVER-SIDE VALIDATION 3: Final credit check within transaction.
    if ((userDoc.data()?.credits || 0) < creditCost) {
      throw new ApiServiceError("Insufficient credits.", "VALIDATION");
    }
    
    // Action 1: Deduct credits and update stats.
    transaction.update(userDocRef, {
        credits: FieldValue.increment(-creditCost),
        'stats.booksCreated': FieldValue.increment(1)
    });

    // Action 2: Create the initial "draft" book document.
    const newBookRef = adminDb.collection(getLibraryCollectionPath(userId)).doc();
    const initialBookData: Omit<Book, 'id'> = {
        userId,
        type: 'book',
        title: { [primaryLanguage]: bookFormData.aiPrompt.substring(0, 50) },
        status: 'processing',
        contentState: 'processing',
        coverState: bookFormData.coverImageOption !== 'none' ? 'processing' : 'ignored',
        origin: bookFormData.origin,
        langs: bookFormData.availableLanguages,
        prompt: bookFormData.aiPrompt,
        tags: bookFormData.tags || [],
        intendedLength: bookFormData.bookLength,
        isComplete: false,
        display: 'book',
        contentRetryCount: 0,
        coverRetryCount: 0,
        chapters: [],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    };
    transaction.set(newBookRef, removeUndefinedProps(initialBookData));
    bookId = newBookRef.id;
  });

  if (!bookId) {
    throw new ApiServiceError("Transaction failed: Could not create book document.", "UNKNOWN");
  }

  // STEP 2: PREPARE INPUT for the background generation pipeline.
  const contentInput: GenerateBookContentInput = {
    prompt: bookFormData.aiPrompt,
    origin: bookFormData.origin,
    bookLength: bookFormData.bookLength,
    generationScope: bookFormData.generationScope,
    chaptersToGenerate: bookFormData.targetChapterCount,
    totalChapterOutlineCount: (bookFormData.bookLength === 'standard-book' || bookFormData.bookLength === 'long-book') ? bookFormData.targetChapterCount : undefined,
  };
  const coverData = bookFormData.coverImageOption === 'ai' ? bookFormData.coverImageAiPrompt : bookFormData.coverImageFile;

  // STEP 3: TRIGGER BACKGROUND PIPELINE (Fire-and-forget).
  processBookGenerationPipeline(userId, bookId, contentInput, bookFormData.coverImageOption, coverData)
    .catch(err => console.error(`[Orphaned Pipeline] Unhandled error for book ${bookId}:`, err));

  // STEP 4: RETURN ID TO CLIENT IMMEDIATELY.
  return bookId;
}


/**
 * Handles the AI content generation part of the pipeline.
 * @returns A partial Book object with the generated content and updated status.
 */
async function processContentGenerationForBook(userId: string, bookId: string, contentInput: GenerateBookContentInput): Promise<Partial<Book>> {
    // SERVER-SIDE SANITIZATION of prompt length.
    const userPrompt = contentInput.prompt.slice(0, MAX_PROMPT_LENGTH);
    const { bookLength, generationScope, origin } = contentInput;
    
    // --- PROMPT ASSEMBLY ---
    const [primaryLanguage, secondaryLanguage] = origin.split('-');
    const languageInstruction = secondaryLanguage
        ? `in bilingual ${LANGUAGES.find(l=>l.value===primaryLanguage)?.label} and ${LANGUAGES.find(l=>l.value===secondaryLanguage)?.label}, with sentences paired using ' / ' as a separator`
        : `in ${LANGUAGES.find(l=>l.value===primaryLanguage)?.label}`;

    let structureInstruction: string;
    if (generationScope === 'firstFew' && contentInput.totalChapterOutlineCount && contentInput.totalChapterOutlineCount > 0) {
        structureInstruction = `Generate an array for a book of ${contentInput.totalChapterOutlineCount} chapters. Write full Markdown content for only the FIRST ${contentInput.chaptersToGenerate} chapters. For the remaining chapters, provide a title but leave the 'content' field as an EMPTY string.`;
    } else {
        structureInstruction = `Generate an array of ${contentInput.chaptersToGenerate} chapters. Write the full Markdown content for ALL chapters.`;
    }
    
    // Define the Genkit prompt with the new simple structure
    const bookContentGenerationPrompt = ai.definePrompt({
        name: 'generateBookContentPrompt_v7_simple_output',
        input: { schema: BookPromptInputSchema },
        output: { schema: BookOutputSchema },
        prompt: `You are a creative writer. Write a book based on the prompt: {{{contextInstruction}}}

CRITICAL INSTRUCTIONS:
1.  **Title:** Create a concise, creative title for the entire book.
2.  **Structure:** ${'{{{structureInstruction}}}'}
3.  **Language:** Write all content and titles ${'{{{languageInstruction}}}'}.`,
    });

    const promptInput = { 
        contextInstruction: userPrompt,
        structureInstruction,
        languageInstruction,
    };

    try {
        // STEP 1: Wait for the AI to generate the structured JSON output.
        const { output: aiOutput } = await bookContentGenerationPrompt(promptInput);

        if (!aiOutput || !aiOutput.chapters || aiOutput.chapters.length === 0) {
          throw new ApiServiceError('AI returned empty or invalid chapter data.', "UNKNOWN");
        }
        
        // STEP 2: Process the AI output. Now much simpler.
        const finalChapters: Chapter[] = aiOutput.chapters.map((chapterData, index) => {
            const segments = parseMarkdownToSegments(chapterData.content || '', origin);
            
            const totalWords = segments.reduce((sum, segment) => {
                const text = segment.content[primaryLanguage] || '';
                return sum + text.split(/\s+/).filter(Boolean).length;
            }, 0);
            
            // Server wraps the simple string title into the required MultilingualContent object.
            const chapterTitle: MultilingualContent = {
                [primaryLanguage]: chapterData.title,
            };
            // If bilingual, we could call a translation flow here if needed, but for now, we just use the primary.
            
            return {
                id: generateLocalUniqueId(),
                order: index,
                title: chapterTitle,
                segments: segments,
                stats: { totalSegments: segments.length, totalWords, estimatedReadingTime: Math.ceil(totalWords / 200) },
                metadata: {},
            };
        });

        const finalBookTitle: MultilingualContent = { [primaryLanguage]: aiOutput.bookTitle };
        
        return {
          title: finalBookTitle,
          chapters: finalChapters,
          contentState: 'ready',
          contentRetryCount: 0,
        };

    } catch (error) {
        console.error(`Content generation failed for book ${bookId}:`, (error as Error).message);
        throw new ApiServiceError('AI content generation failed. This might be due to safety filters or a temporary issue. Please try a different prompt.', "UNKNOWN");
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
  const coverInputPrompt = (coverOption === 'ai' && typeof imageData === 'string' && imageData.trim()) ? imageData : fallbackPrompt;

  try {
    let optimizedBuffer: Buffer | null = null;
    
    // Case 1: User uploaded a file
    if (coverOption === 'upload' && imageData instanceof File) {
        if (imageData.size > MAX_IMAGE_SIZE_BYTES) {
            throw new ApiServiceError(`File size exceeds limit of ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024}MB.`, 'VALIDATION');
        }
        if (!imageData.type.startsWith('image/')) {
            throw new ApiServiceError('Invalid file type. Only images are allowed.', 'VALIDATION');
        }

      const arrayBuffer = await imageData.arrayBuffer();
      optimizedBuffer = await sharp(Buffer.from(arrayBuffer))
        .resize(512, 683, { fit: 'cover', position: 'center' })
        .webp({ quality: 80 }).toBuffer();
    } 
    // Case 2: User wants AI to generate an image
    else if (coverOption === 'ai' && coverInputPrompt) {
      const { imageUrl } = await generateCoverImage({ prompt: coverInputPrompt, bookId });
      if (imageUrl.startsWith('data:image/')) {
        const base64Data = imageUrl.split(',')[1];
        optimizedBuffer = Buffer.from(base64Data, 'base64');
      }
    }

    if (optimizedBuffer) {
      const storagePath = `covers/${userId}/${bookId}/cover.webp`;
      const imageRef = storageRef(storage, storagePath);
      
      const dataUrl = `data:image/webp;base64,${optimizedBuffer.toString('base64')}`;
      
      await uploadString(imageRef, dataUrl, 'data_url');
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

const getLibraryCollectionPath = (userId: string) => `users/${userId}/libraryItems`;

export async function addChaptersToBook(userId: string, bookId: string, contentInput: GenerateBookContentInput): Promise<void> {
  const adminDb = getAdminDb();
  const bookDocRef = adminDb.collection(getLibraryCollectionPath(userId)).doc(bookId);

  await bookDocRef.update({
    status: 'processing',
    contentState: 'processing',
    updatedAt: FieldValue.serverTimestamp(),
  });

  try {
    const { chapters, title } = await processContentGenerationForBook(userId, bookId, contentInput);

    await bookDocRef.update({
      title: title || FieldValue.delete(),
      chapters: FieldValue.arrayUnion(...(chapters || [])),
      status: 'draft',
      contentState: 'ready',
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    await bookDocRef.update({
      status: 'draft',
      contentState: 'error',
      contentError: (error as Error).message,
      updatedAt: FieldValue.serverTimestamp(),
    });
    throw error;
  }
}

export async function editBookCover(userId: string, bookId: string, newCoverOption: 'ai' | 'upload', data: File | string): Promise<void> {
    await updateLibraryItem(userId, bookId, { 
        coverState: 'processing', 
        status: 'processing', 
        coverRetryCount: 0 
    });

    try {
        const coverUpdate = await processCoverImageForBook(userId, bookId, newCoverOption, data, undefined);
        await updateLibraryItem(userId, bookId, { ...coverUpdate, status: 'draft' });
    } catch (error) {
        await updateLibraryItem(userId, bookId, {
            status: 'draft',
            coverState: 'error',
            coverError: (error as Error).message,
        });
        throw error;
    }
}

export async function regenerateBookContent(userId: string, bookId: string, newPrompt?: string): Promise<void> {
    const adminDb = getAdminDb();
    const docSnap = await adminDb.collection(getLibraryCollectionPath(userId)).doc(bookId).get();
    if (!docSnap.exists) throw new ApiServiceError("Book not found.", "UNKNOWN");
    const book = docSnap.data() as Book;

    const contentInput: GenerateBookContentInput = {
        prompt: newPrompt || book.prompt || '',
        origin: book.origin,
        bookLength: book.intendedLength || 'short-story',
        chaptersToGenerate: book.chapters.length || 1
    };

    await updateLibraryItem(userId, bookId, {
        status: 'processing',
        contentState: 'processing',
        chapters: [],
        outline: [],
        contentRetryCount: newPrompt ? 0 : (book.contentRetryCount || 0) + 1,
        prompt: newPrompt || book.prompt,
    });

    try {
        const contentUpdate = await processContentGenerationForBook(userId, bookId, contentInput);
        await updateLibraryItem(userId, bookId, { ...contentUpdate, status: 'draft' });
    } catch (error) {
        await updateLibraryItem(userId, bookId, {
            status: 'draft',
            contentState: 'error',
            contentError: (error as Error).message,
        });
        throw error;
    }
}

export async function regenerateBookCover(userId: string, bookId: string): Promise<void> {
    const adminDb = getAdminDb();
    const docSnap = await adminDb.collection(getLibraryCollectionPath(userId)).doc(bookId).get();
    if (!docSnap.exists) throw new ApiServiceError("Book not found.", "UNKNOWN");
    const book = docSnap.data() as Book;

    if (!book.cover || book.cover.type === 'none') {
        throw new ApiServiceError("No cover information to regenerate from.", "VALIDATION");
    }

    await updateLibraryItem(userId, bookId, {
        status: 'processing',
        coverState: 'processing',
        coverRetryCount: (book.coverRetryCount || 0) + 1,
    });

    try {
        const coverUpdate = await processCoverImageForBook(
            userId, 
            bookId, 
            book.cover.type, 
            book.cover.inputPrompt || book.prompt || '',
            book.prompt
        );
        await updateLibraryItem(userId, bookId, { ...coverUpdate, status: 'draft' });
    } catch (error) {
        await updateLibraryItem(userId, bookId, {
            status: 'draft',
            coverState: 'error',
            coverError: (error as Error).message,
        });
        throw error;
    }
}


    

    


