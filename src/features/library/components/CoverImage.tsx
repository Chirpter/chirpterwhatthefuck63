// src/features/library/components/CoverImage.tsx

"use client";

import React from 'react';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui/icons';
import type { JobStatus, Cover } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface CoverImageProps {
  title: string;
  author?: string | null;
  coverStatus?: JobStatus;
  cover?: Cover;
  imageHint?: string;
  className?: string;
  onRegenerate?: () => void;
  isRetrying?: boolean;
  isPromptError?: boolean;
  retryCount?: number;
}

export default function CoverImage({
  title,
  author,
  coverStatus,
  cover,
  imageHint,
  className,
  onRegenerate,
  isRetrying = false,
  isPromptError = false,
  retryCount = 0,
}: CoverImageProps) {
  const { t } = useTranslation(['bookCard', 'common']);
  const coverUrl = cover?.url;

  const renderContent = () => {
    switch (coverStatus) {
      case 'processing':
        return (
          <div className="w-full h-full bg-gradient-to-br from-muted to-background flex flex-col items-center justify-center p-4 text-center">
            <Icon name="Wand2" className="h-10 w-10 text-primary animate-pulse mb-2" />
            <p className="text-xs font-semibold text-muted-foreground">{t('coverProcessing')}</p>
          </div>
        );
      case 'error':
        let buttonText: string;
        if (cover?.type === 'upload') {
            buttonText = t('retryUpload');
        } else if (isPromptError) {
            buttonText = t('fixAndRetryCover');
        } else {
            buttonText = t('common:retry');
        }

        return (
          <div className="w-full h-full bg-gradient-to-br from-destructive/20 to-background flex flex-col items-center justify-center p-4 text-center">
            <Icon name="AlertCircle" className="h-10 w-10 text-destructive mb-2" />
            <p className="text-xs font-semibold text-destructive mb-3">{t('coverError')}</p>
            {onRegenerate && (
                <Button variant="destructive" size="sm" onClick={onRegenerate} disabled={isRetrying || retryCount >= 3}>
                    {isRetrying ? <Icon name="Wand2" className="mr-2 h-4 w-4 animate-pulse" /> : <Icon name="RotateCw" className="mr-2 h-4 w-4" />}
                    {buttonText}
                    {cover?.type === 'ai' && !isPromptError && retryCount > 1 && ` (${retryCount}/3)`}
                </Button>
            )}
          </div>
        );
      case 'ready':
        if (coverUrl) {
          return (
            <Image
              src={coverUrl}
              alt={title}
              fill
              sizes="(max-width: 768px) 50vw, (max-width: 1200px) 20vw, 15vw"
              className="object-cover"
            />
          );
        }
        // Fallthrough to default if 'ready' but no URL (safe fallback)
      case 'ignored':
      default:
        // Default title-based fallback that mimics the 3D book's front cover
        return (
           <div className="front-cover w-full h-full prose-dynamic">
            <div className="text-center p-4">
                <h3 className="font-headline title">{title}</h3>
                {author && <p className="font-body author">{t('common:byAuthor', { author })}</p>}
                <div className="emblem">✨</div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className={cn("relative w-full h-full bg-muted", className)}>
        {renderContent()}
    </div>
  );
};
