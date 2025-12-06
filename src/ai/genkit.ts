import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// Environment variables are now handled by Next.js automatically.

const googleAiApiKey = process.env.GOOGLE_AI_API_KEY;

if (!googleAiApiKey || googleAiApiKey === "YOUR_GOOGLE_AI_API_KEY") {
    console.warn("GOOGLE_AI_API_KEY environment variable is not set correctly. AI features may not work.");
}

export const ai = genkit({
  plugins: [
    googleAI({
      // Configure to use the Google AI for Developers API (free tier)
      // which is authenticated via an API key.
      apiKey: googleAiApiKey,
    }),
  ],
  // Set a default model that is available in Google AI for Developers.
  // Using 'gemini-2.0-flash' for fast and efficient generation.
  model: 'googleai/gemini-2.0-flash',
});
