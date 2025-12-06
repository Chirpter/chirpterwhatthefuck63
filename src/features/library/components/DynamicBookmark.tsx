

"use client";

import React, { useEffect, useMemo, useCallback, useState } from 'react';
import type { SystemBookmark, BookmarkState } from '@/lib/types';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useLibrary } from '../hooks/useLibrary';

/**
 * Merges initialState and completedState to get the final renderable state.
 * @param bookmark The bookmark data from Firestore.
 * @param stateName The desired state to render ('initialState' or 'completedState').
 * @returns A complete state object ready for rendering.
 */
const getResolvedState = (bookmark: SystemBookmark, stateName: 'initialState' | 'completedState'): Partial<BookmarkState> => {
    const baseState = bookmark.initialState || {};
    
    if (stateName === 'initialState') {
        return baseState;
    }
    
    const overrideState = bookmark.completedState || {};

    return {
        mainVisual: overrideState.mainVisual ?? baseState.mainVisual,
        sound: overrideState.sound ?? baseState.sound,
        customCss: overrideState.customCss ?? baseState.customCss,
    };
};

export const DynamicBookmark: React.FC<{
  bookmark: SystemBookmark;
  isComplete?: boolean;
  isInteractive?: boolean;
}> = ({ bookmark, isComplete: isCompleteProp, isInteractive = true }) => {
    const [isRenderComplete, setIsRenderComplete] = useState(isCompleteProp);

    useEffect(() => {
        setIsRenderComplete(isCompleteProp);
    }, [isCompleteProp]);

    const handleInteraction = useCallback(() => {
        const currentStateName = isRenderComplete ? 'completedState' : 'initialState';
        const stateToPlay = getResolvedState(bookmark, currentStateName);
        const soundToPlay = stateToPlay.sound;
        
        if (soundToPlay) {
            try {
                new Audio(soundToPlay).play().catch(e => console.error("Audio playback failed:", e));
            } catch (error) {
                console.error("Failed to handle bookmark sound:", error);
            }
        }
        
        // Only change visual state if interactive (i.e., in a preview environment)
        if (isInteractive && bookmark.completedState?.mainVisual) {
            setIsRenderComplete(prev => !prev);
        }
    }, [bookmark, isRenderComplete, isInteractive]);

    const stateToRender = getResolvedState(bookmark, isRenderComplete ? 'completedState' : 'initialState');
    
    if (!stateToRender || !stateToRender.mainVisual?.value) {
        return <div className="w-full h-full bg-muted/20" />;
    }

    const { mainVisual } = stateToRender;
    
    const uniqueClassName = useMemo(() => `bookmark-preview-${bookmark.id}`, [bookmark.id]);

    return (
        <div 
            id={`dynamic-bookmark-${bookmark.id}`}
            className="relative w-full h-full perspective-container cursor-pointer"
            onClick={handleInteraction}
        >
            <div 
                className={cn("preview-element w-full h-full", uniqueClassName)}
            >
                <Image 
                    src={mainVisual.value} 
                    alt={bookmark.name} 
                    fill 
                    className="object-contain"
                    unoptimized // Important for external URLs and data URIs
                />
            </div>
        </div>
    );
};
