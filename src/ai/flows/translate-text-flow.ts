
'use server';
/**
 * @fileOverview A flow to translate a given text to a target language.
 * - translateText - Translates text.
 * - TranslateTextInput - Input schema.
 * - TranslateTextOutput - Output schema.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { LANGUAGES } from '@/lib/constants';
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

const PromptInputSchema = z.object({
    text: z.string(),
    targetLanguage: z.string(),
    sourceInstruction: z.string(),
});

const translationPrompt = ai.definePrompt({
    name: 'translateTextPrompt',
    input: { schema: PromptInputSchema },
    output: { schema: TranslateTextOutputSchema },
    prompt: `Translate the following text into {{targetLanguage}}. Also, identify the grammatical part of speech for the text.
{{sourceInstruction}}
    
Text to translate: "{{{text}}}"

Return ONLY a JSON object with the translation and its part of speech. Do not add any extra formatting, explanations, or markdown.
`,
});


const translateTextFlow = ai.defineFlow(
  {
    name: 'translateTextFlow',
    inputSchema: TranslateTextInputSchema,
    outputSchema: TranslateTextOutputSchema,
  },
  async (input) => {
    // Convert language codes ('en', 'vi') to full names ('English', 'Vietnamese') for the prompt
    const targetLangLabel = LANGUAGES.find(l => l.value === input.targetLanguage)?.label || input.targetLanguage;
    const sourceLangLabel = input.sourceLanguage ? (LANGUAGES.find(l => l.value === input.sourceLanguage)?.label || input.sourceLanguage) : undefined;
    
    const sourceInstruction = sourceLangLabel ? `The source text is in ${sourceLangLabel}.` : '';

    const promptInput = {
        text: input.text,
        targetLanguage: targetLangLabel,
        sourceInstruction,
    };

    const { output } = await translationPrompt(promptInput);

    if (!output?.translation) {
      throw new Error('AI failed to provide a translation.');
    }
    
    return output;
  }
);
