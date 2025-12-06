// src/features/diary/components/DiaryCanvas.tsx

'use client';

import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { FlipBookWrapper } from './FlipBookWrapper';
import { useMobile } from '@/hooks/useMobile';
import { diaryEventManager } from '../foundation/event-manager';
import type { DiaryEntry } from '../types';
import type { FoundationContainer } from '../foundation/foundation-container';
import { cn } from '@/lib/utils';

interface DiaryCanvasProps {
    entries: (DiaryEntry | null)[];
    pageSize: { width: number, height: number };
    foundation: FoundationContainer;
    onPageFlip: (pageNumber: number) => void;
    setPageSize: (size: { width: number, height: number }) => void;
    currentPage: number;
    onAddPage: () => void;
    lastInteractedPageId: string | null;
    setLastInteractedPageId: (id: string | null) => void;
    isViewMode: boolean; // Prop received from parent
    visiblePageIds: string[]; // Added prop
}

export const DiaryCanvas: React.FC<DiaryCanvasProps> = ({
    entries,
    pageSize,
    foundation,
    onPageFlip,
    setPageSize,
    currentPage,
    onAddPage,
    lastInteractedPageId,
    setLastInteractedPageId,
    isViewMode,
    visiblePageIds, // Destructure the new prop
}) => {
    const flipBookRef = useRef<any>(null);
    const isMobile = useMobile();
    const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([]);
    const canvasContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setSelectedObjectIds(foundation.stateMachine.getContext().selectedObjectIds || []);

        const handleSelectionChange = (detail: { to: string[] }) => {
            setSelectedObjectIds(detail.to || []);
        };
        const unsubscribeSelection = diaryEventManager.addEventListener('selection:changed', handleSelectionChange);
        
        return () => {
            unsubscribeSelection();
        };
    }, [foundation]);

    const updatePageSize = useCallback(() => {
        if (!flipBookRef.current) return;
        const pageFlipInstance = flipBookRef.current.pageFlip();
        if (!pageFlipInstance) return;
        
        const container = pageFlipInstance.wrapper;
        if (container) {
             const newWidth = container.clientWidth / (isMobile ? 1 : 2);
             const newHeight = container.clientHeight;
             setPageSize({ width: newWidth, height: newHeight });
        }
    }, [setPageSize, isMobile]);


    useEffect(() => {
        const timer = setTimeout(updatePageSize, 100);
        window.addEventListener('resize', updatePageSize);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', updatePageSize);
        }
    }, [updatePageSize]);
    
    const handleFlip = useCallback((e: any) => {
        const currentSpreadIndex = Math.floor(e.data / 2);
        onPageFlip(currentSpreadIndex);
    }, [onPageFlip]);

    const handleNavigateToDate = useCallback((date: Date) => {
        const dateString = date.toISOString().split('T')[0];
        const entryIndex = entries.findIndex(e => e?.date === dateString);
        if (entryIndex !== -1 && flipBookRef.current) {
            const pageNumber = entryIndex; // entryIndex is already the page number
            flipBookRef.current.pageFlip().turnToPage(pageNumber);
        }
    }, [entries]);
    
    const entriesForBook = useMemo(() => {
        return entries.slice(1).filter((entry): entry is DiaryEntry => entry !== null);
    }, [entries]);
    
    // Enhanced keyboard handler for deletion and other shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isViewMode) return; // No shortcuts in view mode

            const selectedIds = foundation.stateMachine.getContext().selectedObjectIds;
            const isInteracting = foundation.stateMachine.isInteracting();
            const isEditingContent = foundation.stateMachine.getCurrentState() === 'editing_content';

            // Handle DELETE/BACKSPACE for object deletion
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0 && !isEditingContent) {
                
                // Trigger deletion for all selected objects
                selectedIds.forEach(objectId => {
                    // The onDelete prop from useDiaryFoundation will handle both
                    // local state removal and database deletion.
                    if (foundation.handleObjectDelete) {
                        foundation.handleObjectDelete(objectId, {});
                    }
                });
                
                // Clear selection after deletion
                foundation.stateMachine.selectObjects([]);
                
                e.preventDefault();
                e.stopPropagation();
                return;
            }

            // Handle ESC for canceling interactions
            if (e.key === 'Escape') {
                if (selectedIds.length > 0 || isInteracting) {
                    
                    // End any active interaction first
                    if (isInteracting && foundation.stateMachine.can('END_INTERACTION')) {
                        foundation.stateMachine.trigger('END_INTERACTION');
                    }
                    
                    // Clear selection
                    if (selectedIds.length > 0) {
                        foundation.stateMachine.selectObjects([]);
                    }
                    
                    e.preventDefault();
                    e.stopPropagation();
                }
            }

            // Handle Ctrl+A for select all (optional)
            if (e.ctrlKey && e.key === 'a' && !isEditingContent) {
                // Determine the current page(s) in view
                const visiblePageEntries = entries.filter(entry => entry && visiblePageIds.includes(entry.id!.toString()));

                if (visiblePageEntries.length > 0) {
                    const allObjectIds = visiblePageEntries.flatMap(entry => entry?.objects.map(obj => obj.id) || []);
                    
                    if (allObjectIds.length > 0) {
                        foundation.stateMachine.selectObjects(allObjectIds);
                        e.preventDefault();
                        e.stopPropagation();
                    }
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isViewMode, foundation, currentPage, entries, visiblePageIds]);

    // Fallback deselection handler (simplified)
    const handleCanvasPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        // Only handle if clicking directly on the canvas container (not on FlipBookWrapper)
        if (isViewMode || e.target !== canvasContainerRef.current) return;

        const hasSelectedObjects = foundation.stateMachine.getContext().selectedObjectIds.length > 0;
        
        if (hasSelectedObjects) {
            
            // End any active interaction
            if (foundation.stateMachine.isInteracting()) {
                if (foundation.stateMachine.can('END_INTERACTION')) {
                    foundation.stateMachine.trigger('END_INTERACTION');
                }
            }
            
            // Clear selection
            foundation.stateMachine.selectObjects([]);
        }
    }, [isViewMode, foundation]);


    return (
        <div
            ref={canvasContainerRef}
            className={cn(
                "relative group w-full h-full flex items-center justify-center transition-all p-4"
            )}
            onPointerDown={handleCanvasPointerDown} // Add fallback deselection
            tabIndex={-1} // Make it focusable for keyboard events
        >
            <FlipBookWrapper
                key={`flipbook-${isViewMode}`}
                isViewMode={isViewMode}
                width={pageSize.width}
                height={pageSize.height}
                currentPage={currentPage}
                onFlip={handleFlip}
                ref={flipBookRef}
                entriesForBook={entriesForBook}
                allEntries={entries}
                onNavigateToDate={handleNavigateToDate}
                pageSize={pageSize}
                foundation={foundation}
                selectedObjectIds={selectedObjectIds}
                onAddPage={onAddPage}
                lastInteractedPageId={lastInteractedPageId}
            />

            {/* Debug info for selected objects (optional - remove in production) */}
            {!isViewMode && selectedObjectIds.length > 0 && (
                <div className="absolute top-4 right-4 bg-black/80 text-white text-xs p-2 rounded pointer-events-none">
                    Selected: {selectedObjectIds.length} object(s)
                    <br />
                    Press DELETE to remove
                </div>
            )}
        </div>
    );
};
