
import { config } from 'dotenv';
config();

import '@/ai/flows/translate-text-flow.ts';
import '@/ai/flows/analyze-shadowing-flow.ts';

// The generate-cover-image-flow is now implicitly used by the book creation service
// and doesn't need to be registered for direct dev access.
// import '@/ai/flows/generate-cover-image-flow.ts';
