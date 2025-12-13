'use server';
import { config } from 'dotenv';
config();

import './flows/translate-text.flow';
import '@/features/learning/services/ai/analyze-shadowing.flow';

// The generate-cover-image-flow is now implicitly used by the book creation service
// and doesn't need to be registered for direct dev access.
// import '@/features/create/services/ai/generate-cover-image.flow';
