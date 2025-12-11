
'use server';
/**
 * @fileOverview A flow to translate a given text to a target language using Google's non-AI translation API.
 * - translateText - Translates text.
 * - TranslateTextInput - Input schema.
 * - TranslateTextOutput - Output schema.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { TranslateTextInput } from '@/lib/types';
import { TranslateTextInputSchema } from '@/lib/types';

const TranslateTextOutputSchema = z.object({
  translation: z.string().describe('The translated text.'),
  partOfSpeech: z.string().optional().describe('The grammatical part of speech of the original text (e.g., "noun", "verb", "adjective"). Abbreviate if necessary (e.g., "n.", "v.", "adj."). Omit if not applicable or unclear.'),
});
export type TranslateTextOutput = z.infer<typeof TranslateTextOutputSchema>;


export async function translateText(input: TranslateTextInput): Promise<TranslateTextOutput> {
  return translateTextFlow(input);
}


const translateTextFlow = ai.defineFlow(
  {
    name: 'translateTextFlow_NonAI', // Renamed to reflect new logic
    inputSchema: TranslateTextInputSchema,
    outputSchema: TranslateTextOutputSchema,
  },
  async (input) => {
    const { text, sourceLanguage, targetLanguage } = input;
    
    const googleTranslateUrl = new URL("https://translate.googleapis.com/translate_a/single");
    googleTranslateUrl.searchParams.append("client", "gtx");
    googleTranslateUrl.searchParams.append("sl", sourceLanguage || 'auto');
    googleTranslateUrl.searchParams.append("tl", targetLanguage);
    googleTranslateUrl.searchParams.append("dt", "t"); // Request translation of text
    googleTranslateUrl.searchParams.append("q", text);

    try {
        const response = await fetch(googleTranslateUrl.toString());
        if (!response.ok) {
            throw new Error(`Google Translate API failed with status ${response.status}`);
        }
        
        const jsonResponse = await response.json();
        
        // The Google Translate API returns a nested array.
        // The main translation is in the first element of the first array.
        const translation = jsonResponse?.[0]?.map((s: any[]) => s[0]).join("") || null;

        if (!translation) {
            throw new Error("Failed to parse translation from Google API response.");
        }
        
        // The non-AI API doesn't provide part of speech, so we return an empty value.
        return {
            translation: translation,
            partOfSpeech: undefined, 
        };

    } catch (error) {
        console.error("[Non-AI Translate Flow] Error:", error);
        throw new Error('Translation backend failed.');
    }
  }
);
