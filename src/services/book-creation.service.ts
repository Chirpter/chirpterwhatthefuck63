

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
 * REFACTORED (v15): Final architecture based on user feedback.
 * The AI now only returns a single Markdown string. All structuring is handled server-side.
 */
const BookOutputSchema = z.object({
  markdownContent: z.string().describe("A single, unified Markdown string that contains the entire book. The string MUST start with the book title as a Level 3 heading (e.g., '### The Lost Dragon'), followed by the content of each chapter, with each chapter starting with a Level 2 heading (e.g., '## Chapter 1: The Storm')."),
});

/**
 * REFACTORED (v15): The input schema is now extremely simple, containing only the assembled text instructions.
 */
const BookPromptInputSchema = z.object({
    fullInstruction: z.string(),
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
    const statUpdates: any = {
      credits: FieldValue.increment(-creditCost),
      'stats.booksCreated': FieldValue.increment(1)
    };
    if (bookFormData.isBilingual) {
      statUpdates['stats.bilingualBooksCreated'] = FieldValue.increment(1);
    }
    transaction.update(userDocRef, statUpdates);

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
  // This step happens asynchronously. The function returns the bookId to the client
  // immediately, while this pipeline continues to run in the background.
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
    const userPrompt = contentInput.prompt.slice(0, MAX_PROMPT_LENGTH);
    const { bookLength, generationScope, origin } = contentInput;
    
    // --- PROMPT ASSEMBLY (Server-side logic) ---
    const bookLengthOption = BOOK_LENGTH_OPTIONS.find(opt => opt.value === bookLength);
    const wordsPerChapter = Math.round(((bookLengthOption?.defaultChapters || 3) * 200) / (contentInput.chaptersToGenerate || 3));

    const [primaryLanguage, secondaryLanguage] = origin.split('-');
    const languageInstruction = secondaryLanguage
        ? `Write the content for ALL chapters in bilingual English and Vietnamese, with sentences paired using ' / ' as a separator.`
        : `Write all content and titles in English.`;

    let bookType: string;
    let structureInstruction: string;
    if (generationScope === 'firstFew' && contentInput.totalChapterOutlineCount) {
        bookType = 'partial-book with an outline';
        structureInstruction = `Write the full content for ONLY the FIRST ${contentInput.chaptersToGenerate} chapters. For the remaining chapters up to a total of ${contentInput.totalChapterOutlineCount}, only write their Markdown heading (e.g., '## Chapter 3: The Discovery') and no other content.`;
    } else {
        bookType = 'full-book';
        structureInstruction = `Write a complete book with exactly ${contentInput.chaptersToGenerate} chapters.`;
    }
    
    // Assemble the final prompt string based on the user's template
    const fullInstruction = `
Write a ${bookType} based on the prompt: "${userPrompt}"

CRITICAL INSTRUCTIONS:
- ${structureInstruction}
- Each chapter should be about ${wordsPerChapter} words.
- The book title MUST be a Level 3 Markdown heading (e.g., '### My Book Title').
- Each chapter MUST begin with a Level 2 Markdown heading (e.g., '## Chapter 1: The Beginning').
- ${languageInstruction}
`.trim();

    const bookContentGenerationPrompt = ai.definePrompt({
        name: 'generateBookMarkdownPrompt_v2',
        input: { schema: BookPromptInputSchema },
        output: { schema: BookOutputSchema },
        prompt: `{{{fullInstruction}}}`,
    });

    try {
        const { output: aiOutput } = await bookContentGenerationPrompt({ fullInstruction });

        if (!aiOutput || !aiOutput.markdownContent) {
          throw new ApiServiceError('AI returned empty or invalid content.', "UNKNOWN");
        }
        
        // --- SERVER-SIDE PARSING of the single Markdown string ---
        const markdown = aiOutput.markdownContent;
        
        // 1. Extract book title from ###
        const titleMatch = markdown.match(/^###\s*(.*)/m);
        const bookTitleText = titleMatch ? titleMatch[1].trim() : 'Untitled Book';
        const finalBookTitle: MultilingualContent = { [primaryLanguage]: bookTitleText };
        
        // 2. Remove the title line to process chapters
        const contentWithoutTitle = titleMatch ? markdown.replace(titleMatch[0], '').trim() : markdown;
        
        // 3. Process the rest of the markdown into chapters
        const segments = parseMarkdownToSegments(contentWithoutTitle, origin);
        const finalChapters = segmentsToChapterStructure(segments, origin);
        
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

    