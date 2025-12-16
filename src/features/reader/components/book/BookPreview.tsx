// src/features/reader/components/book/BookPreview.tsx

"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import type { Book, User } from '@/lib/types';
import CoverImage from '@/features/library/components/CoverImage';

const Typewriter: React.FC<{ text: string }> = ({ text: fullText }) => {
    const [text, setText] = React.useState('');

    React.useEffect(() => {
        if (!fullText) return;
        let isMounted = true;
        let i = 0;
        let timeoutId: NodeJS.Timeout;

        function type() {
            if (isMounted && i < fullText.length) {
                setText(fullText.substring(0, i + 1));
                i++;
                timeoutId = setTimeout(type, 80);
            }
        }
        type();
        
        return () => { 
            isMounted = false;
            clearTimeout(timeoutId);
        };
    }, [fullText]);

    return (
        <div className="page-content" lang="en">
            {text}<span className="typing-cursor"></span>
        </div>
    );
};

interface BookPreviewProps {
  isOpen: boolean;
  pageContent: string;
  finalBook?: Book;
  finalUser?: User | null;
}

const BookPreviewComponent: React.FC<BookPreviewProps> = ({ isOpen, pageContent, finalBook, finalUser }) => {
    
    const titleToDisplay = React.useMemo(() => {
        if (!finalBook) return 'Your Book Title';
        const titleContent = finalBook.title.primary || Object.values(finalBook.title)[0] || 'Untitled';
        return Array.isArray(titleContent) ? titleContent.join(' ') : titleContent;
    }, [finalBook]);


    const authorToDisplay = finalUser?.displayName || 'Author';

    return (
        <div id="book" className={cn('book-container', { open: isOpen })}>
            <div className="book-component back-cover"></div>

            <div className="book-component page">
                {isOpen && <Typewriter text={pageContent} />}
            </div>

            <div className="book-component cover">
                <div className="book-component front-cover prose-dynamic">
                    {/* The CoverImage component is now the single source of truth */}
                    <CoverImage
                        title={titleToDisplay}
                        author={authorToDisplay}
                        coverStatus={finalBook?.coverState}
                        cover={finalBook?.cover}
                        imageHint={finalBook?.imageHint}
                        isRetrying={false} // This preview is non-interactive for retries
                    />
                </div>
                <div className="book-component inside-front"></div>
            </div>

            <div className="book-component spine"></div>
        </div>
    );
};

export const BookPreview = React.memo(BookPreviewComponent);
