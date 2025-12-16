// src/features/learning/components/vocab-videos/VideoSnippetPopover.tsx

"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useVocabVideosContext } from '../../contexts/VocabVideosContext';
import { VocabVideoPlayer, type VocabVideoPlayerHandle } from './VocabVideoPlayer';
import { ContextSentences } from './ContextSentences';

const VideoSnippetContent = ({ term }: { term: string }) => {
  const { t } = useTranslation(['learningPage', 'common']);
  const playerRef = useRef<VocabVideoPlayerHandle>(null);
  
  const { 
    clips, 
    selectedIndex, 
    isLoading, 
    error, 
    handleSearch, 
    handleNext, 
    handlePrevious, 
    handleVideoEnd,
    setIsAutoSkipping,
    clearSearch, // Use clearSearch to reset state
  } = useVocabVideosContext();

  const clip = useMemo(() => clips[selectedIndex] || null, [clips, selectedIndex]);

  // Search for term when component mounts
  useEffect(() => {
    if (term) {
      setIsAutoSkipping(true);
      handleSearch(term);
    }
    
    // Cleanup function to clear search state when popover closes
    return () => {
      clearSearch();
    };
  }, [term, handleSearch, setIsAutoSkipping, clearSearch]);

  // Play clip when it changes
  useEffect(() => {
    if (clip && playerRef.current) {
      playerRef.current.loadAndPlay(clip);
    }
  }, [clip]);

  return (
    <div className="bg-card rounded-lg shadow-2xl overflow-hidden w-[380px] border border-border">
      <div className="relative">
        <div className="aspect-video bg-black">
          {isLoading && !clip ? (
            <div className="w-full h-full flex items-center justify-center">
              <Icon name="Loader2" className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
              <Icon name="AlertCircle" className="h-10 w-10 mb-2 text-destructive" />
              <p className="text-sm text-destructive font-medium">{error}</p>
            </div>
          ) : (
            <VocabVideoPlayer
              ref={playerRef}
              onVideoEnd={handleVideoEnd}
            />
          )}
        </div>
      </div>
      
      {clip && (
        <div className="px-3 py-2 bg-muted/30 border-t border-border">
          <ContextSentences
            context={clip.text}
            searchTerm={term}
            currentSentence={clip.text}
          />
        </div>
      )}
      
      <div className="px-2 h-10 flex items-center justify-between bg-background border-t border-border relative">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8" 
                  onClick={handlePrevious} 
                  disabled={selectedIndex <= 0 || isLoading}
                >
                  <Icon name="ChevronLeft" className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{t('vocabClips.previousButton', { defaultValue: 'Previous' })}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

        <div className="absolute left-1/2 -translate-x-1/2">
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8" 
                    asChild
                  >
                    <Link 
                      href={`/learning/vocab-videos?q=${encodeURIComponent(term)}${clip ? `&videoId=${clip.videoId}&startTime=${clip.start}` : ''}`}
                    >
                      <Icon name="Maximize" className="h-4 w-4" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>{t('openInLearningEnvironment', { defaultValue: 'Open in Learning Environment' })}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
        </div>
        
        <div className="flex items-center gap-2">
           {clips.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground font-medium">
                {selectedIndex + 1} / {clips.length}
              </span>
            </div>
          )}
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8" 
                  onClick={handleNext} 
                  disabled={selectedIndex >= clips.length - 1 || isLoading}
                >
                  <Icon name="ChevronRight" className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{t('vocabClips.nextButton', { defaultValue: 'Next' })}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
};

export const VideoSnippetPopover: React.FC<{ term: string; children: React.ReactNode }> = ({ 
  term, 
  children 
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
        {children}
      </PopoverTrigger>
      <PopoverContent 
        className="w-auto p-0 border-0 shadow-none bg-transparent" 
        side="right" 
        align="start"
        sideOffset={8}
        onClick={(e) => e.stopPropagation()}
      >
        {isOpen && (
          <VideoSnippetContent term={term} />
        )}
      </PopoverContent>
    </Popover>
  );
};
