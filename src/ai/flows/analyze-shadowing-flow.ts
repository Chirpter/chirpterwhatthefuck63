
'use server';
/**
 * @fileOverview Analyzes a user's shadowing attempt to provide targeted feedback.
 * - analyzeShadowingAttempt - The main flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { AnalyzeShadowingInput, AnalyzeShadowingOutput } from '@/features/learning/types/tracking.types';
import { AnalyzeShadowingInputSchema, AnalyzeShadowingOutputSchema } from '@/features/learning/types/tracking.types';


const analysisPrompt = ai.definePrompt({
    name: 'shadowingAnalysisPrompt',
    input: { schema: AnalyzeShadowingInputSchema },
    output: { schema: AnalyzeShadowingOutputSchema },
    prompt: `You are an expert English language tutor. Your task is to analyze a user's shadowing attempt and provide a single, highly specific, and encouraging piece of feedback.

Analyze the provided data:
- **Original Text:** The correct sentence.
- **User Transcript:** What the user typed.
- **Error Types:** A list of error categories found by a simple diff.
- **Behavioral Data:** 'playCount' (how many times they re-listened) and 'editCount' (how many times they re-tried).

**Your Actionable Feedback Rules:**

1.  **BE CONCISE:** Your entire feedback ('insight') MUST be a single sentence.
2.  **FOCUS ON THE MOST LIKELY CAUSE:** Do not list all errors. Synthesize the data to find the *root cause*.
3.  **USE BEHAVIORAL CUES:**
    *   If 'playCount' is high (3 or more), the user likely has trouble with listening speed or connected speech. Your feedback should address this.
    *   If 'editCount' is high (3 or more), the user is likely unsure of the spelling or grammar. Your feedback should focus on that.
    *   If 'errorTypes' contains 'ending_sound' or common grammatical mistakes (like plural -s), point it out.
    *   If 'errorTypes' contains 'wrong_word' for similar-sounding words, highlight the homophone confusion.
4.  **BE SPECIFIC & ENCOURAGING:**
    *   **Good:** "Great effort! It seems the speed was a bit tricky. The phrase 'a lot of' often sounds like 'alotta'."
    *   **Bad:** "You made mistakes."
    *   **Good:** "You're very close! Watch out for the silent 's' in 'island'."
    *   **Bad:** "You misspelled island."
5.  **PRIORITIZE:** If multiple issues exist, prioritize your feedback in this order: 1) Listening Speed/Connected Speech (if high playCount), 2) Spelling/Grammar (if high editCount), 3) Specific word errors (homophones, ending sounds).

**Example Scenarios:**

*   **Input:** original: "They live on an island", user: "They live on an ilan", playCount: 4, editCount: 1.
*   **Output:** insight: "You're doing great! The high speed might be tricky. The word 'island' has a silent 's' which can be hard to catch."

*   **Input:** original: "He walks to the shops", user: "He walk to the shop", playCount: 1, editCount: 3.
*   **Output:** insight: "Nice try! Pay close attention to the plural '-s' endings on words like 'walks' and 'shops'; they are subtle but important."

**Your Task:**
Generate the 'insight' and 'confidence' based on the following input data.

**Original Text:** {{{originalText}}}
**User Transcript:** {{{userTranscript}}}
**Identified Errors:** {{{jsonStringify errorTypes}}}
**User Behavior:** Listened {{{playCount}}} times, Retried {{{editCount}}} times.
`,
});

const analyzeShadowingAttemptFlow = ai.defineFlow(
  {
    name: 'analyzeShadowingAttempt',
    inputSchema: AnalyzeShadowingInputSchema,
    outputSchema: AnalyzeShadowingOutputSchema,
  },
  async (input) => {
    const { output } = await analysisPrompt(input);
    if (!output) {
      throw new Error("The AI model failed to generate an analysis.");
    }
    return output;
  }
);

// This is the only function exported from this file.
export async function analyzeShadowingAttempt(input: AnalyzeShadowingInput): Promise<AnalyzeShadowingOutput> {
  return await analyzeShadowingAttemptFlow(input);
}
