// src/features/create/components/shared/PresentationStyleSelector.tsx

"use client";
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { Icon, type IconName } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

interface StyleOption {
  value: string;
  labelKey: string;
  icon: IconName;
  iconWrapperClass?: string;
}

interface PresentationStyleSelectorProps {
  value: string; // A combined value like 'book', 'card_1_1'
  onValueChange: (style: string) => void;
  disabled?: boolean;
}

export const PresentationStyleSelector: React.FC<PresentationStyleSelectorProps> = ({ value, onValueChange, disabled }) => {
  const { t } = useTranslation('createPage');

  const options: StyleOption[] = [
    { value: 'book', labelKey: 'presentationStyle.book', icon: 'BookOpen' },
    { value: 'card_1_1', labelKey: 'presentationStyle.card1x1', icon: 'Square', iconWrapperClass: 'w-8 h-8' },
    { value: 'card_3_4', labelKey: 'presentationStyle.card3x4', icon: 'RectangleVertical', iconWrapperClass: 'w-6 h-8' },
    { value: 'card_4_3', labelKey: 'presentationStyle.card4x3', icon: 'RectangleHorizontal', iconWrapperClass: 'w-8 h-6' },
  ];

  return (
    <div className="space-y-3 p-4 border rounded-lg">
      <Label className="font-body text-base font-medium flex items-center">
        <Icon name="LayoutDashboard" className="h-5 w-5 mr-2 text-primary" /> {t('presentationStyle.title')}
      </Label>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {options.map(option => (
          <div
            key={option.value}
            onClick={() => !disabled && onValueChange(option.value)}
            className={cn(
              "border rounded-lg p-2 flex flex-col items-center justify-center gap-2 text-center transition-all min-h-[90px]",
              value === option.value
                ? "ring-2 ring-primary border-primary bg-primary/10"
                : "border-border",
              !disabled
                ? "cursor-pointer hover:border-primary/50 hover:bg-muted"
                : "cursor-not-allowed opacity-70"
            )}
          >
            <div className={cn("flex items-center justify-center", option.iconWrapperClass)}>
              <Icon name={option.icon} className="text-primary h-full w-full" />
            </div>
            <p className="text-xs font-medium font-body">{t(option.labelKey)}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
