// src/features/diary/components/ContextualToolbar.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useMobile } from '@/hooks/useMobile';
import type { DiaryObject, TextObject, TextStyle } from '@/features/diary/types';

const COLORS = ['#374151', '#EF4444', '#3B82F6', '#22C55E', '#A855F7', '#EAB308'];

interface ContextualToolbarProps {
    selectedObjects: DiaryObject[];
    onObjectUpdate: (id: string, updates: Partial<DiaryObject>) => void;
    onObjectDelete: (id: string) => void;
    style?: React.CSSProperties; 
}

export const ContextualToolbar: React.FC<ContextualToolbarProps> = ({ 
    selectedObjects, 
    onObjectUpdate, 
    onObjectDelete,
    style
}) => {
    const isMobile = useMobile();

    const handleStyleUpdate = (property: keyof TextStyle, value: any, isToggle = false) => {
        selectedObjects.forEach(obj => {
            if (obj.type !== 'text') return;
            
            const currentStyle = (obj as TextObject).style;
            let newValue = value;
            
            if (isToggle) {
                const defaultValue = property === 'fontWeight' ? 'normal' : 
                                    property === 'fontStyle' ? 'normal' : 'none';
                newValue = currentStyle[property] === value ? defaultValue : value;
            }

            onObjectUpdate(obj.id, {
                style: { ...currentStyle, [property]: newValue }
            });
        });
    };

    const handleDelete = () => {
        selectedObjects.forEach(obj => onObjectDelete(obj.id));
    };

    if (selectedObjects.length === 0) return null;

    const firstObject = selectedObjects[0];
    const firstTextObject = firstObject?.type === 'text' ? (firstObject as TextObject) : undefined;
    
    const hasText = !!firstTextObject;
    
    const firstObjectStyle = firstTextObject?.style;
    const isBold = hasText && firstObjectStyle?.fontWeight === 'bold';
    const isItalic = hasText && firstObjectStyle?.fontStyle === 'italic';
    const isUnderline = hasText && firstObjectStyle?.textDecoration === 'underline';
    const currentTextAlign = hasText ? (firstObjectStyle?.textAlign || 'left') : 'left';
    const currentFontSize = hasText ? (firstObjectStyle?.fontSize || 14) : 14;
    
    const toolbarPositionClass = isMobile 
        ? "fixed bottom-20 left-1/2 -translate-x-1/2" // Adjusted for mobile sidebar
        : "fixed";

    return (
        <Card 
            className={`${toolbarPositionClass} z-50 shadow-lg border-2 bg-background contextual-toolbar`} 
            style={style}
            data-contextual-toolbar="true"
            onPointerDown={(e) => e.stopPropagation()}
        >
            <CardContent className="p-2">
                <div className="flex items-center gap-1">
                    {hasText && (
                        <>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="w-14 h-8"
                                        data-toolbar-button="font-size"
                                    >
                                        {currentFontSize}px
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-56 p-2" data-toolbar-popover="font-size">
                                    <Slider
                                        value={[currentFontSize]}
                                        onValueChange={(val) => handleStyleUpdate('fontSize', val[0])}
                                        min={10}
                                        max={64}
                                        step={1}
                                        data-toolbar-slider="font-size"
                                    />
                                </PopoverContent>
                            </Popover>
                            <Button
                                size="icon"
                                variant={isBold ? "secondary" : "ghost"}
                                onClick={() => handleStyleUpdate('fontWeight', 'bold', true)}
                                className="font-bold w-8 h-8"
                                data-toolbar-button="bold"
                            >B</Button>
                            <Button
                                size="icon"
                                variant={isItalic ? "secondary" : "ghost"}
                                onClick={() => handleStyleUpdate('fontStyle', 'italic', true)}
                                className="italic w-8 h-8"
                                data-toolbar-button="italic"
                            >I</Button>
                            <Button
                                size="icon"
                                variant={isUnderline ? "secondary" : "ghost"}
                                onClick={() => handleStyleUpdate('textDecoration', 'underline', true)}
                                className="underline w-8 h-8"
                                data-toolbar-button="underline"
                            >U</Button>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="w-8 h-8"
                                        data-toolbar-button="color"
                                    >
                                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: firstObjectStyle?.color || '#000' }} />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-1" data-toolbar-popover="color">
                                    <div className="flex gap-1">
                                        {COLORS.map(color => (
                                            <Button 
                                                key={color} 
                                                variant="outline" 
                                                size="icon" 
                                                className="h-7 w-7" 
                                                onClick={() => handleStyleUpdate('color', color)}
                                                data-toolbar-button="color-option"
                                            >
                                                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color }}/>
                                            </Button>
                                        ))}
                                    </div>
                                </PopoverContent>
                            </Popover>
                            <Separator orientation="vertical" className="h-6 mx-1" />
                            <ToggleGroup 
                                type="single" 
                                value={currentTextAlign} 
                                onValueChange={(value) => value && handleStyleUpdate('textAlign', value as any)} 
                                aria-label="Text alignment"
                                data-toolbar-group="text-align"
                            >
                                <ToggleGroupItem 
                                    value="left" 
                                    aria-label="Left aligned" 
                                    className="w-8 h-8 p-0"
                                    data-toolbar-button="align-left"
                                >
                                    <Icon name="AlignLeft" className="h-4 w-4" />
                                </ToggleGroupItem>
                                <ToggleGroupItem 
                                    value="center" 
                                    aria-label="Center aligned" 
                                    className="w-8 h-8 p-0"
                                    data-toolbar-button="align-center"
                                >
                                    <Icon name="AlignCenter" className="h-4 w-4" />
                                </ToggleGroupItem>
                                <ToggleGroupItem 
                                    value="right" 
                                    aria-label="Right aligned" 
                                    className="w-8 h-8 p-0"
                                    data-toolbar-button="align-right"
                                >
                                    <Icon name="AlignRight" className="h-4 w-4" />
                                </ToggleGroupItem>
                            </ToggleGroup>
                            <Separator orientation="vertical" className="h-6 mx-1" />
                        </>
                    )}
                    
                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={handleDelete}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive w-8 h-8"
                        data-toolbar-button="delete"
                    >
                        <Icon name="Trash2" className="h-4 w-4" />
                    </Button>
                    
                    {selectedObjects.length > 1 && (
                        <span className="text-xs text-muted-foreground ml-2 whitespace-nowrap pl-2 border-l">
                            {selectedObjects.length} selected
                        </span>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};
