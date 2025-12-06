

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
    const contentSuccess = book.contentStatus === 'ready';
    const coverSuccess = book.coverStatus === 'ready' || book.coverStatus === 'ignored';

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
  
  const contentStatus = bookJobData?.contentStatus;
  const coverStatus = bookJobData?.coverStatus;

  const isBookOpen = contentStatus === 'processing';
  
  const statusMessage = useMemo(() => {
    if (!isFormBusy) return t('previewArea.bookPlaceholder');
    
    if (contentStatus === 'processing') {
      return t('status.contentProcessing');
    }
    
    if (coverStatus === 'processing') {
      return t('status.coverProcessing');
    }
    
    return t('status.finishing');
  }, [isFormBusy, contentStatus, coverStatus, t]);


  if (finalizedBookId && bookJobData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full p-4 overflow-hidden">
        <div className="perspective-container" style={{ width: '255px', height: '357px' }}>
          <BookPreview
            isOpen={false}
            pageContent=""
            finalBook={bookJobData}
            finalUser={user}
          />
        </div>
        <FinalStateDisplay book={bookJobData} />
      </div>
    );
  }

  // Animation is active or it's the initial placeholder view
  return (
    <div className={cn(
      "flex flex-col items-center justify-center min-h-full p-4 overflow-hidden rounded-lg",
      isFormBusy && "border-2 border-dashed border-primary"
    )}>
        <div className="perspective-container" style={{ width: '255px', height: '357px' }}>
            <BookPreview 
                isOpen={isBookOpen}
                pageContent={"In a realm of floating islands and crystalline rivers, a young dragon named Ignis discovered an ancient, silent library. It wasn't filled with books, but with slumbering memories waiting for a storyteller to awaken them. He took a deep breath, a tiny flame dancing on his snout, and began his tale..."}
                finalBook={bookJobData || undefined}
                finalUser={user}
            />
        </div>
        <div className="mt-4 text-muted-foreground h-6 text-sm text-center">
            {isFormBusy ? statusMessage : t('previewArea.bookPlaceholder')}
        </div>
    </div>
  );
};
