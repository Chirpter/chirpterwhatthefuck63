// src/features/diary/components/FlipBookWrapper.tsx

'use client';

import React, { useMemo } from 'react';
import HTMLFlipBook from 'react-pageflip';
import { useMobile } from '@/hooks/useMobile';
import { Page } from './Page';
import { DiaryPageContent } from './DiaryPageContent';
import type { DiaryEntry } from '../types';
import type { FoundationContainer } from '../foundation/foundation-container';

interface FlipBookWrapperProps {
  entriesForBook: DiaryEntry[]; 
  allEntries: (DiaryEntry | null)[];
  onNavigateToDate: (date: Date) => void;
  isViewMode: boolean;
  width: number;
  height: number;
  currentPage: number;
  onFlip?: (e: any) => void;
  className?: string;
  style?: React.CSSProperties;
  pageSize: { width: number; height: number };
  foundation: FoundationContainer;
  selectedObjectIds: string[];
  onAddPage: () => void;
  lastInteractedPageId: string | null;
  [key: string]: any;
}

export const FlipBookWrapper = React.forwardRef<any, FlipBookWrapperProps>(
  ({ entriesForBook, allEntries, onNavigateToDate, isViewMode, width, height, currentPage, onFlip, className, style, pageSize, foundation, selectedObjectIds, onAddPage, lastInteractedPageId, ...flipProps }, ref) => {
    const isMobile = useMobile();

    const startPage = currentPage * 2;
    
    const pages = useMemo(() => {
        const allPages: any[] = [
            { type: 'inside-cover-front', pageNumber: 0, allEntries: allEntries, onNavigateToDate: onNavigateToDate },
        ];

        entriesForBook.forEach((entry, index) => {
            allPages.push({
                type: 'content',
                entry,
                pageNumber: index + 1,
            });
        });
        
        allPages.push({
            type: 'inside-cover-back',
            pageNumber: allPages.length,
            onAddPage,
        });
        
        return allPages;

    }, [entriesForBook, onAddPage, allEntries, onNavigateToDate]);


    const flipBookConfig = {
      width,
      height,
      size: "fixed" as const,
      minWidth: width,
      maxWidth: width,
      minHeight: height,
      maxHeight: height,
      maxShadowOpacity: 0.3,
      showCover: false,
      flippingTime: 400,
      startPage: startPage,
      usePortrait: isMobile,
      startZIndex: 0,
      autoSize: false,
      swipeDistance: isViewMode ? 30 : 0, 
      clickEventForward: false,
      useMouseEvents: isViewMode && !isMobile,
      mobileScrollSupport: isViewMode,
      disableFlipByClick: !isViewMode,
      drawShadow: isViewMode,
      showPageCorners: isViewMode,
      ...flipProps
    };
    
    const visiblePageNumbers = [currentPage * 2, currentPage * 2 + 1];

    return (
      <HTMLFlipBook
        {...flipBookConfig}
        key={isViewMode ? 'view-mode' : 'edit-mode'}
        ref={ref}
        onFlip={onFlip}
        className={className}
        style={style}
      >
        {pages.map((pageData) => {
            const pageId = pageData.type === 'content' ? pageData.entry?.id?.toString() : (pageData.type === 'inside-cover-front' ? 'cover-front' : 'cover-back');
            const isActiveForEditing = !isViewMode && visiblePageNumbers.includes(pageData.pageNumber);
            
            // LAZY RENDERING LOGIC
            const distance = Math.abs(Math.floor(pageData.pageNumber / 2) - currentPage);
            const shouldRenderContent = distance <= 1; // Render current spread and the ones next to it

            return (
              <Page 
                  key={`stable-page-${pageData.pageNumber}`}
                  number={pageData.pageNumber}
                  isCover={pageData.type.includes('cover')}
                  coverType={pageData.type.includes('cover') ? pageData.type as 'inside-cover-front' | 'inside-cover-back' : undefined}
                  isViewMode={isViewMode}
                  data-page-id={pageId}
                  onAddPage={pageData.onAddPage}
                  isActiveForEditing={isActiveForEditing}
                  allEntries={pageData.allEntries}
                  onNavigateToDate={pageData.onNavigateToDate}
              >
                  {shouldRenderContent && pageData.type === 'content' && (
                      <DiaryPageContent
                          entry={pageData.entry}
                          pageSize={pageSize}
                          foundation={foundation}
                          selectedObjectIds={selectedObjectIds}
                      />
                  )}
              </Page>
            )
        })}
      </HTMLFlipBook>
    );
  }
);

FlipBookWrapper.displayName = 'FlipBookWrapper';
