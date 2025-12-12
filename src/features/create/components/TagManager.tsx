// src/features/create/components/TagManager.tsx
"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [isAdding, setIsAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const defaultTags = ['fantasy', 'horror', 'sci-fi', 'romance', 'adventure', 'history'];

  const handleCustomTagSubmit = () => {
    onCustomTagAdd();
    setIsAdding(false);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCustomTagSubmit();
    }
  };

  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAdding]);

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

      <AnimatePresence>
        {isAdding ? (
          <motion.div
            key="input"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 'auto', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="flex items-center"
          >
            <div className="flex items-center border border-input rounded-md pl-2 bg-background h-8">
                <Input 
                  ref={inputRef}
                  value={customTagInput}
                  onChange={onCustomTagChange}
                  onKeyDown={handleKeyDown}
                  onBlur={() => setIsAdding(false)}
                  placeholder="custom-tag"
                  className="h-full p-0 text-xs border-0 focus-visible:ring-0 focus-visible:ring-offset-0 w-24"
                />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="button"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-8"
              onClick={() => setIsAdding(true)}
              aria-label="Add custom tag"
            >
              <Icon name="Plus" className="h-4 w-4" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
