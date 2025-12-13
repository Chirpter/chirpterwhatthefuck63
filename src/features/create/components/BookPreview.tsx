// src/features/create/components/BookPreview.tsx

"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import type { Book } from '@/lib/types';
import type { User as AuthUser } from 'firebase/auth'; // Keep this for the prop type
import type { User } from '@/lib/types'; // And keep this for the prop type
import { Icon } from '@/components/ui/icons';

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
  pageContent: string; // Changed to string
  finalBook?: Book;
  finalUser?: User | null; // Use the detailed User type
}

const BookPreviewComponent: React.FC<BookPreviewProps> = ({ isOpen, pageContent, finalBook, finalUser }) => {
  const { t } = useTranslation(['createPage', 'common', 'bookCard']);

  const renderFinalCover = () => {
    if (!finalBook) {
         // Default initial state before generation starts
        return (
            <div className="text-center p-4">
              <h2 className="font-headline title">{t('previewArea.bookTitle')}</h2>
              <p className="font-body author">{t('previewArea.bookAuthor')}</p>
              <div className="emblem">✨</div>
            </div>
        );
    }
    
    // ✅ FIX: Ensure titleForAlt is always a string
    const titleFromBook = finalBook.title.primary || Object.values(finalBook.title)[0] || 'Untitled';
    const titleForAlt = Array.isArray(titleFromBook) ? titleFromBook.join(' ') : titleFromBook;
    
    // Case 1: Cover is an image and is ready
    if (finalBook.cover?.url && finalBook.coverState === 'ready') {
      return (
        <div className="w-full h-full relative">
          <img src={finalBook.cover.url} alt={titleForAlt} className="w-full h-full object-cover" />
        </div>
      );
    }

    // Case 2: Cover is still processing
    if (finalBook.coverState === 'processing') {
      return (
        <div className="w-full h-full bg-gradient-to-br from-muted to-background flex flex-col items-center justify-center p-4 text-center">
            <Icon name="Wand2" className="h-10 w-10 text-primary animate-pulse mb-2" />
            <p className="text-xs font-semibold text-muted-foreground">{t('bookCard:coverProcessing')}</p>
        </div>
      );
    }
    
    // Case 3: No cover, cover failed, or content just finished. Show title/author.
    const titleToDisplay = Array.isArray(finalBook.title.primary) ? (finalBook.title.primary as string[]).join(' ') : finalBook.title.primary;
    return (
      <div className="text-center p-4">
        <h2 className="font-headline title" style={{ fontSize: '1.8rem', textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>
            {titleToDisplay}
        </h2>
        <p className="font-body author">{finalUser?.displayName || t('common:author')}</p>
        <div className="emblem">✨</div>
      </div>
    );
  };


  return (
    <div id="book" className={cn('book-container', { open: isOpen })}>
      {/* Back cover of the book */}
      <div className="book-component back-cover"></div>

      {/* The main page content area */}
      <div className="book-component page">
        {/* The Typewriter is now called internally, only when the book is open */}
        {isOpen && <Typewriter text={pageContent} />}
      </div>

      {/* The front cover assembly (front face and inside face) */}
      <div className="book-component cover">
        <div className="book-component front-cover">
          {renderFinalCover()}
        </div>
        {/* The inside face of the front cover */}
        <div className="book-component inside-front"></div>
      </div>

      {/* The spine of the book */}
      <div className="book-component spine"></div>
    </div>
  );
};

export const BookPreview = React.memo(BookPreviewComponent);
