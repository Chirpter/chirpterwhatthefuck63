"use client";

import React, { useMemo } from 'react';
import type { LibraryItem, SystemBookmark, CombinedBookmark, BookmarkState } from '@/lib/types';

/**
 * A helper component to inject dynamic CSS into the document head.
 * It ensures that the CSS rules are available globally.
 */
const StyleInjector = ({ css, id }: { css: string; id: string }) => {
    const uniqueId = `dynamic-style-${id}`;
    
    React.useEffect(() => {
        let styleElement = document.getElementById(uniqueId);
        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = uniqueId;
            document.head.appendChild(styleElement);
        }
        
        styleElement.textContent = css || '';

        return () => {
            // Do not remove on unmount to prevent animations from stopping.
            // This component will be rendered once at a higher level.
        };
    }, [css, uniqueId]);

    return null;
}

const getResolvedState = (bookmark: SystemBookmark, stateName: 'initialState' | 'completedState'): Partial<BookmarkState> => {
    const baseState = bookmark.initialState || {};
    if (stateName === 'initialState') return baseState;
    const overrideState = bookmark.completedState || {};
    return {
        mainVisual: overrideState.mainVisual ?? baseState.mainVisual,
        sound: overrideState.sound ?? baseState.sound,
        customCss: overrideState.customCss ?? baseState.customCss,
    };
};

interface BookmarkStyleProviderProps {
  items: LibraryItem[] | CombinedBookmark[];
  availableBookmarks: CombinedBookmark[];
  children: React.ReactNode;
}

/**
 * A provider that collects all necessary bookmark styles from a list of library items
 * and injects them into the document head, avoiding duplicates and lifecycle issues.
 */
export const BookmarkStyleProvider: React.FC<BookmarkStyleProviderProps> = ({ items, availableBookmarks, children }) => {
    const allRequiredStyles = useMemo(() => {
        const stylesMap = new Map<string, { initialCss?: string; completedCss?: string }>();
        const bookItems = items.filter(item => item.type === 'book') as (LibraryItem & { type: 'book' })[];

        bookItems.forEach(book => {
            const bookmarkId = book.selectedBookmark || 'default';
            const bookmarkData = availableBookmarks.find(b => b.id === bookmarkId);

            if (bookmarkData && !stylesMap.has(bookmarkId)) {
                const initialState = getResolvedState(bookmarkData, 'initialState');
                const completedState = getResolvedState(bookmarkData, 'completedState');
                
                const uniqueClassName = `bookmark-preview-${bookmarkData.id}`;
                const initialCss = initialState.customCss?.replace(/\.preview-element/g, `.${uniqueClassName}`);
                const completedCss = completedState.customCss?.replace(/\.preview-element/g, `.${uniqueClassName}`);

                stylesMap.set(bookmarkId, { initialCss, completedCss });
            }
        });
        
        // Also add all available bookmarks for the admin view
        availableBookmarks.forEach(bookmarkData => {
            if (bookmarkData && !stylesMap.has(bookmarkData.id)) {
                const initialState = getResolvedState(bookmarkData, 'initialState');
                const completedState = getResolvedState(bookmarkData, 'completedState');
                
                const uniqueClassName = `bookmark-preview-${bookmarkData.id}`;
                const initialCss = initialState.customCss?.replace(/\.preview-element/g, `.${uniqueClassName}`);
                const completedCss = completedState.customCss?.replace(/\.preview-element/g, `.${uniqueClassName}`);

                stylesMap.set(bookmarkData.id, { initialCss, completedCss });
            }
        });


        return Array.from(stylesMap.entries());
    }, [items, availableBookmarks]);

    return (
        <>
            {allRequiredStyles.map(([bookmarkId, { initialCss, completedCss }]) => (
                <React.Fragment key={bookmarkId}>
                    {initialCss && <StyleInjector css={initialCss} id={`${bookmarkId}-initial`} />}
                    {completedCss && <StyleInjector css={completedCss} id={`${bookmarkId}-completed`} />}
                </React.Fragment>
            ))}
            {children}
        </>
    );
};
