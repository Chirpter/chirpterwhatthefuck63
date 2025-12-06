// src/features/diary/components/WateringGamePanel.tsx

'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { diaryEventManager } from '../foundation/event-manager';
import { DiaryToolManager } from '../business/managers/tool-manager';

interface WateringGamePanelProps {
    disabled: boolean;
    lastInteractedPageId: string | null;
    visiblePageIds: string[];
}

export const WateringGamePanel: React.FC<WateringGamePanelProps> = ({ disabled, lastInteractedPageId, visiblePageIds }) => {
    
    const handleAddTool = (toolId: 'plant') => {
        const targetPageId = lastInteractedPageId || (visiblePageIds.length > 0 ? visiblePageIds[0] : null);
        if (disabled || !targetPageId) return;
        
        const toolManager = DiaryToolManager.getInstance();
        const toolDef = toolManager.getTool(toolId);
        if (toolDef) {
            diaryEventManager.dispatchEvent('diary:createObject', {
                tool: toolId,
                coords: { 
                    x: 0.2, 
                    y: 0.2, 
                    width: toolDef.defaultSize?.width || 0.15,
                    height: toolDef.defaultSize?.height || 0.15,
                    rotation: 0 
                },
                pageId: targetPageId,
                data: undefined,
            });
        }
    };

    const gardenTools = [
        { name: 'Plant a Seed', icon: 'Leaf', action: () => handleAddTool('plant'), disabled: disabled },
        { name: 'Add Book Cover', icon: 'BookOpen', action: () => {}, disabled: true },
        { name: 'Add Piece Cover', icon: 'FileText', action: () => {}, disabled: true },
    ];

    return (
        <Card className="bg-transparent border-yellow-800/70">
            <CardContent className="p-2 space-y-2">
                <h4 className="text-xs font-medium text-yellow-200/70 ml-1 uppercase tracking-wider">Functional Widgets</h4>
                <TooltipProvider>
                    <div className="grid grid-cols-4 gap-2">
                        {gardenTools.map((tool) => (
                            <Tooltip key={tool.name}>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={tool.action}
                                        disabled={tool.disabled}
                                        className="h-10 w-full bg-black/10 border-white/10 text-white/80 hover:bg-white/10 hover:text-white"
                                        aria-label={tool.name}
                                    >
                                        <Icon name={tool.icon as any} className="h-5 w-5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{tool.name}</p>
                                </TooltipContent>
                            </Tooltip>
                        ))}
                    </div>
                </TooltipProvider>
            </CardContent>
        </Card>
    );
};
