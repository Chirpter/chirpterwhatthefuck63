// src/features/create/components/CreationForm.tsx

"use client";

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Icon } from '@/components/ui/icons';
import { AdvancedSettings } from './shared/AdvancedSettings';
import { CreationLanguageSettings } from './shared/CreationLanguageSettings';
import { cn } from '@/lib/utils';
import { MAX_PROMPT_LENGTH } from '@/lib/constants';
import { CoverImageSettings } from './shared/CoverImageSettings';
import { BookGenerationAnimation } from '../components/BookGenerationAnimation';
import { PieceItemCardRenderer } from '@/features/library/components/PieceItemCardRenderer';
import { useMobile } from '@/hooks/useMobile';
import { PresentationStyleSelector } from './shared/PresentationStyleSelector';

interface CreationFormProps {
  job: any; // The entire hook result
  formId: string;
}

export const CreationForm: React.FC<CreationFormProps> = ({ job, formId }) => {
  const { t } = useTranslation(['createPage', 'presets']);
  const isMobile = useMobile();

  const {
    formData,
    handleInputChange,
    handleValueChange,
    handleFileChange,
    handleChapterCountBlur,
    handlePromptFocus,
    handleDisplayChange,
    handleAspectRatioChange,
    isPromptDefault,
    isBusy,
    promptError,
    jobData,
    finalizedId,
    handleViewResult,
    minChaptersForCurrentLength,
    maxChapters,
    reset,
    isProUser,
  } = job;
  
  const type = formData.type;
  
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
  
  const isBilingual = formData.availableLanguages.length > 1;
  const isPhraseMode = formData.unit === 'phrase';

  return (
    <>
      <form id={formId} onSubmit={job.handleSubmit} className="space-y-6">

        {mobilePreview}

        <div className="space-y-2 p-4 border rounded-lg bg-muted/50">
          <Label htmlFor="aiPrompt" className="font-body text-base font-medium flex items-center">
            <Icon name="Sparkles" className="h-5 w-5 mr-2 text-primary" />
            {type === 'book' ? t('aiPrompt.bookLabel') : t('aiPrompt.pieceLabel')}
            <span className="text-destructive ml-1">*</span>
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
            disabled={isBusy}
            maxLength={MAX_PROMPT_LENGTH}
          />
          <div className="text-right text-xs text-muted-foreground pt-1">
            {`${formData.aiPrompt.length} / ${MAX_PROMPT_LENGTH}`}
          </div>
          {promptError === 'empty' && (
            <p className="text-xs text-destructive">{t('formErrors.prompt.empty')}</p>
          )}
        </div>
        
        <CreationLanguageSettings
          isBilingual={isBilingual}
          onIsBilingualChange={(checked) => handleValueChange('isBilingual', checked)}
          isPhraseMode={isPhraseMode}
          onIsPhraseModeChange={(checked) => handleValueChange('isPhraseMode', checked)}
          primaryLanguage={formData.primaryLanguage}
          onPrimaryLangChange={(value) => handleValueChange('primaryLanguage', value)}
          secondaryLanguage={formData.availableLanguages[1]}
          onSecondaryLangChange={(value) => handleValueChange('secondaryLanguage', value)}
          availableLanguages={job.availableLanguages}
          isDisabled={isBusy}
          idPrefix={type}
        />

        {type === 'book' && (
          <CoverImageSettings
              coverImageOption={formData.coverImageOption}
              onCoverOptionChange={(value) => handleValueChange('coverImageOption', value)}
              coverImageFile={formData.coverImageFile}
              onCoverFileChange={handleFileChange}
              coverImageAiPrompt={formData.coverImageAiPrompt}
              onCoverAiPromptChange={handleInputChange}
              isDisabled={isBusy}
              isProUser={isProUser}
          />
        )}
        
        {type === 'piece' && (
            <PresentationStyleSelector
                display={formData.display}
                aspectRatio={formData.aspectRatio}
                onDisplayChange={handleDisplayChange}
                onAspectRatioChange={handleAspectRatioChange}
                disabled={isBusy}
            />
        )}

        {type === 'book' && (
          <AdvancedSettings
            bookLength={formData.bookLength}
            onBookLengthChange={(value) => handleValueChange('bookLength', value)}
            targetChapterCount={formData.targetChapterCount}
            onTargetChapterCountChange={handleInputChange}
            onTargetChapterCountBlur={handleChapterCountBlur}
            generationScope={formData.generationScope}
            onGenerationScopeChange={(value) => handleValueChange('generationScope', value)}
            isDisabled={isBusy}
            minChapters={minChaptersForCurrentLength}
            maxChapters={maxChapters}
          />
        )}
      </form>
    </>
  );
};
