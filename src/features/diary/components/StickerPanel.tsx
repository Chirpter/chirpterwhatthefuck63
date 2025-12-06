// src/features/diary/components/StickerPanel.tsx

'use client';

import React, { useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DiaryToolManager } from '../business/managers/tool-manager';
import type { DiaryTool } from '../types';
import { diaryEventManager } from '../foundation/event-manager';
import Image from 'next/image';

interface StickerPanelProps {
  disabled: boolean;
  lastInteractedPageId: string | null;
  visiblePageIds: string[];
}

export const StickerPanel: React.FC<StickerPanelProps> = ({ disabled, lastInteractedPageId, visiblePageIds }) => {
    const stickers = [
        '🌸', '⭐', '❤️', '✨',
        '😊', '😍', '😎', '🥳',
    ];
    const toolManager = DiaryToolManager.getInstance();

    const handleStickerClick = useCallback((sticker: string) => {
        const targetPageId = lastInteractedPageId || (visiblePageIds.length > 0 ? visiblePageIds[0] : null);
        if (!disabled && targetPageId) {
            const toolDef = toolManager.getTool('sticker');
            if (toolDef) {
                 diaryEventManager.dispatchEvent('diary:createObject', {
                    tool: 'sticker',
                    coords: { 
                        x: 0.2, 
                        y: 0.2, 
                        width: toolDef.defaultSize?.width || 0.1,
                        height: toolDef.defaultSize?.height || 0.1,
                        rotation: 0 
                    },
                    pageId: targetPageId,
                    data: sticker
                });
            }
        }
    }, [disabled, toolManager, lastInteractedPageId, visiblePageIds]);

    return (
        <Card className="bg-transparent border-yellow-700/60">
            <CardContent className="p-2 space-y-2">
                 <h4 className="text-xs font-medium text-yellow-200/70 ml-1 uppercase tracking-wider">Stickers</h4>
                <div className="grid grid-cols-4 gap-2">
                    {stickers.map((sticker, i) => (
                        <Button 
                            key={i} 
                            variant={'ghost'} 
                            className="text-2xl h-10 w-full rounded-lg transition-all hover:scale-110 bg-black/10 text-white/80 hover:bg-white/10 hover:text-white" 
                            aria-label={`sticker ${sticker}`} 
                            onClick={() => handleStickerClick(sticker)} 
                            disabled={disabled}
                        >
                            {sticker}
                        </Button>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};
