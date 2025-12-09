

'use server';

import { getAdminDb, FieldValue } from '@/lib/firebase-admin';
import { ref as storageRef, uploadString, getDownloadURL } from "firebase/storage";
import { storage } from '@/lib/firebase';
import type { Book, CreationFormValues, Cover, CoverJobType, GenerateBookContentInput, Chapter, ChapterTitle, PresentationMode } from "@/lib/types";
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

// ARCHITECTURAL NOTE: This is the new, superior schema for AI output.
// It requests a structured array of chapter objects directly.
// This is clearer for the AI, eliminates parsing steps on our server,
// and elegantly handles the "first-few-chapters" use case by allowing the 'content'
// field to be an empty string for outlined-only chapters.
const createOutputSchema = (
    titleInstruction: string
) => z.object({
    bookTitle: z.any().describe(titleInstruction),
    chapters: z.array(z.object({
        title: z.any().describe('The title for this specific chapter. Must be a JSON object with language codes as keys, e.g. {"en": "The Awakening"}.'),
        content: z.string().describe("The full Markdown content for this chapter. For chapters that are only part of an outline, this should be an EMPTY string."),
    })).describe("An array of all chapter objects, including those with and without content.")
});


// Internal schema for crafting the precise prompt to the AI.
const PromptInputSchema = z.object({
  prompt: z.string(),
  origin: z.string(),
  compactInstruction: z.string(),
  contextInstruction: z.string(),
  titleInstruction: z.string(),
  chaptersToGenerate: z.number(),
  totalChapterOutlineCount: z.number().optional(),
  previousContentSummary: z.string().optional(),
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

  // SERVER-SIDE VALIDATION 1: User Profile and Credits
  // This is a critical security step. Client-side checks are for UX only.
  const userProfile = await getUserProfile(userId);
  if (!userProfile) throw new ApiServiceError("User profile not found.", "AUTH");
  
  // SERVER-SIDE VALIDATION 2: Credit Calculation
  // Recalculate cost on the server to prevent client-side manipulation.
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

  // STEP 1: ATOMIC TRANSACTION
  // A transaction ensures that credit deduction and book creation happen together or not at all.
  await adminDb.runTransaction(async (transaction) => {
    const userDocRef = adminDb.collection('users').doc(userId);
    const userDoc = await transaction.get(userDocRef);
    if (!userDoc.exists) throw new ApiServiceError("User not found.", "AUTH");
    
    // SERVER-SIDE VALIDATION 3: Final Credit Check within Transaction
    if ((userDoc.data()?.credits || 0) < creditCost) {
      throw new ApiServiceError("Insufficient credits.", "VALIDATION");
    }
    
    // Action 1: Deduct credits and update user stats
    transaction.update(userDocRef, {
        credits: FieldValue.increment(-creditCost),
        'stats.booksCreated': FieldValue.increment(1)
    });

    // Action 2: Create the initial "draft" document for the book.
    // The client will start listening to this document for real-time updates.
    const newBookRef = adminDb.collection(getLibraryCollectionPath(userId)).doc();
    const initialBookData: Omit<Book, 'id'> = {
        userId,
        type: 'book',
        title: { [primaryLanguage]: bookFormData.aiPrompt.substring(0, 50) },
        status: 'processing', // Initial status while pipelines run
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

  // STEP 3: TRIGGER BACKGROUND PIPELINE (Fire-and-forget)
  // This function call does not wait for the pipeline to finish.
  // It runs in the background, and the client gets updates via Firestore listener.
  processBookGenerationPipeline(userId, bookId, contentInput, bookFormData.coverImageOption, coverData)
    .catch(err => console.error(`[Orphaned Pipeline] Unhandled error for book ${bookId}:`, err));

  // STEP 4: RETURN ID TO CLIENT IMMEDIATELY
  // This allows the client UI to immediately switch to the processing/animation state.
  return bookId;
}


/**
 * Handles the AI content generation part of the pipeline.
 * @returns A partial Book object with the generated content and updated status.
 */
async function processContentGenerationForBook(userId: string, bookId: string, contentInput: GenerateBookContentInput): Promise<Partial<Book>> {
    // SERVER-SIDE SANITIZATION: Ensure prompt is within length limits.
    const userPrompt = contentInput.prompt.slice(0, MAX_PROMPT_LENGTH);
    const { bookLength, generationScope, origin } = contentInput;
    
    let totalWords = 600;
    let maxOutputTokens = 1200;

    switch (bookLength) {
        case 'short-story': totalWords = 600; maxOutputTokens = 1200; break;
        case 'mini-book': totalWords = 1500; maxOutputTokens = 3000; break;
        case 'standard-book': totalWords = 4500; maxOutputTokens = (generationScope === 'full') ? 9000 : 1200; break;
        case 'long-book': totalWords = 5000; maxOutputTokens = 9000; break;
    }
    
    // --- PROMPT ASSEMBLY ---
    
    const [primaryLanguage, secondaryLanguage] = origin.split('-');
    const primaryLanguageLabel = LANGUAGES.find(l => l.value === primaryLanguage)?.label || primaryLanguage || '';
    const secondaryLanguageLabel = secondaryLanguage ? (LANGUAGES.find(l => l.value === secondaryLanguage)?.label || secondaryLanguage) : '';

    let languageInstruction: string;
    let titleJsonInstruction: string;

    if (secondaryLanguage) {
        languageInstruction = `in bilingual ${primaryLanguageLabel} and ${secondaryLanguageLabel}, with sentences paired using ' / ' as a separator.`;
        titleJsonInstruction = `A concise, creative title for the book. Must be a JSON object with language codes, e.g., {"${primaryLanguage}": "Title", "${secondaryLanguage}": "Tiêu đề"}.`;
    } else {
        languageInstruction = `in ${primaryLanguageLabel}.`;
        titleJsonInstruction = `A concise, creative title for the book. Must be a JSON object, e.g., {"${primaryLanguage}": "Title"}.`;
    }

    let compactInstruction: string;
    if (generationScope === 'firstFew' && contentInput.totalChapterOutlineCount && contentInput.totalChapterOutlineCount > 0) {
        const wordsPerChapter = Math.round(totalWords / contentInput.totalChapterOutlineCount);
        compactInstruction = `Generate an array of ${contentInput.totalChapterOutlineCount} chapters. Write the full Markdown content for only the FIRST ${contentInput.chaptersToGenerate} chapters (about ${wordsPerChapter} words each). For the remaining chapters, provide the title but leave the 'content' field as an EMPTY string. The language must be ${languageInstruction}.`;
    } else {
        const wordsPerChapter = Math.round(totalWords / (contentInput.chaptersToGenerate || 1));
        compactInstruction = `Generate an array of ${contentInput.chaptersToGenerate} chapters, with about ${wordsPerChapter} words per chapter. Write the full Markdown content for ALL chapters. The language must be ${languageInstruction}.`;
    }
    
    const contextInstruction = contentInput.previousContentSummary
      ? `Continue a story from the summary: <previous_summary>${contentInput.previousContentSummary}</previous_summary>. The new chapters should be about: ${userPrompt}`
      : userPrompt;
    
    const titleInstructionText = "Create a title for the entire book based on the story or prompt.";
    
    // The new, improved output schema definition.
    const dynamicOutputSchema = createOutputSchema(titleJsonInstruction);

    const bookContentGenerationPrompt = ai.definePrompt({
        name: 'generateBookContentPrompt_v6_structured',
        input: { schema: PromptInputSchema },
        output: { schema: dynamicOutputSchema },
        prompt: `Write a book based on: {{{contextInstruction}}}

CRITICAL INSTRUCTIONS:
1.  {{{titleInstruction}}}
2.  {{{compactInstruction}}}
`,
        config: {
            safetySettings: [
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
            ],
        },
    });

    const promptInput = { 
        ...contentInput, 
        prompt: userPrompt, 
        compactInstruction, 
        contextInstruction,
        titleInstruction: titleInstructionText,
    };

    try {
        // STEP 1: Wait for the AI to generate the structured JSON output.
        const { output: aiOutput } = await bookContentGenerationPrompt(promptInput, { config: { maxOutputTokens } });

        if (!aiOutput || !aiOutput.chapters || aiOutput.chapters.length === 0) {
          throw new ApiServiceError('AI returned empty or invalid chapter data.', "UNKNOWN");
        }
        
        // STEP 2: Process the structured AI output.
        const finalChapters: Chapter[] = aiOutput.chapters.map((chapterData, index) => {
            const segments = parseMarkdownToSegments(chapterData.content || '', origin);
            
            const totalWords = segments.reduce((sum, segment) => {
                const text = segment.content[primaryLanguage] || '';
                return sum + text.split(/\s+/).filter(Boolean).length;
            }, 0);
            
            return {
                id: generateLocalUniqueId(),
                order: index,
                title: chapterData.title,
                segments: segments,
                stats: {
                    totalSegments: segments.length,
                    totalWords,
                    estimatedReadingTime: Math.ceil(totalWords / 200),
                },
                metadata: {},
            };
        });

        // The outline is now implicitly derived from the titles of all generated chapters.
        const finalChapterOutline = finalChapters.map(chapter => ({
            id: chapter.id,
            title: chapter.title,
            isGenerated: chapter.segments.length > 0,
            metadata: {},
        }));
        
        const finalBookTitle = aiOutput.bookTitle && typeof aiOutput.bookTitle === 'object' 
            ? aiOutput.bookTitle 
            : { [primaryLanguage]: "Untitled Book" };
        
        return {
          title: finalBookTitle,
          chapters: finalChapters,
          outline: finalChapterOutline,
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


    

    

