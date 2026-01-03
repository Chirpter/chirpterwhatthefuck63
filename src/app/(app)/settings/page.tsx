// src/app/(app)/settings/page.tsx

"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Icon } from '@/components/ui/icons';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUser } from '@/contexts/user-context';
import { useToast } from '@/hooks/useToast';
import { updateUserProfile } from '@/services/server/user-service';
import { LANGUAGES } from '@/lib/constants';

export default function SettingsView() {
  const { t, i18n } = useTranslation(['settingsPage', 'common']);
  const { user, reloadUser } = useUser();
  const { toast } = useToast();
  
  const [primaryLanguage, setPrimaryLanguage] = useState(user?.primaryLanguage || 'en');
  const [secondaryLanguage, setSecondaryLanguage] = useState(user?.secondaryLanguage || 'none');
  const [isSaving, setIsSaving] = useState(false);
  
  useEffect(() => {
    if (user) {
      setPrimaryLanguage(user.primaryLanguage || 'en');
      setSecondaryLanguage(user.secondaryLanguage || 'none');
    }
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await updateUserProfile(user.uid, {
        primaryLanguage,
        secondaryLanguage: secondaryLanguage === 'none' ? undefined : secondaryLanguage,
      });
      // ✅ Also update the UI language immediately
      if (i18n.language !== primaryLanguage) {
        i18n.changeLanguage(primaryLanguage);
      }
      await reloadUser();
      toast({ title: t('common:success'), description: t('saveSuccessToast') });
    } catch (error) {
      toast({ title: t('common:error'), description: (error as Error).message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <h2 className="text-headline-1">{t('title')}</h2>

      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-headline-2 flex items-center">
              <Icon name="Languages" className="mr-2 h-6 w-6 text-primary" />
              {t('languageSettings.title')}
            </CardTitle>
            <CardDescription className="text-body-base">
              {t('languageSettings.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="primary-lang">{t('languageSettings.primaryLabel')}</Label>
              <Select value={primaryLanguage} onValueChange={setPrimaryLanguage}>
                <SelectTrigger id="primary-lang">
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="secondary-lang">{t('languageSettings.secondaryLabel')}</Label>
               <Select value={secondaryLanguage} onValueChange={setSecondaryLanguage}>
                <SelectTrigger id="secondary-lang">
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
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Icon name="Loader2" className="mr-2 h-4 w-4 animate-spin" />}
              {t('common:save')}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
