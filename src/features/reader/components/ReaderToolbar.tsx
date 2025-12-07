
"use client";

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icons';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import type { EditorSettings } from '@/lib/types';
import { LANGUAGES } from '@/lib/constants';


interface ReaderToolbarProps {
  settings: EditorSettings;
  onSettingsChange: (updates: Partial<EditorSettings>) => void;
  onClose: () => void;
  // --- Language Control Props ---
  availableLanguages: string[]; // e.g., ['en', 'vi', 'ko']
  displayLang1: string; // The selected primary display language code
  displayLang2: string; // The selected secondary display language code ('none' if monolingual)
  onDisplayLang1Change: (langCode: string) => void;
  onDisplayLang2Change: (langCode: string) => void;
  // FUTURE: onTranslateRequest: (targetLang: string) => void;
}

export const ReaderToolbar: React.FC<ReaderToolbarProps> = ({ 
  settings, 
  onSettingsChange, 
  onClose,
  availableLanguages,
  displayLang1,
  displayLang2,
  onDisplayLang1Change,
  onDisplayLang2Change,
}) => {
  const { t } = useTranslation('readerPage');
  
  const backgroundOptions = [
    { value: 'bg-background/95', label: 'Default', type: 'color', swatchClass: 'bg-background border' },
    { value: 'bg-reader-sepia', label: 'Sepia', type: 'color', swatchClass: 'bg-[#fbf0d9] border' },
    { value: 'bg-reader-slate', label: 'Slate', type: 'color', swatchClass: 'bg-[#1e293b] border' },
    { value: 'bg-reader-grain', label: 'Paper Grain', type: 'texture', icon: 'Grip' as IconName },
    { value: 'bg-reader-lined', label: 'Lined Paper', type: 'texture', icon: 'List' as IconName },
    { value: 'bg-reader-grid', label: 'Grid Paper', type: 'texture', icon: 'Grid' as IconName },
    { value: 'bg-reader-crumbled', label: 'Crumbled Paper', type: 'texture', icon: 'FileText' as IconName },
  ] as const;

  const colorOptions = backgroundOptions.filter(opt => opt.type === 'color');
  const textureOptions = backgroundOptions.filter(opt => opt.type === 'texture');

  const updateSetting = <K extends keyof EditorSettings>(key: K, value: EditorSettings[K]) => {
    onSettingsChange({ [key]: value });
  };

  const textAlignOptions: { value: EditorSettings['textAlign'], icon: IconName }[] = [
    { value: 'text-left', icon: 'AlignLeft' },
    { value: 'text-center', icon: 'AlignCenter' },
    { value: 'text-right', icon: 'AlignRight' },
    { value: 'text-justify', icon: 'AlignJustify' },
  ];

  const verticalAlignOptions: { value: EditorSettings['verticalAlign'], icon: IconName }[] = [
    { value: 'justify-start', icon: 'AlignVerticalJustifyStart' },
    { value: 'justify-center', icon: 'AlignVerticalJustifyCenter' },
    { value: 'justify-end', icon: 'AlignVerticalJustifyEnd' },
  ];

  const getLanguageLabel = (code: string | undefined): string => {
    if (!code || code === 'none') return t('viewModes.none');
    return LANGUAGES.find(l => l.value === code)?.label || code;
  };

  // Languages available for the secondary display slot
  const secondaryDisplayOptions = LANGUAGES.filter(lang => lang.value !== displayLang1);

  return (
    <div className="bg-background/90 border shadow-lg p-2 animate-in fade-in-0 slide-in-from-top-2 duration-300 rounded-lg">
      <TooltipProvider>
        <div className="flex items-center justify-center gap-1 md:gap-2">
           {availableLanguages.length > 0 && (
            <>
              {/* --- PRIMARY LANGUAGE DROPDOWN --- */}
              <DropdownMenu>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8">
                                {getLanguageLabel(displayLang1)}
                            </Button>
                        </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent><p>{t('mainLanguageTooltip')}</p></TooltipContent>
                </Tooltip>
                <DropdownMenuContent>
                    <DropdownMenuLabel>{t('mainLanguageTooltip')}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioGroup value={displayLang1} onValueChange={onDisplayLang1Change}>
                        {availableLanguages.map(lang => (
                            <DropdownMenuRadioItem key={`l1-${lang}`} value={lang}>{getLanguageLabel(lang)}</DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* --- SECONDARY LANGUAGE DROPDOWN / TRANSLATION TRIGGER --- */}
               <DropdownMenu>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8">
                                {getLanguageLabel(displayLang2)}
                            </Button>
                        </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{t('secondaryLanguageTooltip')}</p>
                    </TooltipContent>
                </Tooltip>
                <DropdownMenuContent>
                    <DropdownMenuLabel>{t('secondaryLanguageTooltip')}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioGroup value={displayLang2} onValueChange={onDisplayLang2Change}>
                        <DropdownMenuRadioItem value="none">{t('viewModes.none')}</DropdownMenuRadioItem>
                        <DropdownMenuSeparator />
                        {secondaryDisplayOptions.map(lang => {
                            const isAlreadyAvailable = availableLanguages.includes(lang.value);
                            return (
                                <DropdownMenuRadioItem key={`l2-${lang.value}`} value={lang.value}>
                                    <div className="flex items-center justify-between w-full">
                                        <span>{lang.label}</span>
                                        {!isAlreadyAvailable && (
                                            <Tooltip>
                                                <TooltipTrigger onClick={(e) => {
                                                    e.stopPropagation(); 
                                                    // FUTURE: onTranslateRequest(lang.value)
                                                    alert(`Trigger translation to ${lang.label}`);
                                                }}>
                                                    <Icon name="Wand2" className="h-4 w-4 text-primary ml-2" />
                                                </TooltipTrigger>
                                                <TooltipContent side="right">
                                                    <p>{t('translateActionTooltip')}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        )}
                                    </div>
                                </DropdownMenuRadioItem>
                            )
                        })}
                    </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              <Separator orientation="vertical" className="h-6" />
            </>
           )}
          
           {/* Text Align */}
          <div className="flex items-center">
            {textAlignOptions.map(opt => (
                <Tooltip key={opt.value}>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className={cn("h-8 w-8", settings.textAlign === opt.value && "bg-muted")} onClick={() => updateSetting('textAlign', opt.value)}>
                            <Icon name={opt.icon} className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>{opt.value.replace('text-', '')}</p></TooltipContent>
                </Tooltip>
            ))}
          </div>

          <Separator orientation="vertical" className="h-6" />

           {/* Vertical Align */}
          <div className="flex items-center">
            {verticalAlignOptions.map(opt => (
                <Tooltip key={opt.value}>
                    <TooltipTrigger asChild>
                         <Button variant="ghost" size="icon" className={cn("h-8 w-8", settings.verticalAlign === opt.value && "bg-muted")} onClick={() => updateSetting('verticalAlign', opt.value)}>
                            <Icon name={opt.icon} className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>{opt.value.replace('justify-', '')}</p></TooltipContent>
                </Tooltip>
            ))}
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* Background Options */}
          <DropdownMenu>
            <Tooltip>
                <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Icon name="Palette" className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Change Background</p>
                </TooltipContent>
            </Tooltip>
            <DropdownMenuContent>
                <DropdownMenuLabel>Background Color</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {colorOptions.map(opt => (
                    <DropdownMenuItem key={opt.value} onSelect={() => updateSetting('background', opt.value)}>
                        <div className={cn("w-4 h-4 rounded-full mr-2", opt.swatchClass)} />
                        <span>{opt.label}</span>
                         {settings.background === opt.value && <Icon name="Check" className="ml-auto h-4 w-4" />}
                    </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Paper Style</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {textureOptions.map(opt => (
                    <DropdownMenuItem key={opt.value} onSelect={() => updateSetting('background', opt.value)}>
                        <Icon name={opt.icon} className="mr-2 h-4 w-4" />
                        <span>{opt.label}</span>
                        {settings.background === opt.value && <Icon name="Check" className="ml-auto h-4 w-4" />}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>

           <Separator orientation="vertical" className="h-6" />
            
            <Tooltip>
                <TooltipTrigger asChild>
                     <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                        <Icon name="X" className="h-4 w-4" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Close Toolbar</p>
                </TooltipContent>
            </Tooltip>

        </div>
      </TooltipProvider>
    </div>
  );
};
