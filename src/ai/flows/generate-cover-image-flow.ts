'use server';
/**
 * @fileOverview A flow to generate and compress a cover image from a prompt.
 * This flow now takes a bookId to update the corresponding library item directly.
 * - generateCoverImage - Generates and compresses an image.
 * - GenerateCoverImageInput - Input schema.
 * - GenerateCoverImageOutput - Output schema.
 */
import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import sharp from 'sharp';
import type { GenerateCoverImageInput } from '@/lib/types';
import { GenerateCoverImageInputSchema } from '@/lib/types';
import { MAX_PROMPT_LENGTH } from '@/lib/constants';

const GenerateCoverImageOutputSchema = z.object({
  imageUrl: z.string().describe('The data URI of the generated and compressed image.'),
  bookId: z.string().describe('The ID of the book this cover is for.'),
});
export type GenerateCoverImageOutput = z.infer<typeof GenerateCoverImageOutputSchema>;

export async function generateCoverImage(input: GenerateCoverImageInput): Promise<GenerateCoverImageOutput> {
  return generateCoverImageFlow(input);
}

const generateCoverImageFlow = ai.defineFlow(
  {
    name: 'generateCoverImageFlow',
    inputSchema: GenerateCoverImageInputSchema,
    outputSchema: GenerateCoverImageOutputSchema,
  },
  async (input) => {
    // Server-side validation: Truncate the prompt if it's too long
    const userPrompt = input.prompt.slice(0, MAX_PROMPT_LENGTH);
    
    // The prompt to the image model should be crafted to ask for a book cover.
    const imageGenerationPrompt = `Create a 3:4 ratio stylized and artistic illustration for book cover inspired by "${userPrompt}"`;
    
    const {media} = await ai.generate({
      model: 'googleai/gemini-2.0-flash-preview-image-generation', 
      prompt: imageGenerationPrompt,
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    if (!media || !media.url || media.url.trim() === "") {
      throw new Error('Image generation did not return a valid, non-empty media URL. The model might have refused the prompt or encountered an issue.');
    }

    // Image Optimization Step
    try {
      const base64Data = media.url.split(',')[1];
      if (!base64Data) {
        throw new Error("Could not extract base64 data from the generated image URL.");
      }
      const imageBuffer = Buffer.from(base64Data, 'base64');
      
      // Get original image metadata
      const metadata = await sharp(imageBuffer).metadata();
      const originalWidth = metadata.width;
      const originalHeight = metadata.height;
      const originalAspect = originalWidth / originalHeight;
      const targetAspect = 512 / 683; // 0.75 (3:4 ratio)

      console.log(`Original: ${originalWidth}x${originalHeight}, aspect: ${originalAspect.toFixed(3)}`);
      console.log(`Target: 512x683, aspect: ${targetAspect.toFixed(3)}`);

      let processedBuffer;

      // CASE 1: Image already has correct 3:4 ratio (~0.75)
      if (Math.abs(originalAspect - targetAspect) < 0.01) {
        console.log('Perfect 3:4 ratio - Simple resize');
        processedBuffer = await sharp(imageBuffer)
          .resize(512, 683)
          .webp({ quality: 80 })
          .toBuffer();
      }
      // CASE 2: Square (1:1) or wider image - Crop sides (Windows style)
      else {
        console.log('Wider or square image - Crop sides');
        // Use height as reference, calculate new width based on target aspect ratio
        const newHeight = originalHeight;
        const newWidth = Math.round(newHeight * targetAspect);
        
        processedBuffer = await sharp(imageBuffer)
          .resize(newWidth, newHeight, {
            fit: 'cover',
            position: 'center' // Crop from center (sides)
          })
          .resize(512, 683) // Final resize to target dimensions
          .webp({ quality: 80 })
          .toBuffer();
      }

      const compressedImageDataUrl = `data:image/webp;base64,${processedBuffer.toString('base64')}`;
      
      console.log(`Image optimized: Original ${originalWidth}x${originalHeight} -> 512x683`);

      return { imageUrl: compressedImageDataUrl, bookId: input.bookId };

    } catch (compressionError) {
        console.error("Error during image optimization:", compressionError);
        // Fallback to the original image if optimization fails
        return { imageUrl: media.url, bookId: input.bookId };
    }
  }
);