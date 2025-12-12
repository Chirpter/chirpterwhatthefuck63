// src/features/create/components/TagManager.tsx
"use client";

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface TagManagerProps {
  onTagClick: (tag: string) => void;
  customTagInput: string;
  onCustomTagChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCustomTagAdd: () => void;
}

export const TagManager: React.FC<TagManagerProps> = ({ 
    onTagClick,
    customTagInput,
    onCustomTagChange,
    onCustomTagAdd
}) => {
  const { t } = useTranslation('presets');

  const defaultTags = ['fantasy', 'horror', 'sci-fi', 'romance', 'adventure', 'history'];

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onCustomTagAdd();
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {defaultTags.map((tag) => (
        <Button
          key={tag}
          type="button"
          variant="outline"
          size="sm"
          className="font-body text-xs"
          onClick={() => onTagClick(tag)}
        >
          {tag}
        </Button>
      ))}
      <div className="flex items-center gap-1 border border-input rounded-md pl-2 bg-background">
          <Input 
            value={customTagInput}
            onChange={onCustomTagChange}
            onKeyDown={handleKeyDown}
            placeholder="custom-tag"
            className="h-7 p-0 text-xs border-0 focus-visible:ring-0 focus-visible:ring-offset-0 w-24"
          />
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={onCustomTagAdd}>
            <Icon name="Plus" className="h-4 w-4" />
          </Button>
      </div>
    </div>
  );
};
