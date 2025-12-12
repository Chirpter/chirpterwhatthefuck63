// src/features/create/components/PromptSuggestions.tsx
"use client";

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';

interface PromptSuggestionsProps {
  onSelect: (prompt: string) => void;
}

export const PromptSuggestions: React.FC<PromptSuggestionsProps> = ({ onSelect }) => {
  const { t } = useTranslation('presets');

  const suggestions: { key: string, label: string }[] = [
    { key: 'bedtime_story', label: t('bedtime_story') },
    { key: 'life_lesson', label: t('life_lesson') },
    { key: 'kindness_story', label: t('kindness_story') },
    { key: 'fantasy_story', label: t('fantasy_story') },
    { key: 'fairy_tale', label: t('fairy_tale') },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {suggestions.map((suggestion) => (
        <Button
          key={suggestion.key}
          type="button"
          variant="outline"
          size="sm"
          className="font-body text-xs"
          onClick={() => onSelect(suggestion.label)}
        >
          {suggestion.label}
        </Button>
      ))}
    </div>
  );
};
