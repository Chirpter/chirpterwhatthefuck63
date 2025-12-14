// src/features/create/components/shared/PresentationStyleSelector.tsx

"use client";
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { Icon, type IconName } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import type { Piece } from '@/lib/types';

interface StyleOption {
  value: 'doc' | 'card';
  labelKey: string;
  icon: IconName;
}

const aspectRatioOptions: ('1:1' | '3:4' | '4:3')[] = ['1:1', '3:4', '4:3'];
const aspectRatioIcons: Record<'1:1' | '3:4' | '4:3', IconName> = {
  '1:1': 'Square',
  '3:4': 'RectangleVertical',
  '4:3': 'RectangleHorizontal',
};

interface PresentationStyleSelectorProps {
  presentationStyle: 'doc' | 'card';
  aspectRatio: '1:1' | '3:4' | '4:3';
  onPresentationStyleChange: (style: 'doc' | 'card') => void;
  onAspectRatioChange: (aspectRatio: '1:1' | '3:4' | '4:3') => void;
  disabled?: boolean;
}

export const PresentationStyleSelector: React.FC<PresentationStyleSelectorProps> = ({
  presentationStyle,
  aspectRatio,
  onPresentationStyleChange,
  onAspectRatioChange,
  disabled,
}) => {
  const { t } = useTranslation('createPage');

  const mainOptions: StyleOption[] = [
    { value: 'doc', labelKey: 'presentationStyle.document', icon: 'FileText' },
    { value: 'card', labelKey: 'presentationStyle.card', icon: 'LayoutDashboard' },
  ];

  return (
    <div className="space-y-3 p-4 border rounded-lg">
      <Label className="font-body text-base font-medium flex items-center">
        <Icon name="LayoutDashboard" className="h-5 w-5 mr-2 text-primary" /> {t('presentationStyle.title')}
      </Label>
      <div className="grid grid-cols-2 gap-3">
        {mainOptions.map(option => (
          <div
            key={option.value}
            onClick={() => !disabled && onPresentationStyleChange(option.value)}
            className={cn(
              "border rounded-lg p-3 flex flex-col items-center justify-center gap-2 text-center transition-all min-h-[90px]",
              presentationStyle === option.value
                ? "ring-2 ring-primary border-primary bg-primary/10"
                : "border-border",
              !disabled
                ? "cursor-pointer hover:border-primary/50 hover:bg-muted"
                : "cursor-not-allowed opacity-70"
            )}
          >
            <Icon name={option.icon} className="text-primary h-8 w-8" />
            <p className="text-xs font-medium font-body">{t(option.labelKey)}</p>
          </div>
        ))}
      </div>

      {presentationStyle === 'card' && (
        <div className="pt-3 border-t">
          <Label className="text-xs text-muted-foreground">{t('presentationStyle.aspectRatio')}</Label>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {aspectRatioOptions.map(ratio => (
              <div
                key={ratio}
                onClick={() => !disabled && onAspectRatioChange(ratio)}
                className={cn(
                  "border rounded-md p-2 flex flex-col items-center justify-center gap-1 text-center transition-all h-16",
                  aspectRatio === ratio
                    ? "ring-2 ring-primary border-primary bg-primary/10"
                    : "border-border",
                  !disabled
                    ? "cursor-pointer hover:border-primary/50 hover:bg-muted"
                    : "cursor-not-allowed opacity-70"
                )}
              >
                <Icon name={aspectRatioIcons[ratio]} className="h-5 text-primary/80" />
                <p className="text-xs font-mono font-medium">{ratio}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
