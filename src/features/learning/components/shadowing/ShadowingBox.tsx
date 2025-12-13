// src/features/learning/components/shadowing/ShadowingBox.tsx

"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { getDiff, type DiffSegment } from '@/services/client/diff.service';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useToast } from '@/hooks/useToast';
import WordBlockRenderer from './WordBlockRenderer';
import { Card, CardContent } from '@/components/ui/card';

export interface ShadowingResult {
    isMatch: boolean;
    errorTypes: string[];
    original: DiffSegment[];
    user: DiffSegment[];
    lineIndex: number;
}

interface ShadowingBoxProps {
    line: string;
    startTime: number;
    hideMode: 'block' | 'blur' | 'hidden';
    checkMode: 'strict' | 'gentle';
    onComplete: (isCorrect: boolean, result: ShadowingResult) => void;
    isCorrect: boolean;
    onPlay: () => void;
    onReveal?: () => void;
    isPlaying?: boolean;
    mode: 'normal' | 'shadowing';
    isOpen: boolean;
    onToggleOpen: (isOpen: boolean) => void;
    disabled?: boolean;
}

export function ShadowingBox({ 
    line, 
    startTime, 
    hideMode, 
    checkMode, 
    onComplete, 
    isCorrect, 
    onPlay,
    onReveal,
    isPlaying = false,
    mode = 'normal',
    isOpen,
    onToggleOpen,
    disabled = false,
}: ShadowingBoxProps) {
    const { t } = useTranslation(['learningPage']);
    const { toast } = useToast();
    const [userInput, setUserInput] = useState('');
    const [isRevealed, setIsRevealed] = useState(false);
    const [diffResult, setDiffResult] = useState<{ original: DiffSegment[], user: DiffSegment[], errorTypes: string[] } | null>(null);
    const [isChecking, setIsChecking] = useState(false);

    const handleSpeechResult = useCallback((text: string) => {
        setUserInput(prev => (prev ? prev + ' ' : '') + text);
    }, []);

    const handleSpeechError = useCallback((error: string) => {
        toast({
            title: "Speech Recognition Error",
            description: error,
            variant: "destructive"
        });
    }, [toast]);

    const { 
        isListening, 
        isSupported, 
        toggleListening 
    } = useSpeechRecognition({
        onResult: handleSpeechResult,
        onError: handleSpeechError
    });

    const formatTime = (seconds: number): string => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = Math.floor(seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };
    
    const handleCheck = useCallback(async () => {
        if (!userInput.trim() || disabled) return;
        
        setIsChecking(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const result = getDiff(line, userInput, { checkMode });
            setDiffResult(result);
            setIsRevealed(false);
            onComplete(result.isMatch, { ...result, lineIndex: 0 });

        } catch (error) {
            toast({
                title: "Comparison Error",
                description: "Failed to check your input. Please try again.",
                variant: "destructive"
            });
        } finally {
            setIsChecking(false);
        }
    }, [line, userInput, checkMode, onComplete, toast, disabled]);

    const handleEdit = useCallback(() => {
        if (disabled) return;
        setDiffResult(null);
        setIsRevealed(false);
    }, [disabled]);

    const handleRevealClick = useCallback(() => {
        if (disabled) return;
        setIsRevealed(prev => !prev);
        if (!isRevealed && onReveal) {
            onReveal();
        }
    }, [isRevealed, onReveal, disabled]);

    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                handleCheck();
            }
            if (e.key === 'Escape' && diffResult) {
                e.preventDefault();
                handleEdit();
            }
        };

        document.addEventListener('keydown', handleKeyPress);
        return () => document.removeEventListener('keydown', handleKeyPress);
    }, [handleCheck, handleEdit, diffResult]);

    const renderOriginalText = useMemo(() => {
        const textClasses = cn(
            "text-[15px] leading-relaxed font-light w-full",
            hideMode === 'blur' && !isRevealed && !diffResult && "blur-sm select-none",
            hideMode === 'hidden' && !isRevealed && !diffResult && "invisible"
        );
        
        return (
            <div className={textClasses} aria-hidden={hideMode !== 'block' && !isRevealed && !diffResult}>
                <WordBlockRenderer text={line} hideMode={hideMode} isRevealed={isRevealed || !!diffResult} diff={diffResult?.original} />
            </div>
        )
    }, [line, hideMode, isRevealed, diffResult]);

    const handleMicClick = useCallback(() => {
        if (disabled) return;
        if (!isSupported) {
            toast({
                title: "Feature Not Supported",
                description: "Speech recognition is not available in your browser. Please use Chrome or Edge.",
                variant: "destructive"
            });
            return;
        }
        toggleListening();
    }, [isSupported, toggleListening, toast, disabled]);

    if (mode === 'normal') {
        return (
            <div className="grid grid-cols-[40px_1fr] gap-3 items-start">
                <div className="flex flex-col items-center space-y-2">
                    <div className="text-xs font-mono text-primary">{formatTime(startTime)}</div>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={onPlay}
                        className={cn(
                            "h-7 w-7 transition-colors",
                            isPlaying 
                                ? "text-red-600 bg-red-50" 
                                : "text-foreground hover:text-red-600"
                        )}
                    >
                        <Icon name={isPlaying ? "Pause" : "Play"} className="h-4 w-4" />
                    </Button>
                </div>
                <div className="text-[15px] leading-relaxed font-light">
                    {line}
                </div>
            </div>
        );
    }

    if (disabled) {
        return (
            <div className="grid grid-cols-[40px_1fr] gap-3 items-start opacity-70">
                <div className="flex flex-col items-center space-y-2">
                    <div className="text-xs font-mono text-primary">{formatTime(startTime)}</div>
                    <Icon name="Check" className="h-5 w-5 text-green-500" />
                </div>
                <div className="text-[15px] leading-relaxed font-light line-through">
                    {line}
                </div>
            </div>
        );
    }

    return (
        <div className="w-full">
            <div className="grid grid-cols-[40px_1fr] gap-3 items-start">
                <div className="flex flex-col items-center space-y-2">
                    <div className="text-xs font-mono text-primary">{formatTime(startTime)}</div>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={onPlay}
                        disabled={disabled}
                        className={cn(
                            "h-7 w-7 transition-colors",
                            isPlaying 
                                ? "text-red-600 bg-red-50" 
                                : "text-foreground hover:text-red-600",
                            disabled && "opacity-50 cursor-not-allowed"
                        )}
                    >
                        <Icon name={isPlaying ? "Pause" : "Play"} className="h-4 w-4" />
                    </Button>
                    {isCorrect && (
                        <Icon name="Check" className="h-5 w-5 text-green-500" />
                    )}
                </div>

                <div className="relative group/shadowing-box">
                    {renderOriginalText}
                    
                    <div className="absolute top-0 right-0 opacity-0 group-hover/shadowing-box:opacity-100 transition-opacity">
                        <Button
                            variant="ghost" 
                            size="icon"
                            onClick={handleRevealClick}
                            disabled={disabled}
                            className="h-7 w-7"
                            aria-label={isRevealed ? t('shadowing.hideText') : t('shadowing.showText')}
                        >
                            <Icon name="Eye" className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            <Collapsible open={isOpen} onOpenChange={onToggleOpen} className="w-full mt-3">
                <div className="flex w-full items-center">
                    <div className="h-px flex-grow border-b border-dashed border-border mr-2"></div>
                    <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                            <svg 
                                viewBox="0 0 10 10" 
                                className={cn(
                                    "h-2.5 w-2.5 fill-current transition-transform duration-200",
                                    isOpen ? "rotate-180" : "rotate-0"
                                )}
                            >
                                <polygon points="0,0 10,0 5,10" />
                            </svg>
                        </Button>
                    </CollapsibleTrigger>
                </div>
                
                <CollapsibleContent>
                    <div className="grid grid-cols-[40px_1fr] gap-3 mt-3">
                        <div className="flex flex-col items-center space-y-2">
                            {!diffResult ? (
                                <>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={handleMicClick}
                                        disabled={!isSupported || disabled}
                                        className={cn(
                                            "h-7 w-7 transition-colors",
                                            isListening 
                                                ? "text-red-600 bg-red-50 animate-pulse" 
                                                : "text-foreground hover:text-red-600",
                                            disabled && "opacity-50 cursor-not-allowed"
                                        )}
                                        title={!isSupported ? "Speech recognition not supported" : isListening ? "Stop listening" : "Start speaking"}
                                    >
                                        <Icon name="Mic" className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={handleCheck}
                                        className={cn(
                                            "h-7 w-7 transition-colors",
                                            userInput.trim() && !isChecking 
                                                ? "text-foreground hover:text-red-600" 
                                                : "text-muted-foreground opacity-50 cursor-not-allowed"
                                        )}
                                        disabled={!userInput.trim() || isChecking || disabled}
                                        title={userInput.trim() ? "Check your answer (Ctrl+Enter)" : "Enter text to check"}
                                    >
                                        {isChecking ? (
                                            <Icon name="Loader2" className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Icon name="Send" className="h-4 w-4" />
                                        )}
                                    </Button>
                                </>
                            ) : (
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={handleEdit}
                                    disabled={disabled}
                                    className="h-7 w-7 text-foreground hover:text-red-600 transition-colors"
                                    title="Edit your answer (Esc)"
                                >
                                    <Icon name="Edit" className="h-4 w-4" />
                                </Button>
                            )}
                        </div>

                        <div className="min-w-0">
                            {diffResult ? (
                                <div className="space-y-2">
                                    <div className="min-h-[80px] p-3 text-[15px] leading-relaxed font-light border rounded-md bg-muted/30 overflow-auto whitespace-pre-wrap break-words">
                                        <WordBlockRenderer text={userInput} diff={diffResult.user} hideMode="block" isRevealed={true}/>
                                    </div>
                                </div>
                            ) : (
                                <div className="relative">
                                    <Textarea
                                        value={userInput}
                                        onChange={(e) => setUserInput(e.target.value)}
                                        rows={3}
                                        placeholder={isListening ? "Listening... Speak now" : "Type or speak your shadowing..."}
                                        disabled={isChecking || disabled}
                                        className="text-[15px] leading-relaxed font-light pr-10 transition-colors resize-none"
                                        onKeyDown={(e) => {
                                            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                                                e.preventDefault();
                                                handleCheck();
                                            }
                                        }}
                                    />
                                    {userInput && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setUserInput('')}
                                            disabled={disabled}
                                            className="absolute right-2 top-2 h-6 w-6 opacity-60 hover:opacity-100 transition-opacity"
                                        >
                                            <Icon name="X" className="h-3 w-3" />
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {!isSupported && (
                        <div className="col-span-2 mt-2">
                            <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-3 py-1 rounded border border-amber-200 dark:border-amber-800">
                                Speech recognition not supported in your browser. Try Chrome or Edge.
                            </div>
                        </div>
                    )}
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
}