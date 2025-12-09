
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui/icons';
import type { Book, User, JobStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { BookPreview } from './BookPreview';
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
                        Complete!
                    </Link>
                </Button>
            </div>
        );
    }
    
    // Handle error cases
    let title: string;
    let description: string;
    let icon: React.ReactNode;
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
  bookFormData: any; // Simplified for this component
  onViewBook: () => void;
  onCreateAnother: () => void;
}


export const BookGenerationAnimation: React.FC<BookGenerationAnimationProps> = ({ bookJobData, finalizedBookId, isFormBusy }) => {
  const { t } = useTranslation(['createPage']);
  const { user } = useUser();
  
  // Extract statuses from the job data. These are the "signals" that drive the animation.
  const contentStatus = bookJobData?.contentState;
  const coverStatus = bookJobData?.coverState;

  // --- ANIMATION LOGIC ---
  // The core animation of the book opening is ONLY tied to the content generation process.
  // This allows the cover generation to happen in the background without affecting this primary animation.
  
  // ✅ TÍN HIỆU MỞ SÁCH:
  // Animation mở sách chỉ được kích hoạt khi và chỉ khi 'contentStatus' có giá trị là 'processing'.
  // Đây là tín hiệu cụ thể cho biết "hệ thống đang viết nội dung".
  const isBookOpen = contentStatus === 'processing';
  
  // The status message displayed to the user is derived from the state of both pipelines.
  const statusMessage = useMemo(() => {
    // If the form isn't busy, show the default placeholder.
    if (!isFormBusy) return t('previewArea.bookPlaceholder');
    
    // Prioritize showing the content generation status.
    if (contentStatus === 'processing') {
      return t('status.contentProcessing');
    }
    
    // If content is done, show the cover generation status.
    if (coverStatus === 'processing') {
      return t('status.coverProcessing');
    }
    
    // Fallback message while waiting for the final state.
    return t('status.finishing');
  }, [isFormBusy, contentStatus, coverStatus, t]);


  // --- RENDER LOGIC ---

  // RENDER STATE 1: FINALIZED
  // If a finalizedId exists, it means both pipelines are complete (success or error).
  // We stop all "in-progress" animations and show the final result.
  if (finalizedBookId && bookJobData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full p-4 overflow-hidden">
        <div className="perspective-container" style={{ width: '255px', height: '357px' }}>
          {/* BookPreview now shows the final state with the actual cover/title */}
          <BookPreview
            isOpen={false} // The book is always closed in the final state.
            pageContent="" // No typewriter effect needed.
            finalBook={bookJobData}
            finalUser={user}
          />
        </div>
        {/* FinalStateDisplay shows "Complete!" or error details. */}
        <FinalStateDisplay book={bookJobData} />
      </div>
    );
  }

  // RENDER STATE 2: IN-PROGRESS OR INITIAL
  // This is the default view before starting, or the active animation view during generation.
  return (
    <div className={cn(
      "flex flex-col items-center justify-center min-h-full p-4 overflow-hidden rounded-lg",
      isFormBusy && "border-2 border-dashed border-primary" // Visual feedback that a job is running.
    )}>
        <div className="perspective-container" style={{ width: '255px', height: '357px' }}>
            <BookPreview 
                // The `isOpen` prop triggers the 3D book opening animation in CSS.
                // This is ONLY true when `contentStatus` is 'processing'.
                isOpen={isBookOpen}
                // The typewriter effect is shown inside the book when it's open.
                pageContent={"In a realm of floating islands and crystalline rivers, a young dragon named Ignis discovered an ancient, silent library. It wasn't filled with books, but with slumbering memories waiting for a storyteller to awaken them. He took a deep breath, a tiny flame dancing on his snout, and began his tale..."}
                // `finalBook` prop is used to render the cover. It will show the processing state if `coverStatus` is 'processing'.
                finalBook={bookJobData || undefined}
                finalUser={user}
            />
        </div>
        <div className="mt-4 text-muted-foreground h-6 text-sm text-center">
            {/* The status message dynamically updates based on the memoized logic above. */}
            {isFormBusy ? statusMessage : t('previewArea.bookPlaceholder')}
        </div>
    </div>
  );
};
