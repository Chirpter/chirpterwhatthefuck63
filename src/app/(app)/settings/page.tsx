
"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icons';
import { useTranslation } from 'react-i18next';

export default function SettingsView() {
  const { t } = useTranslation(['settingsPage']);

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <h2 className="text-headline-1">{t('title')}</h2>

      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-headline-2 flex items-center"><Icon name="Settings" className="mr-2 h-6 w-6 text-primary" />{t('generalCardTitle')}</CardTitle>
            <CardDescription className="text-body-base">{t('generalCardDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <p>{t('moreSettingsComingSoon')}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
