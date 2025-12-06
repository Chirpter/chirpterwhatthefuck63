

"use client";

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Icon } from '@/components/ui/icons';
import { AdvancedSettings } from './shared/AdvancedSettings';
import { CreationLanguageSettings } from './shared/CreationLanguageSettings';
import { cn } from '@/lib/utils';
import { MAX_PROMPT_LENGTH, BOOK_TAG_SUGGESTIONS, PIECE_TAG_SUGGESTIONS } from '@/lib/constants';
import { CoverImageSettings } from './shared/CoverImageSettings';
import { BookGenerationAnimation } from '../components/BookGenerationAnimation';
import { PieceItemCardRenderer } from '@/features/library/components/PieceItemCardRenderer';
import { useMobile } from '@/hooks/useMobile';
import { PresentationStyleSelector } from './shared/PresentationStyleSelector';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';

interface TagSelectorProps {
  suggestedTags: string[];
  selectedTags: string[];
  onTagClick: (tag: string) => void;
  onCustomTagAdd: (tag: string) => void;
  maxTags: number;
}

const TagSelector: React.FC<TagSelectorProps> = ({ suggestedTags, selectedTags, onTagClick, onCustomTagAdd, maxTags }) => {
  const [customTag, setCustomTag] = useState('');
  const [popoverOpen, setPopoverOpen] = useState(false);

  const handleAddCustom = () => {
    // Sanitize the tag: lowercase, replace spaces with hyphens, remove special chars, trim length
    const sanitizedTag = customTag
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .substring(0, 15);
      
    if (sanitizedTag && !selectedTags.includes(sanitizedTag)) {
      onCustomTagAdd(sanitizedTag);
    }
    setCustomTag('');
    setPopoverOpen(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        {suggestedTags.map(tag => (
          <Button
            key={tag}
            type="button"
            variant={selectedTags.includes(tag) ? "secondary" : "outline"}
            size="sm"
            className="font-body text-xs"
            onClick={() => onTagClick(tag)}
            disabled={selectedTags.length >= maxTags && !selectedTags.includes(tag)}
          >
            {tag}
          </Button>
        ))}
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={selectedTags.length >= maxTags}
            >
              <Icon name="Plus" className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2">
            <div className="flex gap-2">
              <Input
                placeholder="New tag..."
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                className="h-8 text-xs"
                maxLength={15}
              />
              <Button size="sm" className="h-8" onClick={handleAddCustom} disabled={!customTag.trim()}>
                Add
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
       {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1 items-center text-sm">
          <span className="text-muted-foreground mr-2">Selected:</span>
          {selectedTags.map(tag => (
            <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => onTagClick(tag)}>
              {tag}
              <Icon name="X" className="ml-1 h-3 w-3" />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};


interface CreationFormProps {
  job: any; // The entire hook result
  formId: string;
  type: 'book' | 'piece';
}

export const CreationForm: React.FC<CreationFormProps> = ({ job, formId, type }) => {
  const { t } = useTranslation(['createPage', 'presets']);
  const isMobile = useMobile();

  const {
    formData,
    handleInputChange,
    handleValueChange,
    handleFileChange,
    handleChapterCountBlur,
    handlePromptFocus,
    handlePresentationStyleChange,
    isPromptDefault,
    mode,
    isLoadingExistingBook,
    isBusy,
    promptError,
    jobData,
    finalizedId,
    handleViewResult,
    minChaptersForCurrentLength,
    maxChapters,
    reset,
    isProUser,
    handleTagClick,
    handleCustomTagAdd,
  } = job;
  
  const mobilePreview = isMobile ? (
    <div className="my-4 min-h-[357px] flex items-center justify-center border-2 border-dashed border-border bg-background/50 p-4 rounded-lg">
        {type === 'book' ? (
            <BookGenerationAnimation
              isFormBusy={isBusy}
              bookJobData={jobData}
              finalizedBookId={finalizedId}
              bookFormData={formData}
              onViewBook={handleViewResult}
              onCreateAnother={() => reset(type)}
            />
        ) : (
           <PieceItemCardRenderer
              item={jobData}
              isPreview={false}
           />
        )}
    </div>
  ) : null;
  
  const presentationStyleValue = formData.presentationStyle === 'book'
    ? 'book'
    : `card_${(formData.aspectRatio || '3:4').replace(':', '_')}`;

  return (
    <>
      <form id={formId} onSubmit={job.handleSubmit} className="space-y-6">

        {mobilePreview}

        {type === 'book' && mode === 'addChapters' && (
          <div className="space-y-2 p-4 border rounded-lg">
            <Label htmlFor="previousContentSummary" className="font-body text-base font-medium flex items-center">
              <Icon name="MessageSquare" className="h-5 w-5 mr-2 text-primary" /> {t('addChapters.summaryLabel')}
            </Label>
            <Textarea
              id="previousContentSummary"
              placeholder={t('addChapters.summaryPlaceholder')}
              name="previousContentSummary"
              value={formData.previousContentSummary}
              onChange={handleInputChange}
              className="font-body"
              rows={4}
              disabled={true}
            />
            <Label htmlFor="targetChapterCount" className="font-body text-base font-medium flex items-center mt-2">
              <Icon name="ListChecks" className="h-5 w-5 mr-2 text-primary" /> {t('advancedSettings.chapterCountLabel')}
            </Label>
            <Input
              id="targetChapterCount"
              type="number"
              min="1"
              max="12"
              name="targetChapterCount"
              value={formData.targetChapterCount}
              onChange={handleInputChange}
              onBlur={handleChapterCountBlur}
              className="font-body"
              disabled={isLoadingExistingBook}
            />
          </div>
        )}

        <div className="space-y-2 p-4 border rounded-lg bg-muted/50">
          <Label htmlFor="aiPrompt" className="font-body text-base font-medium flex items-center">
            <Icon name="Sparkles" className="h-5 w-5 mr-2 text-primary" />
            {type === 'book' && mode === 'addChapters' ? t('aiPrompt.addChaptersBookLabel') : (type === 'book' ? t('aiPrompt.bookLabel') : t('aiPrompt.pieceLabel'))}
            {mode !== 'addChapters' && <span className="text-destructive ml-1">*</span>}
          </Label>
          <Textarea
            id="aiPrompt"
            name="aiPrompt"
            value={formData.aiPrompt}
            onChange={handleInputChange}
            onFocus={handlePromptFocus}
            className={cn(
              "font-body", 
              promptError && "border-destructive focus-visible:ring-destructive",
              isPromptDefault && "text-muted-foreground italic"
            )}
            rows={5}
            disabled={isLoadingExistingBook}
            maxLength={MAX_PROMPT_LENGTH}
          />
          <div className="text-right text-xs text-muted-foreground pt-1">
            {/* {`${formData.aiPrompt.length} / ${MAX_PROMPT_LENGTH}`} */}
          </div>
          <div className="pt-2">
              <TagSelector 
                suggestedTags={type === 'book' ? BOOK_TAG_SUGGESTIONS : PIECE_TAG_SUGGESTIONS} 
                selectedTags={formData.tags || []}
                onTagClick={handleTagClick}
                onCustomTagAdd={handleCustomTagAdd}
                maxTags={3}
              />
          </div>
          {promptError === 'empty' && (
            <p className="text-xs text-destructive">{t('formErrors.prompt.empty')}</p>
          )}
        </div>
        
        <CreationLanguageSettings
          isBilingual={formData.isBilingual}
          onBilingualChange={(checked) => handleValueChange('isBilingual', checked)}
          bilingualFormat={formData.bilingualFormat}
          onBilingualFormatChange={(value) => handleValueChange('bilingualFormat', value)}
          primaryLanguage={formData.primaryLanguage}
          onPrimaryLangChange={(value) => handleValueChange('primaryLanguage', value)}
          secondaryLanguage={formData.secondaryLanguage}
          onSecondaryLangChange={(value) => handleValueChange('secondaryLanguage', value)}
          availableLanguages={job.availableLanguages}
          isDisabled={isLoadingExistingBook || isBusy || (mode === 'addChapters' && !!formData.isBilingual)}
          idPrefix={type}
        />

        {type === 'book' && mode !== 'addChapters' && (
          <CoverImageSettings
              coverImageOption={formData.coverImageOption}
              onCoverOptionChange={(value) => handleValueChange('coverImageOption', value)}
              coverImageFile={formData.coverImageFile}
              onCoverFileChange={handleFileChange}
              coverImageAiPrompt={formData.coverImageAiPrompt}
              onCoverAiPromptChange={handleInputChange}
              isDisabled={isLoadingExistingBook || isBusy}
              isProUser={isProUser}
          />
        )}
        
        {type === 'piece' && (
            <PresentationStyleSelector
                value={presentationStyleValue}
                onValueChange={handlePresentationStyleChange}
                disabled={isBusy}
            />
        )}

        {type === 'book' && mode !== 'addChapters' && (
          <AdvancedSettings
            bookLength={formData.bookLength}
            onBookLengthChange={(value) => handleValueChange('bookLength', value)}
            targetChapterCount={formData.targetChapterCount}
            onTargetChapterCountChange={handleInputChange}
            onTargetChapterCountBlur={handleChapterCountBlur}
            generationScope={formData.generationScope}
            onGenerationScopeChange={(value) => handleValueChange('generationScope', value)}
            isDisabled={isLoadingExistingBook || isBusy}
            minChapters={minChaptersForCurrentLength}
            maxChapters={maxChapters}
          />
        )}
      </form>
    </>
  );
};
