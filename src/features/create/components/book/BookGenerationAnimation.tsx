// src/features/create/components/book/BookGenerationAnimation.tsx

"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui/icons';
import type { Book, User, JobStatus, CreationFormValues } from '@/lib/types';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { BookPreview } from '@/features/reader/components/book/BookPreview';
import { cn } from '@/lib/utils';
import { useUser } from '@/contexts/user-context';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const Typewriter: React.FC<{ text: string }> = ({ text: fullText }) => {
    const [text, setText] = useState('');

    useEffect(() => {
        let isMounted = true;
        let i = 0;
        let timeoutId: NodeJS.Timeout;

        function type() {
            if (isMounted && i < fullText.length) {
                setText(fullText.substring(0, i + 1));
                i++;
                timeoutId = setTimeout(type, 80); // Increased delay for a slower, more deliberate effect
            }
        }
        type();
        
        return () => { 
            isMounted = false;
            clearTimeout(timeoutId); // Cleanup the timeout when the component unmounts
        };
    }, [fullText]);

    return (
        <div className="page-content" lang="en">
            {text}<span className="typing-cursor"></span>
        </div>
    );
};

const FinalStateDisplay: React.FC<{ book: Book }> = ({ book }) => {
    const { t } = useTranslation(['createPage', 'common']);
    const contentSuccess = book.contentState === 'ready';
    const coverSuccess = book.coverState === 'ready' || book.coverState === 'ignored';

    if (contentSuccess && coverSuccess) {
         return (
            <div className="mt-4 text-center space-y-2">
                <Button variant="link" asChild className="text-lg font-semibold font-headline p-0 h-auto">
                    <Link href="/library/book">
                        <Icon name="Library" className="mr-2 h-5 w-5" />
                        {t('status.complete')}
                    </Link>
                </Button>
            </div>
        );
    }
    
    // Handle error cases
    let title: string;
    let description: string;
    let icon: React.ReactNode = null;
    let errorDetails: React.ReactNode = null;

    if (contentSuccess && !coverSuccess) {
        title = t('finalState.contentSuccessCoverFailTitle');
        description = t('finalState.contentSuccessCoverFailDesc');
        icon = <Icon name="AlertCircle" className="h-8 w-8 text-amber-500" />;
        errorDetails = <p className="text-xs text-destructive mt-1"><strong>Cover Error:</strong> {book.coverError}</p>;
    } else if (!contentSuccess && coverSuccess) {
        title = t('finalState.contentFailCoverSuccessTitle');
        description = t('finalState.contentFailCoverSuccessDesc');
        icon = <Icon name="AlertCircle" className="h-8 w-8 text-amber-500" />;
        errorDetails = <p className="text-xs text-destructive mt-1"><strong>Content Error:</strong> {book.contentError}</p>;
    } else {
        title = t('finalState.allFailTitle');
        description = t('finalState.allFailDesc');
        icon = <Icon name="Info" className="h-8 w-8 text-destructive" />;
        errorDetails = (
            <div className="text-xs text-destructive mt-1 text-left">
                {book.contentError && <p><strong>Content:</strong> {book.contentError}</p>}
                {book.coverError && <p><strong>Cover:</strong> {book.coverError}</p>}
            </div>
        );
    }
    
     return (
         <div className="mt-4 text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
                {icon}
                <h3 className="font-headline text-md text-foreground">{title}</h3>
            </div>
            <p className="text-xs text-muted-foreground">{description}</p>
            {errorDetails}
        </div>
    );
}

interface BookGenerationAnimationProps {
  isFormBusy: boolean;
  bookJobData: Book | null;
  finalizedBookId: string | null;
  bookFormData: CreationFormValues;
  onViewBook: () => void;
  onCreateAnother: () => void;
}


export const BookGenerationAnimation: React.FC<BookGenerationAnimationProps> = ({ bookJobData, finalizedBookId, isFormBusy }) => {
  const { t } = useTranslation(['createPage']);
  const { user } = useUser();
  
  const contentStatus = bookJobData?.contentState;
  const coverStatus = bookJobData?.coverState;

  // The rendering logic is a sequence of prioritized states.
  // The first condition that is met will be rendered, and the component will stop checking further.

  // RENDER STATE 1: FINALIZED (Highest Priority)
  // If the job is complete (either success or fail), show the final result.
  if (finalizedBookId && bookJobData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full p-4 overflow-hidden">
        <div className="perspective-container" style={{ width: '255px', height: '357px' }}>
          <BookPreview
            isOpen={false} // Book is always closed in the final state.
            pageContent="" // No typewriter effect needed.
            finalBook={bookJobData}
            finalUser={user}
          />
        </div>
        <FinalStateDisplay book={bookJobData} />
      </div>
    );
  }

  // RENDER STATE 2: CONTENT IS PROCESSING (Second Priority)
  // This state is prioritized over cover generation. While content is being written,
  // the book is shown as open, regardless of the cover's status.
  // The book closes as soon as this state is no longer active.
  if (contentStatus === 'processing') {
    return (
        <div className={cn("flex flex-col items-center justify-center min-h-full p-4 overflow-hidden rounded-lg", isFormBusy && "border-2 border-dashed border-primary")}>
            <div className="perspective-container" style={{ width: '255px', height: '357px' }}>
                <BookPreview 
                    isOpen={true} // The book is open to show the writing animation.
                    pageContent={"In a realm of floating islands and crystalline rivers, a young dragon named Ignis discovered an ancient, silent library. It wasn't filled with books, but with slumbering memories waiting for a storyteller to awaken them. He took a deep breath, a tiny flame dancing on his snout, and began his tale..."}
                    finalBook={bookJobData || undefined}
                    finalUser={user}
                />
            </div>
            <div className="mt-4 text-muted-foreground h-6 text-sm text-center">
                 {t('status.contentProcessing')}
            </div>
        </div>
    );
  }
  
  // RENDER STATE 3: COVER IS PROCESSING (Third Priority)
  // This animation is ONLY shown if content is FINISHED, but the cover is still being generated.
  // If the cover finishes before the content, this state will be skipped entirely.
  if (coverStatus === 'processing') {
    return (
        <div className={cn("flex flex-col items-center justify-center min-h-full p-4 overflow-hidden rounded-lg", isFormBusy && "border-2 border-dashed border-primary")}>
            <div className="perspective-container" style={{ width: '255px', height: '357px' }}>
                <BookPreview 
                    isOpen={false} // The book is closed because content writing is done.
                    pageContent=""
                    finalBook={bookJobData || undefined}
                    finalUser={user}
                />
            </div>
            <div className="mt-4 text-muted-foreground h-6 text-sm text-center">
                {t('status.coverProcessing')}
            </div>
        </div>
    );
  }

  // RENDER STATE 4: INITIAL OR WAITING (Default/Fallback State)
  // This is the default view before anything starts, or in the brief moment between API calls.
  // The isFormBusy signal provides a basic "something is happening" indicator.
  return (
    <div className={cn("flex flex-col items-center justify-center min-h-full p-4 overflow-hidden rounded-lg", isFormBusy && "border-2 border-dashed border-primary")}>
        <div className="perspective-container" style={{ width: '255px', height: '357px' }}>
            <BookPreview 
                isOpen={false}
                pageContent=""
                finalBook={bookJobData || undefined}
                finalUser={user}
            />
        </div>
        <div className="mt-4 text-muted-foreground h-6 text-sm text-center">
            {isFormBusy ? t('status.conceptualizing') : t('previewArea.bookPlaceholder')}
        </div>
    </div>
  );
};
