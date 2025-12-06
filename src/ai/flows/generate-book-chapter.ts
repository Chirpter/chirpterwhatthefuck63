
'use server';
/**
 * @fileOverview A simple flow to generate a single book chapter from a prompt.
 * - generateBookChapter - Handles the chapter generation.
 * - GenerateChapterInput - Input type.
 * - GenerateChapterOutput - Output type.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import type { GenerateChapterInput } from '@/lib/types';
import { GenerateChapterInputSchema } from '@/lib/types';

const GenerateChapterOutputSchema = z.object({
  chapterText: z.string().describe('The generated text for the chapter.'),
});
export type GenerateChapterOutput = z.infer<typeof GenerateChapterOutputSchema>;

export async function generateBookChapter(input: GenerateChapterInput): Promise<GenerateChapterOutput> {
  return generateBookChapterFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateBookChapterPrompt',
  input: { schema: GenerateChapterInputSchema },
  output: { schema: GenerateChapterOutputSchema },
  prompt: `You are a creative writer. Write the content for a chapter based on the following prompt.
  
Prompt: {{{prompt}}}

Return the generated text in the 'chapterText' field.`,
  config: {
    maxOutputTokens: 1200,
  }
});

const generateBookChapterFlow = ai.defineFlow(
  {
    name: 'generateBookChapterFlow',
    inputSchema: GenerateChapterInputSchema,
    outputSchema: GenerateChapterOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error('AI failed to generate chapter content.');
    }
    return output;
  }
);
