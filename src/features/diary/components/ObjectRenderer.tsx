// src/features/diary/components/ObjectRenderer.tsx

'use client';

import React, { useRef, useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { DiaryObject, TextObject, ImageObject, LineObject, StickerObject, DrawingStroke, DrawingObject } from '@/features/diary/types';
import type { FoundationContainer } from '../foundation/foundation-container';
import { Icon } from '@/components/ui/icons';
import { applyAutoFormatting } from '@/services/text-formatting.service';
import { PlantObject as PlantObjectComponent } from './PlantObject';
import { diaryEventManager } from '../foundation/event-manager';
import { InteractionEvent } from '../foundation/interaction-state-machine';
import { getFormattedDate } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import * as diaryService from '@/services/diary-service';
import { useAuth } from '@/contexts/auth-context';


const RESIZE_HANDLE_SIZE = 12;

interface DateMarkerContentProps {
  date: Date;
}

const MOOD_OPTIONS = ['😊', '😄', '😔', '😠', '🥰', '🤔', '😐'];


const DateMarkerContent: React.FC<DateMarkerContentProps> = ({ date }) => {
    return (
        <div className="w-full h-full flex items-center justify-center p-2 bg-amber-50 dark:bg-amber-900/20 rounded-md border border-amber-200 dark:border-amber-800/50">
            <div className="text-center relative">
                <p className="font-headline font-bold text-lg text-amber-800 dark:text-amber-200">{date.toLocaleDateString(undefined, { weekday: 'long' })}</p>
                <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">{date.getDate()}</p>
                <p className="text-sm text-amber-700 dark:text-amber-300">{date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</p>
            </div>
        </div>
    );
};

interface ObjectRendererProps {
  object: DiaryObject;
  pageId: string;
  pageSize: { width: number, height: number };
  foundation: FoundationContainer;
  isSelected: boolean;
}


export const ObjectRenderer: React.FC<ObjectRendererProps> = React.memo(({
  object,
  pageId,
  pageSize,
  foundation,
  isSelected,
}) => {
  const objectRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textContentRef = useRef<HTMLDivElement>(null);
  const [isEditingText, setIsEditingText] = useState(false);
  const { user } = useUser();

  // Track if we're currently saving to prevent race conditions
  const [isSaving, setIsSaving] = useState(false);
  
  const interactionContext = foundation.stateMachine.getContext();
  const isViewMode = foundation.stateMachine.isViewMode();
  const isDrawingOnThisObject = foundation.stateMachine.getCurrentState() === 'drawing' && interactionContext.drawingObjectId === object.id;
  const isDraggingThisObject = foundation.dragManager.isDragging(object.id);

  const onUpdate = useCallback(async (id: string, updates: Partial<DiaryObject>) => {
    try {
      setIsSaving(true);
      await foundation.handleObjectUpdate(id, updates);
    } catch (error) {
    } finally {
      setIsSaving(false);
    }
  }, [foundation]);

  // Sync DOM with object state when not editing
  useEffect(() => {
    if (object.type === 'text' && !isEditingText) {
      const currentContent = (object as TextObject).content || '<p>New Text</p>';
      if (textContentRef.current && textContentRef.current.innerHTML !== currentContent) {
        textContentRef.current.innerHTML = currentContent;
      }
    }
  }, [object, isEditingText]);

  // Enhanced function to save text content properly
  const saveTextContent = useCallback(async () => {
    if (!textContentRef.current || object.type !== 'text' || isSaving) return;
    
    const rawHTML = textContentRef.current.innerHTML;
    const formattedHTML = applyAutoFormatting(rawHTML);
    
    const currentObjectContent = (object as TextObject).content || '<p>New Text</p>';
    if (formattedHTML !== currentObjectContent && formattedHTML.trim() !== '') {
      await onUpdate(object.id, { content: formattedHTML });
    }
  }, [onUpdate, object, isSaving]);

  const endTextEditingMode = useCallback(async () => {
    if (isEditingText) {
      await saveTextContent();
      setIsEditingText(false);
      
      if (foundation.stateMachine.can(InteractionEvent.END_INTERACTION)) {
        foundation.stateMachine.trigger(InteractionEvent.END_INTERACTION);
      }
    }
  }, [isEditingText, saveTextContent, foundation.stateMachine]);

  const startTextEditingMode = useCallback(() => {
    if (object.type === 'text' && !isEditingText) {
      setIsEditingText(true);
            
      if (textContentRef.current) {
        const currentContent = (object as TextObject).content || '<p>New Text</p>';
        textContentRef.current.innerHTML = currentContent;
      }
      
      if (foundation.stateMachine.can(InteractionEvent.START_CONTENT_EDIT, { objectId: object.id })) {
        foundation.stateMachine.trigger(InteractionEvent.START_CONTENT_EDIT, { objectId: object.id });
      }
    }
  }, [object, isEditingText, foundation.stateMachine]);

  const handleTextBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    setTimeout(async () => {
        const activeElement = document.activeElement;
        const isStillInTextArea = textContentRef.current?.contains(activeElement);

        if (!isStillInTextArea && isEditingText) {
            const isOnToolbar = activeElement?.closest('[data-radix-popper-content-wrapper]') ||
                              activeElement?.closest('.contextual-toolbar');
            
            if (!isOnToolbar) {
                await endTextEditingMode();
            }
        }
    }, 0);
  }, [isEditingText, endTextEditingMode]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (isViewMode) return;
    
    if (object.type === 'text') {
      const isClickOnContent = e.target === textContentRef.current || textContentRef.current?.contains(e.target as Node);
      if (isSelected && isClickOnContent && !isEditingText) {
        startTextEditingMode();
        return;
      }
    }

    if (foundation.coordinator) {
      foundation.coordinator.handlePointerDown(e.nativeEvent);
    }
  }, [isViewMode, object, isSelected, isEditingText, startTextEditingMode, foundation.coordinator]);

  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (isViewMode || object.type !== 'text') return;
    startTextEditingMode();
  }, [isViewMode, object, startTextEditingMode]);

  // Listen for state machine events
  useEffect(() => {
    const handleStartEditing = (e: CustomEvent) => {
        if (e.detail && e.detail.objectId === object.id) {
            setIsEditingText(true);
            
            if (textContentRef.current) {
              const currentContent = (object as TextObject).content || '<p>New Text</p>';
              textContentRef.current.innerHTML = currentContent;
            }
        }
    };
    
    const handleStateChange = (detail: any) => {
        const isMyObjectBeingEdited = detail.context.editingObjectId === object.id;
        const isNowInEditingState = detail.to === 'editing_content';

        if (isNowInEditingState && isMyObjectBeingEdited && !isEditingText) {
            startTextEditingMode();
        } else if ((!isNowInEditingState || !isMyObjectBeingEdited) && isEditingText) {
            endTextEditingMode();
        }
    };

    const unsubscribeState = diaryEventManager.addEventListener('diary:stateChange', handleStateChange as any);
    const unsubscribeEdit = diaryEventManager.addEventListener('diary:startTextEdit', handleStartEditing as any);
    
    return () => {
      unsubscribeState();
      unsubscribeEdit();
    };
  }, [object.id, object, isEditingText, endTextEditingMode, startTextEditingMode]);

  // Focus the contentEditable div when isEditingText becomes true
  useEffect(() => {
      if (isEditingText && textContentRef.current) {
          setTimeout(() => {
            if (textContentRef.current) {
              textContentRef.current.focus();
              const range = document.createRange();
              const selection = window.getSelection();
              range.selectNodeContents(textContentRef.current);
              range.collapse(false);
              selection?.removeAllRanges();
              selection?.addRange(range);
            }
          }, 10);
      }
  }, [isEditingText, object.id]);

  // Handle selection changes
  useEffect(() => {
    const handleSelectionChange = (detail: { to: string[] }) => {
      const isThisObjectSelected = detail.to.includes(object.id);
      
      if (isEditingText && !isThisObjectSelected) {
        const isTextAreaFocused = textContentRef.current?.contains(document.activeElement);
        
        if (!isTextAreaFocused) {
          endTextEditingMode();
        }
      }
    };

    const unsubscribeSelection = diaryEventManager.addEventListener('selection:changed', handleSelectionChange);
    
    return () => {
      unsubscribeSelection();
    };
  }, [isEditingText, object.id, endTextEditingMode]);

  useEffect(() => {
    if (object.type === 'drawing' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const rect = canvas.getBoundingClientRect();
        if (canvas.width !== rect.width || canvas.height !== rect.height) {
          canvas.width = rect.width;
          canvas.height = rect.height;
        }
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const drawingObject = object as DrawingObject;
        const strokes = drawingObject.content.strokes || [];
        strokes.forEach((stroke: DrawingStroke) => {
          ctx.beginPath();
          ctx.strokeStyle = stroke.color;
          ctx.lineWidth = stroke.width;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          
          stroke.points.forEach((point, index) => {
            const x = point.x * canvas.width;
            const y = point.y * canvas.height;
            if (index === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          });
          ctx.stroke();
        });
      }
    }
  }, [object, pageSize]);
  
  const getObjectStyle = (): React.CSSProperties => {
    const liveTransform = isDraggingThisObject ? foundation.dragManager.getLiveTransform(object.id) : null;
    const transformSource = liveTransform || object.transform;

    return {
      position: 'absolute',
      left: `${transformSource.x * 100}%`,
      top: `${transformSource.y * 100}%`,
      width: `${transformSource.width * 100}%`,
      height: `${transformSource.height * 100}%`,
      transform: `rotate(${transformSource.rotation || 0}deg)`,
      zIndex: isSelected ? 50 : (isDraggingThisObject ? 999 : object.zIndex || 1),
      cursor: isDrawingOnThisObject ? 'crosshair' : 'default',
    };
  };

  const renderContent = useCallback(() => {
    switch (object.type) {
      case 'text':
        const textObject = object as TextObject;
        
        try {
            const contentJson = JSON.parse(textObject.content);
            if (contentJson.type === 'dateMarker') {
                return <DateMarkerContent 
                            date={new Date(contentJson.date)} 
                        />;
            }
        } catch (e) {
            // Not a JSON object, treat as regular text
        }
        
        const textStyle: React.CSSProperties = {
          ...(textObject.style || {}),
          fontSize: textObject.style?.fontSize || 14,
          textAlign: textObject.style?.textAlign || 'left',
        };
        
        return (
          <div
            ref={textContentRef}
            data-text-content="true"
            contentEditable={isEditingText}
            suppressContentEditableWarning
            onBlur={handleTextBlur}
            onPointerDown={(e) => {
                if (isEditingText) {
                    e.stopPropagation();
                }
            }}
            className={cn(
              "w-full h-full p-2 outline-none resize-none font-body leading-relaxed",
              isEditingText ? "cursor-text bg-white/95 backdrop-blur-sm border border-primary/50 rounded" : "cursor-default"
            )}
            style={textStyle}
            dangerouslySetInnerHTML={{ __html: textObject.content || '<p>New Text</p>' }}
          />
        );
      case 'sticker':
        return (
          <div 
            className="w-full h-full flex items-center justify-center select-none"
            style={{ fontSize: Math.min(Number(object.transform.width) * Number(pageSize.width), Number(object.transform.height) * Number(pageSize.height)) * 0.8 }}
          >
            {(object as StickerObject).content.emoji}
          </div>
        );
      case 'image':
        const imageSrc = (object as ImageObject).content.src;
        return (
          <div className="w-full h-full relative overflow-hidden rounded-md bg-muted">
            {imageSrc ? (
                 <img
                  src={imageSrc} 
                  alt={(object as ImageObject).content.alt || "diary image"} 
                  className="w-full h-full object-cover pointer-events-none" 
                  draggable={false}
                />
            ) : (
                <div className="w-full h-full flex items-center justify-center">
                    <Icon name="Image" className="h-8 w-8 text-muted-foreground" />
                </div>
            )}
          </div>
        );
      case 'line':
        const lineObject = object as LineObject;
        return (
          <div className="w-full h-full flex items-center justify-center">
            <svg width="100%" height="100%" className="overflow-visible">
              <line 
                x1="0" y1="50%" x2="100%" y2="50%" 
                stroke={lineObject.style?.color || '#000'} 
                strokeWidth={lineObject.style?.width || 2}
              />
            </svg>
          </div>
        );
      case 'drawing':
        return (
          <canvas
            ref={canvasRef}
            className="w-full h-full"
            data-drawing-canvas-id={object.id}
          />
        );
      case 'plant':
        return <PlantObjectComponent object={object} onUpdate={onUpdate} isInteractive={!isViewMode} />;
      default:
        return <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">Unknown Object</div>;
    }
  }, [object, isEditingText, pageSize, handleTextBlur, onUpdate, isViewMode, user, pageId]);

  const renderResizeHandles = useCallback(() => {
    if (!isSelected || isViewMode || !object.behavior.isResizable || isEditingText) return null;
    const handles = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
    return handles.map((pos) => (
      <div
        key={pos}
        data-resize-handle={pos}
        className={cn(
          "absolute bg-primary border-2 border-white rounded-full shadow-sm z-50 hover:scale-110 transition-transform",
          pos.includes('top') && '-top-1.5',
          pos.includes('bottom') && '-bottom-1.5',
          pos.includes('left') && '-left-1.5',
          pos.includes('right') && '-right-1.5',
        )}
        style={{ 
          width: RESIZE_HANDLE_SIZE, 
          height: RESIZE_HANDLE_SIZE, 
          cursor: `${pos.split('-')[0][0]}${pos.split('-')[1][0]}-resize` 
        }}
      />
    ));
  }, [isSelected, isViewMode, object.behavior.isResizable, isEditingText]);

  const renderDragHandle = useCallback(() => {
    if (object.type !== 'text' || !isSelected || isEditingText) return null;
    return (
        <div
            data-drag-handle="true"
            className="absolute -top-3 left-1/2 -translate-x-1/2 p-1 cursor-grab bg-background rounded-full shadow border"
        >
            <Icon name="Grip" className="h-3 w-3 text-muted-foreground" />
        </div>
    )
  }, [object.type, isSelected, isEditingText]);

  return (
    <div
      ref={objectRef}
      onPointerDown={handlePointerDown}
      onDoubleClick={handleDoubleClick}
      data-diary-object-id={object.id}
      data-object-type={object.type}
      data-page-id={pageId}
      className={cn(
        "select-none group",
        !isViewMode && isSelected && "ring-2 ring-primary ring-offset-1 z-40",
        isDrawingOnThisObject && "cursor-crosshair",
        object.type !== 'sticker' && object.type !== 'plant' && object.type !== 'drawing' && 'bg-white/90 backdrop-blur-sm rounded-md shadow-sm',
        isEditingText && "ring-2 ring-blue-500 ring-offset-1" // Visual feedback when editing
      )}
      style={getObjectStyle()}
    >
      {renderContent()}
      {renderResizeHandles()}
      {renderDragHandle()}
    </div>
  );
}, (prevProps, nextProps) => {
    // Custom comparator function for React.memo
    const { object: prevObj, isSelected: prevIsSelected, foundation: prevFoundation } = prevProps;
    const { object: nextObj, isSelected: nextIsSelected, foundation: nextFoundation } = nextProps;

    const isSameObjectCore = 
        prevObj.id === nextObj.id &&
        prevObj.zIndex === nextObj.zIndex &&
        prevObj.transform?.x === nextObj.transform?.x &&
        prevObj.transform?.y === nextObj.transform?.y &&
        prevObj.transform?.width === nextObj.transform?.width &&
        prevObj.transform?.height === nextObj.transform?.height &&
        (prevObj.type !== 'text' || (prevObj as TextObject).content === (nextObj as TextObject).content);

    const isDraggingPrev = prevFoundation.dragManager.isDragging(prevObj.id);
    const isDraggingNext = nextFoundation.dragManager.isDragging(nextObj.id);
        
    return isSameObjectCore && prevIsSelected === nextIsSelected && isDraggingPrev === isDraggingNext;
});

ObjectRenderer.displayName = 'ObjectRenderer';
