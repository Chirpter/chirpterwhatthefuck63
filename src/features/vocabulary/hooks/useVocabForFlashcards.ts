
"use client";

import { useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { getVocabularyItemsByFolderAndSrsState } from '@/services/client/vocabulary-service';
import type { VocabularyItem, SrsState } from '@/lib/types';
import { useToast } from '@/hooks/useToast';
import { useLiveQuery } from 'dexie-react-hooks';

export const useVocabForFlashcards = (folder: string | null, srsState: SrsState | null) => {
    const { user } = useAuth();
    const { toast } = useToast();
    
    const cards = useLiveQuery(
        async () => {
            if (!user || !folder || !srsState) return [];
            try {
                const items = await getVocabularyItemsByFolderAndSrsState(
                    user.uid, 
                    folder, 
                    srsState
                );
                return items;
            } catch (error) {
                console.error("Failed to load flashcards:", error);
                toast({ 
                    title: "Error", 
                    description: "Could not load the flashcard deck.", 
                    variant: "destructive" 
                });
                return [];
            }
        },
        [user?.uid, folder, srsState],
        []
    );

    const isLoading = cards === undefined;

    const refetch = useCallback(() => {
        // With useLiveQuery, refetch is automatic
    }, []);

    return { 
        cards: cards || [], 
        isLoading, 
        refetch 
    };
};
