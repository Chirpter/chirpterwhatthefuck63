// src/features/create/components/TagManager.tsx
"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TagManagerProps {
  onTagClick: (tag: string) => void;
  selectedTags: string[];
}

export const TagManager: React.FC<TagManagerProps> = ({ 
    onTagClick,
    selectedTags
}) => {
  const defaultTags = ['fantasy', 'horror', 'sci-fi', 'romance', 'adventure', 'history'];
  const hasReachedLimit = selectedTags.length >= 3;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {defaultTags.map((tag) => {
        const isSelected = selectedTags.includes(tag);
        const isDisabled = hasReachedLimit && !isSelected;
        
        return (
          <Button
            key={tag}
            type="button"
            variant={isSelected ? 'default' : 'outline'}
            size="sm"
            className={cn(
              "font-body text-xs transition-all",
              isSelected ? "bg-primary text-primary-foreground" : "bg-transparent",
              isDisabled && "opacity-50 cursor-not-allowed"
            )}
            onClick={() => onTagClick(tag)}
            disabled={isDisabled}
          >
            {tag}
          </Button>
        );
      })}
    </div>
  );
};
