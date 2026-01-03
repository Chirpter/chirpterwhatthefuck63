// src/features/learning/components/vocab-videos/ContextSentences.tsx

"use client";

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { useUser } from '@/contexts/user-context';
import { translateText } from '@/services/ai/flows/translate-text.flow';

interface ContextSentencesProps {
  context: string;
  searchTerm: string;
  currentSentence: string;
}

export const ContextSentences: React.FC<ContextSentencesProps> = ({
  context,
  searchTerm,
  currentSentence,
}) => {
  const { user } = useUser();
  const [translation, setTranslation] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  
  // Clear translation when the context sentence changes
  useEffect(() => {
    setTranslation(null);
    setIsTranslating(false);
  }, [context, currentSentence]);

  const handleTranslate = useCallback(async () => {
    const textToTranslate = context || currentSentence;
    if (!textToTranslate || !user?.primaryLanguage) return;

    setIsTranslating(true);
    try {
      const result = await translateText({
        text: textToTranslate,
        targetLanguage: user.primaryLanguage,
        sourceLanguage: 'en', // Assuming source is English for now
      });
      setTranslation(result.translation);
    } catch (error) {
      console.error("Translation failed:", error);
      setTranslation("Translation failed.");
    } finally {
      setIsTranslating(false);
    }
  }, [context, currentSentence, user?.primaryLanguage]);

  const highlightedContent = useMemo(() => {
    const textToHighlight = context || currentSentence;
    if (!textToHighlight) {
      return null;
    }
    if (!searchTerm.trim()) {
      return <span>{textToHighlight}</span>;
    }

    const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(\\b${escapedSearchTerm}\\b)`, 'gi');
    const parts = textToHighlight.split(regex);

    return (
      <>
        {parts.map((part, index) =>
          regex.test(part) ? (
            <mark 
              key={index} 
              className="bg-primary/20 text-primary font-medium px-0.5 rounded border border-primary/30"
            >
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  }, [context, searchTerm, currentSentence]);

  return (
    <div className="space-y-2">
      <p className="text-body-sm break-words select-text">
        {highlightedContent}
      </p>
      
      <div className="flex items-center gap-2">
         {user?.primaryLanguage && user.primaryLanguage !== 'en' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleTranslate}
              disabled={isTranslating}
              className="h-7 text-xs text-muted-foreground hover:text-primary"
            >
              {isTranslating ? (
                <Icon name="Loader2" className="mr-2 h-3 w-3 animate-spin" />
              ) : (
                <Icon name="Languages" className="mr-2 h-3 w-3" />
              )}
              Translate to {user.primaryLanguage.toUpperCase()}
            </Button>
         )}
      </div>

      {translation && (
        <div className="border-t border-dashed pt-2">
          <p className="text-body-sm text-primary">{translation}</p>
        </div>
      )}
    </div>
  );
};
