// src/features/diary/components/DiarySidebar.tsx

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icons';
import { InteractionEvent } from '../foundation/interaction-state-machine';
import type { FoundationContainer } from '../foundation/foundation-container';
import { AddContentPanel } from './AddContentPanel';
import { StickerPanel } from './StickerPanel';
import { WateringGamePanel } from './WateringGamePanel';
import { cn } from '@/lib/utils';
import { diaryEventManager } from '../foundation/event-manager';
import { DiaryToolManager } from '../business/managers/tool-manager';

interface DiarySidebarProps {
  foundation: FoundationContainer;
  lastInteractedPageId: string | null;
  visiblePageIds: string[];
}

export const DiarySidebar: React.FC<DiarySidebarProps> = React.memo(({ foundation, lastInteractedPageId, visiblePageIds }) => {
  const { stateMachine } = foundation;
  const [isViewMode, setIsViewMode] = useState(stateMachine.isViewMode());
  const [capabilities, setCapabilities] = useState(stateMachine.getCapabilities());

  useEffect(() => {
    const handleStateChange = (detail: any) => {
      setIsViewMode(detail.to === 'view');
      setCapabilities(stateMachine.getCapabilities());
    };

    const unsubscribe = diaryEventManager.addEventListener('diary:stateChange', handleStateChange as any);
    
    return () => {
      unsubscribe();
    };
  }, [stateMachine]);

  const handleToggleEditMode = () => {
    const currentIsViewMode = stateMachine.isViewMode();
    const event = currentIsViewMode ? InteractionEvent.ENTER_EDIT_MODE : InteractionEvent.ENTER_VIEW_MODE;
    if (stateMachine.can(event)) {
      stateMachine.trigger(event);
    }
  };
  
  const handleAddDate = () => {
    const targetPageId = lastInteractedPageId || (visiblePageIds.length > 0 ? visiblePageIds[0] : null);
    if (isViewMode || !targetPageId) return;
    
    const toolManager = DiaryToolManager.getInstance();
    const toolDef = toolManager.getTool('dateMarker');
    if (toolDef) {
        diaryEventManager.dispatchEvent('diary:createObject', {
            tool: 'dateMarker',
            coords: { 
                x: 0.2, 
                y: 0.05, 
                width: toolDef.defaultSize?.width || 0.6,
                height: toolDef.defaultSize?.height || 0.1,
                rotation: 0 
            },
            pageId: targetPageId,
            data: undefined,
        });
    }
  };

  return (
    <div className="flex flex-col space-y-3">
      <Card className="shadow-none bg-transparent border-yellow-300/30">
        <CardContent className="p-2 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" asChild className="h-12 w-12 text-white hover:bg-white/10">
              <Link href="/library/book">
                <Icon name="Home" className="w-7 h-7" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" onClick={handleAddDate} disabled={isViewMode} className="h-12 w-12 text-white hover:bg-white/10">
              <Icon name="Calendar" className="w-6 h-6" />
            </Button>
          </div>
          <Button
            onClick={handleToggleEditMode}
            variant={!isViewMode ? "default" : "outline"}
            size="lg"
            className={cn(
              !isViewMode
                ? "bg-yellow-400 text-yellow-900 hover:bg-yellow-300"
                : "bg-black/20 border-white/20 text-white hover:bg-white/10"
            )}
          >
            {!isViewMode ? <Icon name="Check" className="mr-2" /> : <Icon name="Edit" className="mr-2" />}
            {!isViewMode ? 'Done' : 'Edit'}
          </Button>
        </CardContent>
      </Card>
      
      <AddContentPanel 
        stateMachine={stateMachine}
        lastInteractedPageId={lastInteractedPageId}
        visiblePageIds={visiblePageIds}
      />
      <StickerPanel 
        disabled={!capabilities.canCreateObjects} 
        lastInteractedPageId={lastInteractedPageId}
        visiblePageIds={visiblePageIds}
      />
      <WateringGamePanel 
        disabled={!capabilities.canCreateObjects} 
        lastInteractedPageId={lastInteractedPageId}
        visiblePageIds={visiblePageIds}
      />
    </div>
  );
});

DiarySidebar.displayName = "DiarySidebar";
