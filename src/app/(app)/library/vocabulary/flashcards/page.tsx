"use client";

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import FlashcardsView from "@/features/vocabulary/components/flashcards/FlashcardsView";
import { Icon } from "@/components/ui/icons";

const Loader = () => (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-20rem)] text-center p-4">
      <Icon name="Layers" className="mx-auto h-12 w-12 text-primary animate-pulse mb-4" />
      <p className="text-lg text-muted-foreground">Loading...</p>
    </div>
);

function FlashcardsPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const folder = searchParams.get('folder');

    useEffect(() => {
        // If no folder is specified in the URL, redirect to the study page
        // where the user can select a deck to study.
        if (!folder) {
            router.replace('/library/vocabulary/flashcard-dashboard');
        }
    }, [folder, router]);

    // If there's no folder, we show a loader while redirecting.
    if (!folder) {
        return <Loader />;
    }
    
    // If a folder is present, render the actual flashcards view.
    return <FlashcardsView />;
}

// The main export uses a Suspense boundary because useSearchParams is used within its children.
export default function FlashcardsPage() {
    return (
        <Suspense fallback={<Loader />}>
            <FlashcardsPageContent />
        </Suspense>
    );
}
