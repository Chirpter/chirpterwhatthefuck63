
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { getSrsStateCounts, getVocabularyItemsPaginated } from '@/services/client/vocabulary-service';
import type { VocabularyItem, SrsState } from '@/lib/types';
import { useToast } from '@/hooks/useToast';
import { useLiveQuery } from 'dexie-react-hooks';
import { FOLDER_CONSTANTS } from '../constants';


interface useStudyDecksProps {
    selectedSrsState: SrsState;
}

interface FolderWithCount {
    id: string;
    name: string;
    count: number;
}

export const useStudyDecks = ({ selectedSrsState }: useStudyDecksProps) => {
    const { user } = useUser();
    const { toast } = useToast();

    // Use a single live query to get all data needed for this view.
    // This is efficient as it reads from IndexedDB once and recalculates derivatives.
    const allData = useLiveQuery(
        async () => {
            if (!user) return { srsCounts: { new: 0, learning: 0, 'short-term': 0, 'long-term': 0 }, folders: [] };

            try {
                const srsCounts = await getSrsStateCounts(user.uid);
                
                // Fetch all items for the given SRS state to determine which folders are relevant
                const { items } = await getVocabularyItemsPaginated(user.uid, { srsState: selectedSrsState, limit: 1000 });
                
                const folderCountMap = new Map<string, number>();
                items.forEach(item => {
                    const folderId = item.folder || FOLDER_CONSTANTS.UNORGANIZED;
                    folderCountMap.set(folderId, (folderCountMap.get(folderId) || 0) + 1);
                });

                const folders: FolderWithCount[] = Array.from(folderCountMap.entries()).map(([id, count]) => ({
                    id,
                    name: id === FOLDER_CONSTANTS.UNORGANIZED ? 'Unorganized' : id,
                    count
                }));

                return { srsCounts, folders };

            } catch (error) {
                console.error("Failed to fetch study deck data:", error);
                toast({ title: "Error", description: "Could not load study decks.", variant: "destructive" });
                return { srsCounts: { new: 0, learning: 0, 'short-term': 0, 'long-term': 0 }, folders: [] };
            }
        },
        [user?.uid, selectedSrsState], // Dependencies
        undefined // Use undefined for initial loading state
    );
    
    // isLoading is true until the first result from the live query is available.
    const isLoading = allData === undefined;
    
    // The handleSessionEnd logic is now simplified. Since useLiveQuery is reactive,
    // any change to the database (like updating SRS items after a session) will automatically
    // trigger a re-fetch and re-render of this component and its children.
    useEffect(() => {
        const handleSessionEnd = () => {
            // No manual refetch needed. Dexie and useLiveQuery handle it.
        };

        document.addEventListener('flashcardSessionEnd', handleSessionEnd);
        return () => {
            document.removeEventListener('flashcardSessionEnd', handleSessionEnd);
        };
    }, []);

    return {
        isLoading,
        foldersToDisplay: allData?.folders || [],
        srsCounts: allData?.srsCounts || { new: 0, learning: 0, 'short-term': 0, 'long-term': 0 },
    };
};
