// src/features/user/components/LanguageSurveyDialog.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Icon } from '@/components/ui/icons';
import { LANGUAGES } from '@/lib/constants';
import { useUser } from '@/contexts/user-context';
import { useToast } from '@/hooks/useToast';
import { updateUserProfile } from '@/services/server/user-service';

export default function LanguageSurveyDialog() {
  const { t, i18n } = useTranslation(['settingsPage', 'common']);
  const { user, reloadUser } = useUser();
  const { toast } = useToast();
  
  const [isOpen, setIsOpen] = useState(false);
  const [primaryLanguage, setPrimaryLanguage] = useState(i18n.language.split('-')[0] || 'en');
  const [secondaryLanguage, setSecondaryLanguage] = useState('none');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Open the dialog after a short delay to ensure UI is ready
    const timer = setTimeout(() => {
        if (user && !user.hasCompletedLanguageSurvey) {
            setIsOpen(true);
        }
    }, 1500);

    return () => clearTimeout(timer);
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await updateUserProfile(user.uid, {
        primaryLanguage,
        secondaryLanguage: secondaryLanguage === 'none' ? undefined : secondaryLanguage,
        hasCompletedLanguageSurvey: true,
      });
      await reloadUser();
      setIsOpen(false);
      toast({ title: t('common:success'), description: t('saveSuccessToast') });
    } catch (error) {
      toast({ title: t('common:error'), description: (error as Error).message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isSaving && setIsOpen(open)}>
      <DialogContent className="font-body sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-headline-1">{t('languageSurvey.title')}</DialogTitle>
          <DialogDescription className="text-body-base">
            {t('languageSurvey.description')}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="survey-primary-lang">{t('languageSurvey.primaryLabel')}</Label>
            <Select value={primaryLanguage} onValueChange={setPrimaryLanguage}>
              <SelectTrigger id="survey-primary-lang">
                <SelectValue placeholder={t('languageSettings.selectPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map(lang => (
                  <SelectItem key={lang.value} value={lang.value}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
             <p className="text-xs text-muted-foreground">{t('languageSurvey.primaryHint')}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="survey-secondary-lang">{t('languageSurvey.secondaryLabel')}</Label>
             <Select value={secondaryLanguage} onValueChange={setSecondaryLanguage}>
              <SelectTrigger id="survey-secondary-lang">
                <SelectValue placeholder={t('languageSettings.selectPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                  <SelectItem value="none">{t('languageSettings.noneOption')}</SelectItem>
                  {LANGUAGES.filter(l => l.value !== primaryLanguage).map(lang => (
                      <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                      </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t('languageSurvey.secondaryHint')}</p>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Icon name="Loader2" className="mr-2 h-4 w-4 animate-spin" />}
            {t('common:save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
