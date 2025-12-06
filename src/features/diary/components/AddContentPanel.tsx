// src/features/diary/components/AddContentPanel.tsx

'use client';

import React, { useRef, useCallback, useEffect, useState } from 'react';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { InteractionStateMachine, InteractionEvent, InteractionState } from '../foundation/interaction-state-machine';
import type { DiaryTool } from '../types';
import { DiaryToolManager } from '../business/managers/tool-manager';
import { diaryEventManager } from '../foundation/event-manager';

interface AddContentPanelProps {
  stateMachine: InteractionStateMachine;
  lastInteractedPageId: string | null;
  visiblePageIds: string[];
}

export const AddContentPanel: React.FC<AddContentPanelProps> = React.memo(({ stateMachine, lastInteractedPageId, visiblePageIds }) => {
    const imageInputRef = useRef<HTMLInputElement>(null);
    const toolManager = DiaryToolManager.getInstance();
    const [currentState, setCurrentState] = useState(stateMachine.getCurrentState());

    useEffect(() => {
        const handleStateChange = (detail: any) => {
            setCurrentState(detail.to);
        };

        const unsubscribe = diaryEventManager.addEventListener('diary:stateChange', handleStateChange as any);
        return () => {
            unsubscribe();
        };
    }, [stateMachine]);

    const isEditMode = currentState === 'edit';
    
    const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        const targetPageId = lastInteractedPageId || (visiblePageIds.length > 0 ? visiblePageIds[0] : null);
        if (file && targetPageId) {
            const reader = new FileReader();
            reader.onload = (loadEvent) => {
                if (loadEvent.target?.result) {
                    const toolDef = toolManager.getTool('image');
                    diaryEventManager.dispatchEvent('diary:createObject' as any, {
                        tool: 'image',
                        coords: { 
                            x: 0.15, y: 0.15, 
                            width: toolDef?.defaultSize?.width || 0.25,
                            height: toolDef?.defaultSize?.height || 0.15,
                            rotation: 0 
                        },
                        pageId: targetPageId,
                        data: loadEvent.target.result
                    }, { async: true });
                }
            };
            reader.readAsDataURL(file);
        }
    };
    
    const handleToolClick = useCallback((toolId: DiaryTool) => {
        if (!isEditMode) {
            return;
        }

        const toolDef = toolManager.getTool(toolId);
        const targetPageId = lastInteractedPageId || (visiblePageIds.length > 0 ? visiblePageIds[0] : null);
        
        if (!targetPageId) {
            return;
        }
        
        if (toolDef?.config?.requiresFileInput && toolId === 'image') {
            imageInputRef.current?.click();
        } else {
            diaryEventManager.dispatchEvent('diary:createObject' as any, {
                tool: toolId,
                coords: { 
                    x: 0.15, 
                    y: 0.15, 
                    width: toolDef?.defaultSize?.width || 0.25,
                    height: toolDef?.defaultSize?.height || 0.15,
                    rotation: 0 
                },
                pageId: targetPageId,
                data: undefined
            }, { async: true });
        }
    }, [isEditMode, lastInteractedPageId, visiblePageIds, toolManager]);

    const toolCategories = toolManager.getToolCategories();

    return (
        <Card className="shadow-none bg-transparent border-yellow-300/30">
            <CardContent className="p-2">
                <TooltipProvider>
                    <input type="file" ref={imageInputRef} onChange={handleImageFileChange} className="hidden" accept="image/*" />
                    <div className="space-y-4">
                        {toolCategories.map((category) => (
                             <Card key={category.name} className={cn("bg-transparent", category.borderColor)}>
                                <CardContent className="p-2 space-y-2">
                                    <h4 className="text-xs font-medium text-yellow-200/70 ml-1 uppercase tracking-wider">{category.name}</h4>
                                    <div className="grid grid-cols-4 gap-2">
                                        {category.tools.map(tool => (
                                            <Tooltip key={tool.id}>
                                                <TooltipTrigger asChild>
                                                    <Button 
                                                        variant="outline"
                                                        size="icon"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            handleToolClick(tool.id);
                                                        }}
                                                        disabled={!isEditMode} 
                                                        className="h-10 w-full bg-black/10 border-white/10 text-white/80 hover:bg-white/10 hover:text-white"
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
                                </CardContent>
                             </Card>
                        ))}
                    </div>
                </TooltipProvider>
            </CardContent>
        </Card>
    );
});
AddContentPanel.displayName = "AddContentPanel";
