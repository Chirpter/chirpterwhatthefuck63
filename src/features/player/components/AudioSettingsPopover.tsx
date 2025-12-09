

"use client";

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from '@/components/ui/switch';
import { Icon } from '@/components/ui/icons';
import { useAudioPlayer } from '@/contexts/audio-player-context';
import { LANGUAGES } from '@/lib/constants';
import { getBcp47LangCode, cn } from '@/lib/utils';
import type { RepeatMode, LibraryItem, PlaylistRepeatMode, PlaylistItem } from '@/lib/types';
import { useMobile } from '@/hooks/useMobile';
import { Separator } from '@/components/ui/separator';
import { useSettings } from '@/contexts/settings-context';

interface AudioSettingsPopoverContentProps {
  item?: LibraryItem; // Prop to receive the current item, for ReaderPage
}

const AudioSettingsPopoverContent: React.FC<AudioSettingsPopoverContentProps> = ({ item }) => {
    const { t } = useTranslation();
    const isMobile = useMobile();
    const {
        currentPlayingItem,
        availableSystemVoices,
        ttsSettings,
        repeatMode,
        sleepTimerDuration,
        playlistRepeatMode,
        setVoiceForLanguage,
        setTtsRate,
        setTtsPitch,
        setRepeatMode,
        setPlaylistRepeatMode,
        setSleepTimer,
    } = useAudioPlayer();

    const ttsRate = ttsSettings?.rate ?? 1.0;
    const ttsPitch = ttsSettings?.pitch ?? 1.0;
    const selectedVoiceURIs = ttsSettings?.voices ?? {};
    
    const { autoplayEnabled, setAutoplayEnabled } = useSettings();

    const languageSource = useMemo(() => {
        const source = item ?? (currentPlayingItem ? { // Reconstruct a compatible object from context
            availableLanguages: currentPlayingItem.availableLanguages,
            primaryLanguage: currentPlayingItem.primaryLanguage,
        } : null);

        if (!source) return null;
        
        const availableLangs = source.availableLanguages || [];
        const secondaryLanguage = availableLangs.find(l => l !== source.primaryLanguage);

        return {
            availableLanguages: availableLangs,
            primaryLanguage: getBcp47LangCode(source.primaryLanguage),
            secondaryLanguage: secondaryLanguage ? getBcp47LangCode(secondaryLanguage) : undefined,
        };
    }, [item, currentPlayingItem]);

    const primaryLangBcp47 = languageSource?.primaryLanguage;
    const voicesForPrimaryLang = useMemo(() => {
        if (!primaryLangBcp47) return [];
        return availableSystemVoices.filter(v => (getBcp47LangCode(v.lang) || v.lang).startsWith(primaryLangBcp47));
    }, [availableSystemVoices, primaryLangBcp47]);
    const currentSelectedPrimaryVoiceURI = useMemo(() => primaryLangBcp47 ? selectedVoiceURIs[primaryLangBcp47] || "" : "", [selectedVoiceURIs, primaryLangBcp47]);
    
    const secondaryLangBcp47 = languageSource?.secondaryLanguage;
    const voicesForSecondaryLang = useMemo(() => {
        if (!secondaryLangBcp47) return [];
        return availableSystemVoices.filter(v => (getBcp47LangCode(v.lang) || v.lang).startsWith(secondaryLangBcp47));
    }, [availableSystemVoices, secondaryLangBcp47]);
    const currentSelectedSecondaryVoiceURI = useMemo(() => secondaryLangBcp47 ? selectedVoiceURIs[secondaryLangBcp47] || "" : "", [selectedVoiceURIs, secondaryLangBcp47]);
    
    const sleepTimerOptions = [
        { labelKey: 'sleepTimer.off', value: null },
        { labelKey: 'sleepTimer.option10min', value: 10 },
        { labelKey: 'sleepTimer.option15min', value: 15 },
        { labelKey: 'sleepTimer.option30min', value: 30 },
        { labelKey: 'sleepTimer.option60min', value: 60 },
    ];

    const handleMiniPlayerRepeatToggle = () => {
        const nextMode: RepeatMode = repeatMode === 'item' ? 'off' : 'item';
        setRepeatMode(nextMode);
    };
    
    const handlePlaylistRepeatToggle = () => {
        const nextMode: PlaylistRepeatMode = playlistRepeatMode === 'all' ? 'off' : 'all';
        setPlaylistRepeatMode(nextMode);
    };


    return (
        <div className="grid gap-4">
            <div className="space-y-2">
                <h4 className="font-medium leading-none">{t('audioSettings.title')}</h4>
            </div>

            {isMobile && (
                <>
                <div className="grid gap-2">
                    <Label>{t('audioSettings.repeatModeLabel')}</Label>
                    <RadioGroup
                        defaultValue={repeatMode}
                        onValueChange={(value) => setRepeatMode(value as RepeatMode)}
                        className="flex space-x-2"
                    >
                    <div className="flex items-center space-x-1">
                        <RadioGroupItem value="off" id="r-off-popover" />
                        <Label htmlFor="r-off-popover" className="text-xs">{t('audioSettings.repeatOffShort')}</Label>
                    </div>
                    <div className="flex items-center space-x-1">
                        <RadioGroupItem value="item" id="r-one-popover" />
                        <Label htmlFor="r-one-popover" className="text-xs">{t('audioSettings.repeatItemShort')}</Label>
                    </div>
                    </RadioGroup>
                </div>
                <div className="grid gap-2">
                    <Label>{t('sleepTimer.title')}</Label>
                    <Select
                        value={sleepTimerDuration === null ? "off" : sleepTimerDuration.toString()}
                        onValueChange={(value) => {
                            setSleepTimer(value === "off" ? null : parseInt(value, 10));
                        }}
                    >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {sleepTimerOptions.map(option => (
                                <SelectItem key={option.value === null ? 'off' : option.value.toString()} value={option.value === null ? 'off' : option.value.toString()}>
                                    {t(option.labelKey)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                </>
            )}

            {primaryLangBcp47 && (
            <div className="grid gap-2">
                <Label htmlFor="tts-voice-primary-popover">
                {(languageSource?.availableLanguages?.length ?? 0) > 1
                    ? t('audioSettings.voiceLabelPrimary', { lang: LANGUAGES.find(l => getBcp47LangCode(l.value) === primaryLangBcp47)?.label || primaryLangBcp47 })
                    : t('audioSettings.voiceLabel', { lang: LANGUAGES.find(l => getBcp47LangCode(l.value) === primaryLangBcp47)?.label || primaryLangBcp47 })
                }
                </Label>
                <Select
                value={currentSelectedPrimaryVoiceURI}
                onValueChange={(voiceURI) => setVoiceForLanguage(primaryLangBcp47, voiceURI)}
                disabled={voicesForPrimaryLang.length === 0}
                >
                <SelectTrigger id="tts-voice-primary-popover"><SelectValue placeholder={t('audioSettings.selectVoice')} /></SelectTrigger>
                <SelectContent>
                    {voicesForPrimaryLang.map(voice => (
                    <SelectItem key={voice.voiceURI} value={voice.voiceURI}>
                        {voice.name} ({getBcp47LangCode(voice.lang) || voice.lang})
                    </SelectItem>
                    ))}
                    {voicesForPrimaryLang.length === 0 && <SelectItem value="no-voice-primary" disabled>{t('audioSettings.noVoicesForLang')}</SelectItem>}
                </SelectContent>
                </Select>
            </div>
            )}
            {(languageSource?.availableLanguages?.length ?? 0) > 1 && secondaryLangBcp47 && (
            <div className="grid gap-2">
                <Label htmlFor="tts-voice-secondary-popover">
                    {t('audioSettings.voiceLabelSecondary', { lang: LANGUAGES.find(l => getBcp47LangCode(l.value) === secondaryLangBcp47)?.label || secondaryLangBcp47 })}
                </Label>
                <Select
                value={currentSelectedSecondaryVoiceURI}
                onValueChange={(voiceURI) => setVoiceForLanguage(secondaryLangBcp47, voiceURI)}
                disabled={voicesForSecondaryLang.length === 0}
                >
                <SelectTrigger id="tts-voice-secondary-popover"><SelectValue placeholder={t('audioSettings.selectVoice')} /></SelectTrigger>
                <SelectContent>
                    {voicesForSecondaryLang.map(voice => (
                    <SelectItem key={voice.voiceURI} value={voice.voiceURI}>
                    {voice.name} ({getBcp47LangCode(voice.lang) || voice.lang})
                    </SelectItem>
                    ))}
                    {voicesForSecondaryLang.length === 0 && <SelectItem value="no-voice-secondary" disabled>{t('audioSettings.noVoicesForLang')}</SelectItem>}
                </SelectContent>
                </Select>
            </div>
            )}
            <div className="grid gap-2">
            <Label htmlFor="tts-rate-popover">{t('audioSettings.rateLabel')} ({ttsRate.toFixed(1)})</Label>
            <Slider
                id="tts-rate-popover"
                min={0.5} max={2} step={0.1}
                defaultValue={[ttsRate]}
                onValueChange={(value) => setTtsRate(value[0])}
            />
            </div>
            <div className="grid gap-2">
            <Label htmlFor="tts-pitch-popover">{t('audioSettings.pitchLabel')} ({ttsPitch.toFixed(1)})</Label>
            <Slider
                id="tts-pitch-popover"
                min={0} max={2} step={0.1}
                defaultValue={[ttsPitch]}
                onValueChange={(value) => setTtsPitch(value[0])}
            />
            </div>

            <Separator />
            
            <div className="flex items-center justify-between space-x-2">
              <div>
                <Label htmlFor="autoplay-popover" className="font-body flex-grow cursor-pointer">{t('audioSettings.autoplayLabel')}</Label>
                <p className="text-xs text-muted-foreground">{t('audioSettings.autoplayDescription')}</p>
              </div>
              <Switch
                id="autoplay-popover"
                checked={autoplayEnabled}
                onCheckedChange={setAutoplayEnabled}
              />
            </div>
        </div>
    )
}

interface AudioSettingsPopoverProps {
    disabled?: boolean;
    children: React.ReactNode;
    align?: "center" | "start" | "end";
    side?: "top" | "bottom" | "left" | "right";
    item?: LibraryItem; // New optional prop
}

export const AudioSettingsPopover: React.FC<AudioSettingsPopoverProps> = ({ children, align = "end", side = "top", disabled = false, item }) => {
    const { availableSystemVoices } = useAudioPlayer();

    if (disabled || availableSystemVoices.length === 0) {
        return <>{children}</>;
    }

    return (
        <Popover>
            <PopoverTrigger asChild>
                {children}
            </PopoverTrigger>
            <PopoverContent className="w-80 font-body mb-2" side={side} align={align}>
                <AudioSettingsPopoverContent item={item} />
            </PopoverContent>
        </Popover>
    );
}
