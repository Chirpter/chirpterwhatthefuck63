// src/app/(app)/diary/page.tsx
'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Icon } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

/**
 * Placeholder page for the Diary feature, indicating it is under development.
 */
export default function DiaryPage() {
  return (
    <div className="flex h-full items-center justify-center text-center">
      <Card className="max-w-md p-6">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Icon name="BookHeart" className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-headline-1">Diary Feature Coming Soon!</CardTitle>
          <CardDescription className="text-body-base">
            We are currently refining the diary experience to make it even better. Please check back later.
          </CardDescription>
        </CardHeader>
        <Button asChild>
          <Link href="/library/book">Go to Library</Link>
        </Button>
      </Card>
    </div>
  );
}
