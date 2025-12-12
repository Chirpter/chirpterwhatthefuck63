

"use client";

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/icons';

interface LanguageSettingsProps {
  isBilingual: boolean;
  onIsBilingualChange: (checked: boolean) => void;
  isPhraseMode: boolean;
  onIsPhraseModeChange: (checked: boolean) => void;
  primaryLanguage: string;
  onPrimaryLangChange: (value: string) => void;
  secondaryLanguage?: string;
  onSecondaryLangChange: (value: string) => void;
  availableLanguages: { value: string; label: string }[];
  isDisabled: boolean;
  idPrefix: 'book' | 'piece';
}

export const CreationLanguageSettings: React.FC<LanguageSettingsProps> = ({
  isBilingual,
  onIsBilingualChange,
  isPhraseMode,
  onIsPhraseModeChange,
  primaryLanguage,
  onPrimaryLangChange,
  secondaryLanguage,
  onSecondaryLangChange,
  availableLanguages,
  isDisabled,
  idPrefix,
}) => {
  const { t } = useTranslation('createPage');

  const availableSecondaryLanguages = availableLanguages.filter(lang => lang.value !== primaryLanguage);

  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <div>
        <Label className="font-body text-base font-medium flex items-center">
          <Icon name="Languages" className="h-5 w-5 mr-2 text-primary" />
          {t('languageSettings.title')}
        </Label>
        <div className="flex items-center space-x-2 mt-2">
          <Switch id={`${idPrefix}IsBilingual`} checked={isBilingual} onCheckedChange={onIsBilingualChange} disabled={isDisabled} />
          <Label htmlFor={`${idPrefix}IsBilingual`} className="font-body">{t('languageSettings.bilingualSwitch')}</Label>
        </div>
      </div>
      
       {isBilingual && (
        <div className="space-y-2 pt-2">
            <Label className="font-body">{t('languageSettings.bilingualFormatTitle')}</Label>
            <RadioGroup
                value={isPhraseMode ? 'phrase' : 'sentence'}
                onValueChange={(value) => onIsPhraseModeChange(value === 'phrase')}
                className="grid grid-cols-2 gap-3"
            >
                <Label
                    htmlFor={`${idPrefix}-sentence`}
                    className={cn(
                        "p-3 border rounded-lg transition-all flex items-center gap-3",
                        !isPhraseMode ? "ring-2 ring-primary border-primary bg-primary/10" : "border-border",
                        isDisabled ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:border-primary/50"
                    )}
                >
                    <RadioGroupItem value="sentence" id={`${idPrefix}-sentence`} disabled={isDisabled} />
                    <div>
                        <div className="font-medium font-body">{t('languageSettings.sentenceFormat')}</div>
                        <p className="text-xs text-muted-foreground">{t('languageSettings.sentenceFormatDesc')}</p>
                    </div>
                </Label>
                <Label
                    htmlFor={`${idPrefix}-phrase`}
                    className={cn(
                        "p-3 border rounded-lg transition-all flex items-center gap-3",
                        isPhraseMode ? "ring-2 ring-primary border-primary bg-primary/10" : "border-border",
                        isDisabled ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:border-primary/50"
                    )}
                >
                    <RadioGroupItem value="phrase" id={`${idPrefix}-phrase`} disabled={isDisabled} />
                    <div>
                        <div className="font-medium font-body">{t('languageSettings.phraseFormat')}</div>
                        <p className="text-xs text-muted-foreground">{t('languageSettings.phraseFormatDesc')}</p>
                    </div>
                </Label>
            </RadioGroup>
        </div>
       )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor={`${idPrefix}PrimaryLanguage`} className="font-body flex items-center">{t('languageSettings.primaryLabel')} <span className="text-destructive ml-1">*</span></Label>
          <Select onValueChange={onPrimaryLangChange} value={primaryLanguage} disabled={isDisabled}>
            <SelectTrigger id={`${idPrefix}PrimaryLanguage`} className="font-body"><SelectValue placeholder={t('languageSettings.selectLanguagePlaceholder')} /></SelectTrigger>
            <SelectContent className="font-body">
              {availableLanguages.map(lang => <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {isBilingual && (
          <div>
            <Label htmlFor={`${idPrefix}SecondaryLanguage`} className="font-body flex items-center">{t('languageSettings.secondaryLabel')} <span className="text-destructive ml-1">*</span></Label>
            <Select onValueChange={onSecondaryLangChange} value={secondaryLanguage} disabled={isDisabled}>
              <SelectTrigger id={`${idPrefix}SecondaryLanguage`} className="font-body"><SelectValue placeholder={t('languageSettings.selectLanguagePlaceholder')} /></SelectTrigger>
              <SelectContent className="font-body">
                {availableSecondaryLanguages.map(lang => <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  );
};
