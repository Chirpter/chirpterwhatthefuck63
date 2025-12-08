

"use client";

import React, { useState, useMemo, memo, useCallback } from 'react';
import type { VocabularyItem as VocabItemType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LEARNING_THRESHOLD_DAYS, MASTERED_THRESHOLD_DAYS } from "@/lib/constants";
import { calculateVirtualMS } from '@/lib/utils';
import type { SrsState } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { VideoSnippetPopover } from '@/features/learning/components/vocab-videos/VideoSnippetPopover';
import type { IconName } from '@/components/ui/icons';

interface VocabularyItemProps {
  item: VocabItemType;
  onPronounce: (term: string, lang?: string) => void;
  onEdit: (item: VocabItemType) => void;
  onDelete: (item: VocabItemType) => void;
  onRenameFolder?: (oldName: string, newName: string) => void; // Made optional
  isLite?: boolean;
}

const MemoryStrengthBar = memo<{ memoryStrength: number }>(({ memoryStrength }) => {
    const { t } = useTranslation(['vocabularyPage']);
    const MAX_DAYS = 31;

    // Determine current state based on memory strength
    const currentState: SrsState = useMemo(() => {
        if (memoryStrength >= MASTERED_THRESHOLD_DAYS) return 'long-term';
        if (memoryStrength >= LEARNING_THRESHOLD_DAYS) return 'short-term';
        if (memoryStrength > 0) return 'learning';
        return 'new';
    }, [memoryStrength]);

    // Gradient based on state
    const getProgressGradient = () => {
        if (currentState === 'new') {
            return 'bg-gradient-to-t from-slate-400 to-slate-500';
        }
        if (currentState === 'learning') {
            return 'bg-gradient-to-t from-slate-400 via-purple-400 to-purple-500';
        }
        if (currentState === 'short-term') {
            return 'bg-gradient-to-t from-slate-400 via-purple-400 to-pink-500';
        }
        // long-term
        return 'bg-gradient-to-t from-slate-400 via-purple-500 to-orange-400';
    };

    const fillHeightPercentage = Math.min((memoryStrength / MAX_DAYS) * 100, 100);

    return (
        <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-muted/30 rounded-l-lg overflow-hidden">
            <div
                className={`absolute bottom-0 left-0 w-full transition-all duration-500 ${'${getProgressGradient()}'}`}
                style={{ height: `${'${fillHeightPercentage}'}%` }}
            />
        </div>
    );
});
MemoryStrengthBar.displayName = 'MemoryStrengthBar';

const VocabularyItemCardComponent: React.FC<VocabularyItemProps> = ({ item, onPronounce, onEdit, onDelete, onRenameFolder, isLite = false }) => {
  const { t } = useTranslation(['vocabularyItemCard', 'common']);
  
  const virtualMs = useMemo(() => {
    return calculateVirtualMS(item, new Date());
  }, [item]); 
  
  const sourceInfo = useMemo(() => {
    if (item.sourceType === 'book' && !item.sourceDeleted && item.sourceId) {
      const link = item.chapterId && item.segmentId 
        ? `/read/${'${item.sourceId}'}?chapterId=${'${item.chapterId}'}&segmentId=${'${item.segmentId}'}`
        : `/read/${'${item.sourceId}'}`;
      return { icon: 'BookOpen' as IconName, link };
    }
    return { icon: null, link: null };
  }, [item]);
  
  const handlePronounceClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onPronounce(item.term, item.termLang);
  }, [item.term, item.termLang, onPronounce]);

  const handleEditClick = useCallback(() => {
    onEdit(item);
  }, [item, onEdit]);

  const handleDeleteClick = useCallback(() => {
    onDelete(item);
  }, [item, onDelete]);

  return (
    <>
    <Card className={cn("flex flex-col h-full border relative", isLite && "h-auto")}>
        {!isLite && <MemoryStrengthBar memoryStrength={virtualMs} />}
        <CardContent className={cn("p-3 flex flex-row gap-4 flex-grow", isLite ? "pl-2" : "pl-6")}>
            <div className={cn("flex-grow flex flex-col min-w-0", isLite ? 'pr-6' : 'pr-8')}>
                <div className="flex-grow">
                    <h3 className={cn("font-headline font-bold text-primary", isLite ? "text-base" : "text-xl")}>{item.term}</h3>
                    <p className={cn("font-body text-foreground/90", isLite ? "text-sm" : "")}>
                        {item.meaning}
                        {item.partOfSpeech && <span className={cn("ml-2 italic text-muted-foreground/80", isLite ? "text-xs" : "")}>({item.partOfSpeech})</span>}
                    </p>
                </div>
                
                {item.example && (
                    <div className={cn("mt-auto pt-3 border-t border-dashed my-2", isLite && "pt-1 my-1")}>
                        <p className={cn("font-body text-muted-foreground italic", isLite ? "text-xs" : "text-sm")}>
                            &ldquo;{item.example}&rdquo;
                        </p>
                    </div>
                )}
            </div>

            <div className="absolute top-2 right-2 flex items-center gap-0">
                 {sourceInfo.icon && !isLite && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" asChild>
                        <Link href={sourceInfo.link!} onClick={e => e.stopPropagation()} aria-label={t('goToSource')}>
                            <Icon name={sourceInfo.icon} className="h-4 w-4" />
                        </Link>
                    </Button>
                )}
                
                {!isLite && (
                  <VideoSnippetPopover term={item.term}>
                      <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 text-muted-foreground" 
                          onClick={e => e.stopPropagation()} 
                          aria-label={t('videoLookupLabel')}
                      >
                          <Icon name="Youtube" className="h-4 w-4" />
                      </Button>
                  </VideoSnippetPopover>
                )}

                 <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 text-muted-foreground" 
                    onClick={handlePronounceClick} 
                    aria-label={t('pronounceLabel')}
                >
                    <Icon name="Volume2" className="h-4 w-4" />
                </Button>
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={e => e.stopPropagation()}>
                            <Icon name="MoreVertical" className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="font-body" onClick={e => e.stopPropagation()}>
                        <DropdownMenuItem onClick={handleEditClick}>
                            <Icon name="Edit" className="mr-2 h-4 w-4" />
                            <span>{t('common:edit')}</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleDeleteClick} className="text-destructive focus:text-destructive-foreground">
                            <Icon name="Trash2" className="mr-2 h-4 w-4" />
                            <span>{t('common:delete')}</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </CardContent>
    </Card>
    </>
  );
};

export const VocabularyItemCard = React.memo(VocabularyItemCardComponent);
