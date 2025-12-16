// src/features/reader/components/shared/ReaderToolbar.tsx

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
  // --- Control Props ---
  isToolbarOpen: boolean;
  onToggleToolbar: () => void;
  // --- Language Props ---
  bookTitle?: string;
  availableLanguages: string[];
  displayLang1: string;
  displayLang2: string; // 'none' or a lang code
  onDisplayLang1Change: (langCode: string) => void;
  onDisplayLang2Change: (langCode: string) => void;
  onTranslateRequest?: (targetLang: string) => void;
  presentationStyle: 'book' | 'doc' | 'card';
}

export const ReaderToolbar: React.FC<ReaderToolbarProps> = ({ 
  settings, 
  onSettingsChange, 
  onClose,
  isToolbarOpen,
  onToggleToolbar,
  bookTitle,
  availableLanguages,
  displayLang1,
  displayLang2,
  onDisplayLang1Change,
  onDisplayLang2Change,
  onTranslateRequest,
  presentationStyle,
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

  const fontSizeOptions: EditorSettings['fontSize'][] = ['sm', 'base', 'lg'];
  const currentFontSizeIndex = fontSizeOptions.indexOf(settings.fontSize);

  const handleFontSizeChange = (direction: 'increase' | 'decrease' | 'reset') => {
    if (direction === 'reset') {
        updateSetting('fontSize', 'base');
        return;
    }
    const nextIndex = direction === 'increase' ? currentFontSizeIndex + 1 : currentFontSizeIndex - 1;
    if (nextIndex >= 0 && nextIndex < fontSizeOptions.length) {
        updateSetting('fontSize', fontSizeOptions[nextIndex]);
    }
  };

  const getLanguageLabel = (code: string | undefined): string => {
    if (!code || code === 'none') return t('viewModes.none');
    return LANGUAGES.find(l => l.value === code)?.label || code;
  };

  const handleSecondaryLanguageSelect = (langCode: string) => {
    if (langCode !== 'none' && !availableLanguages.includes(langCode) && onTranslateRequest) {
      onTranslateRequest(langCode);
    } else {
      onDisplayLang2Change(langCode);
    }
  };
  
  if (!isToolbarOpen) {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" className="h-9 w-9 bg-background/70 backdrop-blur-sm" onClick={onToggleToolbar}>
                        <Icon name="PenLine" className="h-4 w-4" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent><p>Open Editor Toolbar</p></TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
  }

  const buttonClass = "h-7 w-7 md:h-8 md:w-8";
  const iconClass = "h-4 w-4";

  return (
    <div className="bg-background/90 border shadow-lg p-1.5 md:p-2 animate-in fade-in-0 slide-in-from-top-2 duration-300 rounded-lg flex flex-col gap-2">
      {bookTitle && (
        <div className="text-center font-headline text-sm font-semibold truncate px-2 text-primary">
          {bookTitle}
        </div>
      )}
      <TooltipProvider>
        <div className="flex items-center justify-center gap-1">
           {availableLanguages.length > 1 && (
            <>
              {/* --- LANGUAGE DROPDOWNs --- */}
              <DropdownMenu>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 text-xs md:text-sm">
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

               <DropdownMenu>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 text-xs md:text-sm">
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
                    <DropdownMenuRadioGroup value={displayLang2} onValueChange={handleSecondaryLanguageSelect}>
                        <DropdownMenuRadioItem value="none">{t('viewModes.none')}</DropdownMenuRadioItem>
                        <DropdownMenuSeparator />
                        {LANGUAGES.map(lang => {
                            if (lang.value === displayLang1) return null;
                            const isAlreadyAvailable = availableLanguages.includes(lang.value);
                            return (
                                <DropdownMenuRadioItem key={`l2-${lang.value}`} value={lang.value}>
                                    <div className="flex items-center justify-between w-full">
                                        <span>{lang.label}</span>
                                        {!isAlreadyAvailable && onTranslateRequest && (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className="p-1 -mr-1 rounded-sm" onClick={(e) => e.stopPropagation()}>
                                                        <Icon name="Sparkles" className="h-4 w-4 text-primary" />
                                                    </div>
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

              <Separator orientation="vertical" className="h-6 mx-1" />
            </>
           )}

           {/* --- FONT SIZE (Book Only) --- */}
           {presentationStyle === 'book' && (
             <>
              <div className="flex items-center">
                  <Tooltip>
                      <TooltipTrigger asChild>
                           <Button variant="ghost" size="icon" className={buttonClass} onClick={() => handleFontSizeChange('decrease')} disabled={currentFontSizeIndex <= 0}>
                               <Icon name="Minus" className={iconClass} />
                           </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Decrease font size</p></TooltipContent>
                  </Tooltip>
                  <Tooltip>
                      <TooltipTrigger asChild>
                           <Button variant="ghost" size="icon" className={buttonClass} onClick={() => handleFontSizeChange('reset')} disabled={settings.fontSize === 'base'}>
                                A
                           </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Reset font size</p></TooltipContent>
                  </Tooltip>
                  <Tooltip>
                      <TooltipTrigger asChild>
                           <Button variant="ghost" size="icon" className={buttonClass} onClick={() => handleFontSizeChange('increase')} disabled={currentFontSizeIndex >= fontSizeOptions.length - 1}>
                               <Icon name="Plus" className={iconClass} />
                           </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Increase font size</p></TooltipContent>
                  </Tooltip>
              </div>
              <Separator orientation="vertical" className="h-6 mx-1" />
             </>
           )}
          
           {/* Text Align */}
          <div className="flex items-center">
            {textAlignOptions.map(opt => (
                <Tooltip key={opt.value}>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className={cn(buttonClass, settings.textAlign === opt.value && "bg-muted")} onClick={() => updateSetting('textAlign', opt.value)}>
                            <Icon name={opt.icon} className={iconClass} />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>{opt.value.replace('text-', '')}</p></TooltipContent>
                </Tooltip>
            ))}
          </div>

          <Separator orientation="vertical" className="h-6 mx-1" />

           {/* Vertical Align (Only for Doc/Card) */}
          {(presentationStyle === 'doc' || presentationStyle === 'card') && (
            <>
                <div className="flex items-center">
                    {verticalAlignOptions.map(opt => (
                        <Tooltip key={opt.value}>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className={cn(buttonClass, settings.verticalAlign === opt.value && "bg-muted")} onClick={() => updateSetting('verticalAlign', opt.value)}>
                                    <Icon name={opt.icon} className={iconClass} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>{opt.value.replace('justify-', '')}</p></TooltipContent>
                        </Tooltip>
                    ))}
                </div>
                <Separator orientation="vertical" className="h-6 mx-1" />
            </>
          )}


          {/* Background Options */}
          <DropdownMenu>
            <Tooltip>
                <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className={buttonClass}>
                            <Icon name="Palette" className={iconClass} />
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

           <Separator orientation="vertical" className="h-6 mx-1" />
            
            <Tooltip>
                <TooltipTrigger asChild>
                     <Button variant="ghost" size="icon" className={buttonClass} onClick={onClose}>
                        <Icon name="X" className={iconClass} />
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
