
"use client";

import React from 'react';
import { ReaderPage } from '@/features/reader/components/ReaderPage';

// The page component is now a simple wrapper that renders the main ReaderPageComponent.
// This adheres to the architectural principle of keeping page files clean and simple.
// The 'use client' directive is placed here to ensure the entire route is client-rendered,
// which is necessary for the complex, browser-dependent logic to work correctly.
export default function ReadPage() {
  return (
    <ReaderPage />
  );
}
