// src/features/learning/components/shadowing/ShadowingBox.tsx (ENHANCED)

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { getDiff, type DiffSegment } from '@/features/learning/services/diff-service';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useToast } from '@/hooks/useToast';
import WordBlockRenderer from './WordBlockRenderer';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
    onReplay?: () => void;
    isPlaying?: boolean;
    mode: 'normal' | 'shadowing';
    isOpen: boolean;
    onToggleOpen: (isOpen: boolean) => void;
    disabled?: boolean;
    lineIndex: number;
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
    onReplay,
    isPlaying = false,
    mode = 'normal',
    isOpen,
    onToggleOpen,
    disabled = false,
    lineIndex,
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
            onComplete(result.isMatch, { ...result, lineIndex });

        } catch (error) {
            toast({
                title: "Comparison Error",
                description: "Failed to check your input. Please try again.",
                variant: "destructive"
            });
        } finally {
            setIsChecking(false);
        }
    }, [line, userInput, checkMode, onComplete, toast, disabled, lineIndex]);

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

    const handlePlayClick = useCallback(() => {
        onPlay();
        if (onReplay) {
            onReplay();
        }
    }, [onPlay, onReplay]);

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
            "w-full text-body-base leading-relaxed font-light transition-all duration-300",
            hideMode === 'blur' && !isRevealed && !diffResult && "blur-sm select-none",
            hideMode === 'hidden' && !isRevealed && !diffResult && "invisible",
            // ✨ NEW: Subtle styling for completed boxes
            disabled && isCorrect && "opacity-70",
            disabled && !isCorrect && "opacity-60"
        );
        
        return (
            <div className={textClasses} aria-hidden={hideMode !== 'block' && !isRevealed && !diffResult}>
                <WordBlockRenderer 
                    text={line} 
                    hideMode={hideMode} 
                    isRevealed={isRevealed || !!diffResult} 
                    diff={diffResult?.original}
                    checkMode={checkMode}
                />
            </div>
        )
    }, [line, hideMode, isRevealed, diffResult, disabled, isCorrect]);

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
                        onClick={handlePlayClick}
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
                <div className="text-body-base leading-relaxed font-light">
                    {line}
                </div>
            </div>
        );
    }

    // Main shadowing mode render
    return (
        <div className={cn(
            "w-full transition-all duration-300",
            disabled && "pointer-events-none",
        )}>
            <div className="grid grid-cols-[40px_1fr] gap-3 items-start">
                <div className="flex flex-col items-center space-y-2">
                    <div className="text-xs font-mono text-primary">{formatTime(startTime)}</div>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={handlePlayClick}
                        disabled={disabled}
                        className={cn(
                            "h-7 w-7 transition-colors",
                            isPlaying 
                                ? "text-red-600 bg-red-50" 
                                : "text-foreground hover:text-red-600",
                            disabled && "opacity-50"
                        )}
                    >
                        <Icon name={isPlaying ? "Pause" : "Play"} className="h-4 w-4" />
                    </Button>
                    {/* ✨ NEW: Visual feedback for correct completion */}
                    {isCorrect && (
                        <div className="relative">
                            <Icon name="Check" className="h-5 w-5 text-green-500 animate-in zoom-in-50 duration-300" />
                            <div className="absolute inset-0 rounded-full bg-green-500/20 blur-sm -z-10 animate-pulse" />
                        </div>
                    )}
                </div>

                <div className="relative group/shadowing-box">
                    {renderOriginalText}
                    
                    {!disabled && (
                        <div className="absolute top-0 right-0 opacity-0 group-hover/shadowing-box:opacity-100 transition-opacity">
                            <Button
                                variant="ghost" 
                                size="icon"
                                onClick={handleRevealClick}
                                className="h-7 w-7"
                                aria-label={isRevealed ? t('shadowing.hideText') : t('shadowing.showText')}
                            >
                                <Icon name="Eye" className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* ✨ IMPROVED: Collapsible với disabled state rõ ràng hơn */}
            <Collapsible open={isOpen && !disabled} onOpenChange={onToggleOpen} className="w-full mt-3">
                <div className="flex w-full items-center">
                    <div className={cn(
                        "h-px flex-grow border-b border-dashed mr-2 transition-colors",
                        disabled ? "border-green-300 dark:border-green-800" : "border-border"
                    )}></div>
                    {!disabled && (
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
                    )}
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
                                        disabled={!isSupported}
                                        className={cn(
                                            "h-7 w-7 transition-colors",
                                            isListening 
                                                ? "text-red-600 bg-red-50 animate-pulse" 
                                                : "text-foreground hover:text-red-600"
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
                                        disabled={!userInput.trim() || isChecking}
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
                                    <div className={cn(
                                        "min-h-[80px] p-3 text-body-base leading-relaxed font-light border rounded-md bg-background overflow-auto whitespace-pre-wrap break-words transition-colors",
                                        diffResult.errorTypes.length === 0 && "border-green-300 dark:border-green-700 bg-green-50/30 dark:bg-green-950/20"
                                    )}>
                                        <WordBlockRenderer 
                                            text={userInput} 
                                            diff={diffResult.user} 
                                            hideMode="block" 
                                            isRevealed={true}
                                            showCorrect={diffResult.errorTypes.length === 0}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="relative">
                                    <Textarea
                                        value={userInput}
                                        onChange={(e) => setUserInput(e.target.value)}
                                        rows={3}
                                        placeholder={isListening ? "Listening... Speak now" : "Type or speak your shadowing..."}
                                        disabled={isChecking}
                                        className="text-body-base leading-relaxed font-light pr-10 transition-colors resize-none"
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
                        <Alert variant="destructive" className="mt-2 text-xs p-3">
                            <Icon name="Mic" className="h-4 w-4" />
                            <AlertDescription>
                                Speech recognition not supported. Try Chrome or Edge.
                            </AlertDescription>
                        </Alert>
                    )}
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
}