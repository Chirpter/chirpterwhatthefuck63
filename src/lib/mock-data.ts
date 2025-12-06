// src/lib/mock-data.ts

import type { DiaryEntry, EnhancedDiaryObject } from './types';

// This data is now only for reference and initial seeding if needed.
// The live app will primarily use the local database.
export const mockEntries: DiaryEntry[] = [
  {
    id: 20240501,
    objects: [
      { id: 't1', type: 'text', transform: { x: 0.1, y: 0.05, width: 0.8, height: 0.1, rotation: 0 }, content: '<h2 class="text-2xl font-headline font-bold">A New Beginning</h2>' },
      { id: 'd1', type: 'text', transform: { x: 0.1, y: 0.15, width: 0.4, height: 0.05, rotation: 0 }, content: '<p class="text-sm text-muted-foreground">May 1, 2024</p>' },
      { id: 'obj1', type: 'text', transform: { x: 0.1, y: 0.22, width: 0.8, height: 0.25, rotation: 0 }, content: '<p>Today was the start of a new adventure. I decided to learn how to code a diary app from scratch. The possibilities feel endless, and I\'m excited to see where this journey takes me. The sun was shining, and the coffee was strong.</p>' },
      { id: 'obj2', type: 'image', transform: { x: 0.1, y: 0.5, width: 0.5, height: 0.3, rotation: -2 }, content: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=60' },
      { id: 's1', type: 'sticker', transform: { x: 0.8, y: 0.05, width: 0.1, height: 0.07, rotation: 15 }, content: '☀️' },
      { id: 's2', type: 'sticker', transform: { x: 0.08, y: 0.85, width: 0.1, height: 0.07, rotation: 0 }, content: '☕️' },
    ] as EnhancedDiaryObject[]
  },
  {
    id: 20240503,
    objects: [
      { id: 't2', type: 'text', transform: { x: 0.1, y: 0.05, width: 0.8, height: 0.1, rotation: 0 }, content: '<h2 class="text-2xl font-headline font-bold">First Hurdle</h2>' },
      { id: 'd2', type: 'text', transform: { x: 0.1, y: 0.15, width: 0.4, height: 0.05, rotation: 0 }, content: '<p class="text-sm text-muted-foreground">May 3, 2024</p>' },
      { id: 'obj3', type: 'text', transform: { x: 0.1, y: 0.22, width: 0.8, height: 0.2, rotation: 0 }, content: '<p>Ran into my first major bug today. It was frustrating, but after a few hours of debugging, the feeling of finally fixing it was incredibly rewarding. It’s a reminder that persistence is key in programming and in life.</p>' }
    ] as EnhancedDiaryObject[]
  },
  // Add more entries if needed, following the new `EnhancedDiaryObject` structure
];
