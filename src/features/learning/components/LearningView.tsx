
"use client";

import React from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { useSettings } from '@/contexts/settings-context';
import CreattieEmbed from './CreattieEmbed';

interface LearningTool {
  titleKey: string;
  href: string;
  customIconSrc: string;
  isEnabled: boolean;
}

export default function LearningView() {
  const { t } = useTranslation(['learningPage', 'settingsPage']);
  const { wordLookupEnabled, setWordLookupEnabled } = useSettings();

  const tools: LearningTool[] = [
    {
      titleKey: 'vocabVideos.title',
      href: '/learning/vocab-videos',
      customIconSrc: 'https://d1jj76g3lut4fe.cloudfront.net/saved_colors/133380/15ShDx8TaZWIREKq.json',
      isEnabled: true,
    },
    {
      titleKey: 'shadowing.title',
      href: '/learning/shadowing',
      customIconSrc: 'https://d1jj76g3lut4fe.cloudfront.net/saved_colors/133380/bTapTOzFBdhFETtw.json',
      isEnabled: true,
    },
  ];

  const renderToolCard = (tool: LearningTool) => {
    const cardContent = (
      <div
        className={cn(
            "group relative flex flex-col h-full rounded-lg overflow-hidden transition-all duration-300",
            !tool.isEnabled && "opacity-60 cursor-not-allowed"
        )}
      >
        <div className="absolute bottom-0 left-0 right-0 z-10 p-2">
            <div className="relative z-10 text-foreground dark:text-white drop-shadow-md text-center w-full bg-white/40 dark:bg-black/40 p-1 rounded-lg backdrop-blur-sm">
                <p className="text-sm font-semibold font-body truncate">{t(tool.titleKey)}</p>
            </div>
        </div>
        <div className="relative aspect-square w-full overflow-hidden bg-grid-gradient-red-yellow">
            <div className="absolute inset-0 transition-transform duration-500 ease-in-out group-hover:scale-105">
              <CreattieEmbed src={tool.customIconSrc} />
            </div>
        </div>
      </div>
    );

    if (tool.isEnabled) {
      return (
        <Link href={tool.href} className="block h-full">
          {cardContent}
        </Link>
      );
    }
    return <div className="h-full">{cardContent}</div>;
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-xl md:text-2xl font-headline font-semibold">{t('learningTools')}</h1>
            <p className="text-muted-foreground font-body mt-1">{t('learningToolsHint')}</p>
        </div>
        <Card className="p-3 w-full max-w-sm">
            <div className="flex items-center justify-between space-x-2">
                <div>
                    <Label htmlFor="wordLookup" className="font-body flex items-center gap-2 cursor-pointer font-semibold">
                        <Icon name="MousePointer2" className="h-5 w-5 text-primary" />
                        <span>
                            Enable <span className="bg-accent text-accent-foreground px-1 rounded-sm">Word</span> Lookup
                        </span>
                    </Label>
                    <p className="text-xs text-muted-foreground ml-7">{t('settingsPage:learningTools.wordLookupDescription')}</p>
                </div>
                <Switch
                    id="wordLookup"
                    checked={wordLookupEnabled}
                    onCheckedChange={setWordLookupEnabled}
                />
            </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {tools.map((tool) => (
          <div key={tool.titleKey}>
            {renderToolCard(tool)}
          </div>
        ))}
      </div>
    </div>
  );
};
