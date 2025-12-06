
import { config } from 'dotenv';
config();

import '@/ai/flows/generate-book-content.ts';
import '@/ai/flows/generate-piece-content.ts';
import '@/ai/flows/generate-cover-image-flow.ts';
import '@/ai/flows/translate-text-flow.ts';
import '@/ai/flows/generate-book-chapter.ts';
import '@/ai/flows/analyze-shadowing-flow.ts';
