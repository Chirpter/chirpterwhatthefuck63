

"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { getSrsStateCounts, getFoldersBySrsState } from '@/services/client/vocabulary-service';
import type { VocabularyItem, SrsState } from '@/lib/types';
import { useToast } from '@/hooks/useToast';
import { useLiveQuery } from 'dexie-react-hooks';


interface useStudyDecksProps {
    selectedSrsState: SrsState;
}

export const useStudyDecks = ({ selectedSrsState }: useStudyDecksProps) => {
    const { user } = useAuth();
    const { toast } = useToast();

    // Use a single live query to get all data needed for this view.
    // This is efficient as it reads from IndexedDB once and recalculates derivatives.
    const allData = useLiveQuery(
        async () => {
            if (!user) return { srsCounts: { new: 0, learning: 0, 'short-term': 0, 'long-term': 0 }, folders: [] };

            try {
                const srsCounts = await getSrsStateCounts(user.uid);
                const folders = await getFoldersBySrsState(user.uid, selectedSrsState);
                return { srsCounts, folders };
            } catch (error) {
                console.error("Failed to fetch study deck data:", error);
                toast({ title: "Error", description: "Could not load study decks.", variant: "destructive" });
                return { srsCounts: { new: 0, learning: 0, 'short-term': 0, 'long-term': 0 }, folders: [] };
            }
        },
        [user?.uid, selectedSrsState], // Dependencies
        { srsCounts: { new: 0, learning: 0, 'short-term': 0, 'long-term': 0 }, folders: [] } // Initial value
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
