// src/features/create/components/book/CoverImageSettings.tsx

"use client";

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Icon } from '@/components/ui/icons';
import { MAX_PROMPT_LENGTH } from '@/lib/constants';
import { ProFeatureWrapper } from '@/features/user/components/ProFeatureWrapper';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface CoverImageSettingsProps {
    coverImageOption: 'none' | 'upload' | 'ai';
    onCoverOptionChange: (value: 'none' | 'upload' | 'ai') => void;
    coverImageFile: File | null;
    onCoverFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    coverImageAiPrompt?: string;
    onCoverAiPromptChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    isDisabled: boolean;
    isProUser: boolean;
}

export const CoverImageSettings: React.FC<CoverImageSettingsProps> = ({
    coverImageOption,
    onCoverOptionChange,
    onCoverFileChange,
    coverImageAiPrompt,
    onCoverAiPromptChange,
    isDisabled,
    isProUser,
}) => {
    const { t } = useTranslation('createPage');

    return (
        <AccordionItem value="cover-settings" className="border rounded-lg overflow-hidden">
            <AccordionTrigger className="px-4 py-3 hover:no-underline text-base font-medium bg-muted/50">
                <div className="flex items-center">
                    <Icon name="Image" className="h-5 w-5 mr-2 text-primary" />
                    {t('coverImage.title')}
                </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pt-4 pb-4 space-y-4">
                <Select
                    onValueChange={onCoverOptionChange}
                    value={coverImageOption}
                    disabled={isDisabled}
                >
                    <SelectTrigger className="font-body"><SelectValue placeholder={t('coverImage.selectOptionPlaceholder')} /></SelectTrigger>
                    <SelectContent className="font-body">
                        <SelectItem value="none">{t('coverImage.optionNone')}</SelectItem>
                        <SelectItem value="upload">{t('coverImage.optionUpload')}</SelectItem>
                        <SelectItem value="ai">{t('coverImage.optionAi')}</SelectItem>
                    </SelectContent>
                </Select>

                {coverImageOption === 'upload' && (
                    <ProFeatureWrapper isProUser={isProUser}>
                        <div className="mt-2 space-y-2">
                            <Label htmlFor="coverImageFile" className="font-body">{t('coverImage.uploadFileLabel')}</Label>
                            <Input
                                id="coverImageFile"
                                type="file"
                                accept="image/*"
                                onChange={onCoverFileChange}
                                className="font-body"
                                disabled={isDisabled || !isProUser}
                            />
                        </div>
                    </ProFeatureWrapper>
                )}
                
                {coverImageOption === 'ai' && (
                    <div className="mt-2 space-y-2">
                        <Label htmlFor="coverImageAiPrompt" className="font-body">{t('coverImage.aiPromptLabel')}</Label>
                        <Input
                            id="coverImageAiPrompt"
                            name="coverImageAiPrompt"
                            placeholder={t('coverImage.aiPromptPlaceholder')}
                            value={coverImageAiPrompt}
                            onChange={onCoverAiPromptChange}
                            className="font-body"
                            disabled={isDisabled}
                            maxLength={MAX_PROMPT_LENGTH}
                        />
                    </div>
                )}
            </AccordionContent>
        </AccordionItem>
    );
};
