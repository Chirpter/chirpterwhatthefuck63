// src/features/diary/foundation/interaction-state-machine.ts

import { diaryEventManager } from './event-manager';
import type { DiaryTool, DiaryGeometry } from '../types';

export enum InteractionState {
  VIEW = 'view',
  EDIT = 'edit', 
  TOOL_ACTIVE = 'tool_active',
  EDITING_CONTENT = 'editing_content',
  DRAWING = 'drawing',
}

export enum InteractionEvent {
  ENTER_EDIT_MODE = 'enter_edit_mode',
  ENTER_VIEW_MODE = 'enter_view_mode',
  SELECT_TOOL = 'select_tool',
  START_CONTENT_EDIT = 'start_content_edit',
  START_DRAWING = 'start_drawing',
  END_INTERACTION = 'end_interaction',
  CANCEL_INTERACTION = 'cancel_interaction',
}

export interface StateContext {
  activeTool?: DiaryTool;
  activeToolData?: any;
  selectedObjectIds: string[];
  dragState?: any;
  editingObjectId?: string;
  drawingObjectId?: string;
  drawingPageId?: string;
  toolbarPosition?: { x: number; y: number };
}

interface StateTransition {
  from: InteractionState | InteractionState[];
  to: InteractionState;
  event: InteractionEvent;
  guard?: (context: StateContext, payload?: any) => boolean;
  action?: (context: StateContext, payload?: any) => StateContext;
}

export class InteractionStateMachine {
  private currentState: InteractionState = InteractionState.VIEW;
  private context: StateContext = { selectedObjectIds: [] };
  private isDestroyed = false;
  
  private transitions: StateTransition[] = [
    { from: InteractionState.VIEW, to: InteractionState.EDIT, event: InteractionEvent.ENTER_EDIT_MODE },
    
    { 
      from: [
        InteractionState.EDIT, 
        InteractionState.TOOL_ACTIVE,
        InteractionState.EDITING_CONTENT,
        InteractionState.DRAWING
      ], 
      to: InteractionState.VIEW, 
      event: InteractionEvent.ENTER_VIEW_MODE,
      action: (ctx) => ({ 
        ...ctx, 
        selectedObjectIds: [], 
        activeTool: undefined, 
        activeToolData: undefined,
        editingObjectId: undefined,
        drawingObjectId: undefined
      }) 
    },
    
    { 
      from: [InteractionState.EDIT, InteractionState.TOOL_ACTIVE], 
      to: InteractionState.TOOL_ACTIVE, 
      event: InteractionEvent.SELECT_TOOL,
      action: (ctx, payload) => ({ 
        ...ctx, 
        activeTool: payload?.tool, 
        activeToolData: payload?.data, 
        selectedObjectIds: [] 
      }) 
    },
    { 
      from: InteractionState.EDIT, 
      to: InteractionState.EDITING_CONTENT, 
      event: InteractionEvent.START_CONTENT_EDIT,
      guard: (ctx, payload) => !!payload?.objectId,
      action: (ctx, payload) => ({
        ...ctx, 
        editingObjectId: payload.objectId, 
        selectedObjectIds: [payload.objectId]
      })
    },
    
    { 
      from: InteractionState.TOOL_ACTIVE, 
      to: InteractionState.EDIT, 
      event: InteractionEvent.CANCEL_INTERACTION,
      action: (ctx) => ({ ...ctx, activeTool: undefined, activeToolData: undefined })
    },
    { 
      from: InteractionState.EDIT, 
      to: InteractionState.DRAWING, 
      event: InteractionEvent.START_DRAWING,
      guard: (ctx, payload) => !!payload?.objectId,
      action: (ctx, payload) => ({...ctx, drawingObjectId: payload?.objectId, drawingPageId: payload?.pageId, selectedObjectIds: [payload?.objectId] })
    },
    
    { 
      from: [
        InteractionState.EDITING_CONTENT, 
        InteractionState.DRAWING
      ], 
      to: InteractionState.EDIT, 
      event: InteractionEvent.END_INTERACTION,
      action: (ctx) => ({...ctx, editingObjectId: undefined, drawingObjectId: undefined, drawingPageId: undefined})
    },
    { 
      from: [
        InteractionState.EDITING_CONTENT, 
        InteractionState.DRAWING
      ], 
      to: InteractionState.EDIT, 
      event: InteractionEvent.CANCEL_INTERACTION,
      action: (ctx) => ({...ctx, editingObjectId: undefined, drawingObjectId: undefined, drawingPageId: undefined})
    },
  ];

  destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
  }

  getCurrentState(): InteractionState {
    return this.currentState;
  }

  getContext(): StateContext {
    return { ...this.context };
  }

  can(event: InteractionEvent, payload?: any): boolean {
    if (this.isDestroyed) return false;
    
    return this.transitions.some(t => {
      const fromMatches = Array.isArray(t.from) 
        ? t.from.includes(this.currentState)
        : t.from === this.currentState;
      
      return fromMatches && t.event === event && (!t.guard || t.guard(this.context, payload));
    });
  }

  trigger(event: InteractionEvent, payload?: any): boolean {
    if (this.isDestroyed) return false;
    
    const transition = this.transitions.find(t => {
      const fromMatches = Array.isArray(t.from) 
        ? t.from.includes(this.currentState)
        : t.from === this.currentState;
      return fromMatches && t.event === event && (!t.guard || t.guard(this.context, payload));
    });

    if (!transition) {
      return false;
    }
    
    const previousState = this.currentState;
    
    if (transition.action) {
      this.context = transition.action(this.context, payload);
    }
    
    this.currentState = transition.to;
    
    if (previousState !== this.currentState) {
        diaryEventManager.dispatchEvent('diary:stateChange', {
            from: previousState,
            to: this.currentState,
            context: this.context
        });
    }

    if (event === InteractionEvent.START_CONTENT_EDIT) {
      diaryEventManager.dispatchEvent('diary:startTextEdit', { objectId: payload?.objectId, objectType: 'text' });
    }

    return true;
  }

  getCapabilities() {
    if (this.isDestroyed) {
      return { 
        canFlipPages: false, 
        canSelectObjects: false, 
        canDragObjects: false, 
        canResizeObjects: false, 
        canEditContent: false, 
        canCreateObjects: false, 
        canDrawStrokes: false, 
        canDeleteObjects: false 
      };
    }
    
    switch (this.currentState) {
      case InteractionState.VIEW:
        return { 
          canFlipPages: true, 
          canSelectObjects: false, 
          canDragObjects: false, 
          canResizeObjects: false, 
          canEditContent: false, 
          canCreateObjects: false, 
          canDrawStrokes: false, 
          canDeleteObjects: false 
        };
      case InteractionState.EDIT:
        return { 
          canFlipPages: false, 
          canSelectObjects: true, 
          canDragObjects: true, 
          canResizeObjects: true, 
          canEditContent: true, 
          canCreateObjects: true, 
          canDrawStrokes: false, 
          canDeleteObjects: true 
        };
      case InteractionState.TOOL_ACTIVE:
        return { 
          canFlipPages: false, 
          canSelectObjects: false, 
          canDragObjects: false, 
          canResizeObjects: false, 
          canEditContent: false, 
          canCreateObjects: true, 
          canDrawStrokes: this.context.activeTool === 'drawing', 
          canDeleteObjects: false 
        };
      case InteractionState.EDITING_CONTENT:
        return { 
          canFlipPages: false, 
          canSelectObjects: false, 
          canDragObjects: false, 
          canResizeObjects: false, 
          canEditContent: true, 
          canCreateObjects: false, 
          canDrawStrokes: false, 
          canDeleteObjects: true 
        };
      case InteractionState.DRAWING:
        return { 
          canFlipPages: false, 
          canSelectObjects: false, 
          canDragObjects: false, 
          canResizeObjects: false, 
          canEditContent: false, 
          canCreateObjects: false, 
          canDrawStrokes: true, 
          canDeleteObjects: false 
        };
      default:
        return { 
          canFlipPages: false, 
          canSelectObjects: false, 
          canDragObjects: false, 
          canResizeObjects: false, 
          canEditContent: false, 
          canCreateObjects: false, 
          canDrawStrokes: false, 
          canDeleteObjects: false 
        };
    }
  }
  
  isViewMode(): boolean { 
    return this.currentState === InteractionState.VIEW; 
  }
  
  isEditMode(): boolean { 
    return this.currentState === InteractionState.EDIT; 
  }
  
  isInteracting(): boolean {
    const isBaseInteracting = [
      InteractionState.EDITING_CONTENT,
      InteractionState.DRAWING
    ].includes(this.currentState);
    
    const isDragging = this.dragManager ? this.dragManager.isDragging() : false;

    return isBaseInteracting || isDragging;
  }

  private _dragManager: any;
  public setDragManager(dm: any) { this._dragManager = dm; }
  private get dragManager() { return this._dragManager; }

  
  selectObjects(objectIds: string[], isMulti: boolean = false): void {
    if (this.isDestroyed || !this.getCapabilities().canSelectObjects) {
      return;
    }
    
    const validIds = Array.isArray(objectIds) ? objectIds.filter(id => typeof id === 'string') : [];
    
    let newSelection: string[];
    const previousSelection = [...this.context.selectedObjectIds];

    if (isMulti) {
      const currentSelection = new Set(this.context.selectedObjectIds);
      validIds.forEach(id => {
        if (currentSelection.has(id)) {
          currentSelection.delete(id);
        } else {
          currentSelection.add(id);
        }
      });
      newSelection = Array.from(currentSelection);
    } else {
      newSelection = validIds;
    }
    
    const hasChanged = !(previousSelection.length === newSelection.length && 
                       previousSelection.every((id, index) => id === newSelection[index]));
    
    if (!hasChanged) {
      return;
    }

    this.context.selectedObjectIds = newSelection;
    
    diaryEventManager.dispatchEvent('selection:changed', {
        from: previousSelection,
        to: newSelection
    });
  }
}
