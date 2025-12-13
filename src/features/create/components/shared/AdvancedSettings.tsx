// src/features/create/components/shared/AdvancedSettings.tsx

"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Label } from "@/components/ui/label";
import { Icon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { BOOK_LENGTH_OPTIONS } from "@/lib/constants";
import type { BookLengthOptionValue } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CreditIcon } from "@/components/ui/CreditIcon";

interface AdvancedSettingsProps {
  bookLength: BookLengthOptionValue;
  onBookLengthChange: (value: BookLengthOptionValue) => void;
  targetChapterCount: number;
  onTargetChapterCountChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onTargetChapterCountBlur: (event: React.FocusEvent<HTMLInputElement>) => void;
  generationScope: 'firstFew' | 'full';
  onGenerationScopeChange: (value: 'firstFew' | 'full') => void;
  isDisabled: boolean;
  minChapters: number;
  maxChapters: number;
}

const ScopeSelectionButton: React.FC<{
  value: 'firstFew' | 'full';
  title: string;
  description: string;
  isSelected: boolean;
  onClick: () => void;
  disabled?: boolean;
  creditCost: number;
}> = ({ value, title, description, isSelected, onClick, disabled, creditCost }) => (
    <div
        onClick={disabled ? undefined : onClick}
        className={cn(
            "p-3 border rounded-lg transition-all relative",
            isSelected
                ? "ring-2 ring-primary border-primary bg-primary/10"
                : "border-border",
            !disabled
                ? "cursor-pointer hover:border-primary/50 hover:bg-muted"
                : "cursor-not-allowed opacity-70"
        )}
    >
        <Badge className="absolute -top-2 -right-2 bg-secondary text-secondary-foreground">
            {creditCost} <CreditIcon className="ml-1 h-3 w-3 text-primary" />
        </Badge>
        <div className="font-medium font-body">{title}</div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
    </div>
);

const BookLengthSelectionButton: React.FC<{
  option: typeof BOOK_LENGTH_OPTIONS[number];
  isSelected: boolean;
  onClick: () => void;
  disabled?: boolean;
  t: (key: string) => string;
}> = ({ option, isSelected, onClick, disabled, t }) => {
    
    const getCreditCostText = () => {
        switch(option.value) {
            case 'short-story': return "1";
            case 'mini-book': return "2";
            case 'standard-book': return "2/8";
            case 'long-book': return "15";
            default: return "0";
        }
    }

    return (
        <div
            onClick={disabled ? undefined : onClick}
            className={cn(
                "p-3 border rounded-lg transition-all relative",
                isSelected
                    ? "ring-2 ring-primary border-primary bg-primary/10"
                    : "border-border",
                !disabled
                    ? "cursor-pointer hover:border-primary/50 hover:bg-muted"
                    : "cursor-not-allowed opacity-70"
            )}
        >
             <Badge className="absolute -top-2 -right-2 bg-secondary text-secondary-foreground">
                {getCreditCostText()} <CreditIcon className="ml-1 h-3 w-3 text-primary" />
            </Badge>
            <div className="font-medium font-body">{t(`advancedSettings.bookLength.${option.value}`)} {option.disabled ? `(${t('common:comingSoon')})` : ''}</div>
            <p className="text-xs text-muted-foreground mt-1">{t(`advancedSettings.bookLength.${option.value}Description`)}</p>
        </div>
    )
};


export const AdvancedSettings: React.FC<AdvancedSettingsProps> = ({
  bookLength,
  onBookLengthChange,
  targetChapterCount,
  onTargetChapterCountChange,
  onTargetChapterCountBlur,
  generationScope,
  onGenerationScopeChange,
  isDisabled,
  minChapters,
  maxChapters,
}) => {
  const { t } = useTranslation(['createPage', 'common']);
  
  const isStandardBook = bookLength === 'standard-book' || bookLength === 'long-book';

  return (
    <Accordion type="single" collapsible className="w-full border rounded-lg p-0">
      <AccordionItem value="advanced-settings" className="border-b-0">
        <AccordionTrigger className="px-4 py-3 hover:no-underline text-base font-medium">
          <div className="flex items-center">
            <Icon name="Settings" className="h-5 w-5 mr-2 text-primary" />
            {t('advancedSettings.title')}
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pt-2 pb-4 space-y-6">
          <div className="space-y-4">
            <Label className="font-body text-base font-medium">{t('advancedSettings.bookLengthTitle')}</Label>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {BOOK_LENGTH_OPTIONS.map((option) => (
                    <BookLengthSelectionButton
                        key={option.value}
                        option={option}
                        isSelected={bookLength === option.value}
                        onClick={() => onBookLengthChange(option.value)}
                        disabled={isDisabled || option.disabled}
                        t={t}
                    />
                ))}
            </div>
          </div>
          
          <div className="space-y-2 pt-4 border-t">
              <Label htmlFor="targetChapterCount" className="font-body text-base font-medium">{t('advancedSettings.chapterCountLabel')}</Label>
              <Input
                id="targetChapterCount"
                name="targetChapterCount"
                type="number"
                value={targetChapterCount === 0 ? '' : targetChapterCount} // Show empty string if 0
                onChange={onTargetChapterCountChange}
                onBlur={onTargetChapterCountBlur}
                disabled={isDisabled}
                min={minChapters}
                max={maxChapters}
                placeholder={BOOK_LENGTH_OPTIONS.find(opt => opt.value === bookLength)?.defaultChapters.toString()}
              />
          </div>

          {(bookLength === 'standard-book' || bookLength === 'long-book') && (
            <div className="space-y-3 pt-4 border-t">
                <Label className="font-body text-base font-medium">{t('advancedSettings.generationScopeTitle')}</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <ScopeSelectionButton
                        value="firstFew"
                        title={t('advancedSettings.scopeFirstFew')}
                        description={t('advancedSettings.scopeFirstFewDesc')}
                        isSelected={generationScope === 'firstFew'}
                        onClick={() => onGenerationScopeChange('firstFew')}
                        disabled={isDisabled}
                        creditCost={2}
                    />
                    <ScopeSelectionButton
                        value="full"
                        title={t('advancedSettings.scopeFull')}
                        description={t('advancedSettings.scopeFullDesc')}
                        isSelected={generationScope === 'full'}
                        onClick={() => onGenerationScopeChange('full')}
                        disabled={isDisabled}
                        creditCost={8}
                    />
                </div>
            </div>
          )}

        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};
