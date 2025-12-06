// src/features/diary/foundation/interaction-coordinator.ts

import type { DiaryObject, DiaryGeometry, ObjectZone, StrictInteractionEvent, ResizeHandle, KeyboardModifiers, DiaryObjectType, DrawingStroke } from '../types';
import { InteractionStateMachine, InteractionEvent } from './interaction-state-machine';
import type { ViewportEngine } from './viewport-engine';
import type { ObjectLifecycleManager } from './object-lifecycle-manager';
import type { ObjectInteractionStrategy } from '../types';
import { InteractionType } from '../types';
import { diaryEventManager } from './event-manager';
import type { DiaryDragManager } from './drag-manager';
import * as Strategies from '../business/strategies';

interface CoordinatorDependencies {
  stateMachine: InteractionStateMachine;
  viewport: ViewportEngine;
  objects: ObjectLifecycleManager;
  pageSize: { width: number; height: number };
  dragManager: DiaryDragManager;
  handleObjectUpdate: (id: string, updates: Partial<DiaryObject>) => void;
  handleObjectDelete: (id: string, updates?: Partial<DiaryObject>) => void;
}

interface PointerDownContext {
    targetPageId?: string;
}

// Custom click tracking interface
interface ClickTracker {
  objectId: string;
  timestamp: number;
  clickCount: number;
}

export class InteractionCoordinator {
  private stateMachine: InteractionStateMachine;
  private viewportEngine: ViewportEngine;
  private objectManager: ObjectLifecycleManager;
  private dragManager: DiaryDragManager;
  private handleObjectUpdate: (id: string, updates: Partial<DiaryObject>) => void;
  private handleObjectDelete: (id: string, updates?: Partial<DiaryObject> | undefined) => void;
  
  private strategies = new Map<string, ObjectInteractionStrategy>();

  private isDestroyed = false;
  private pointerDownContext: PointerDownContext = {};
  private pageSize: { width: number, height: number };

  // Custom double-click detection
  private lastClick: ClickTracker | null = null;
  private readonly DOUBLE_CLICK_THRESHOLD = 500; // ms
  private readonly DOUBLE_CLICK_DISTANCE_THRESHOLD = 10; // pixels
  private lastPointerPosition: { x: number; y: number } | null = null;
  
  // Add global click listener to ensure deselection works
  private globalClickListener?: (event: Event) => void;

  // Properties for unsubscribe functions
  private unsubscribeRequestDrag?: () => void;
  private unsubscribeDragStart?: () => void;
  private unsubscribeDragUpdate?: () => void;
  private unsubscribeDragEnd?: () => void;
  private unsubscribeDragCancel?: () => void;

  constructor(dependencies: CoordinatorDependencies) {
    this.stateMachine = dependencies.stateMachine;
    this.viewportEngine = dependencies.viewport;
    this.objectManager = dependencies.objects;
    this.pageSize = dependencies.pageSize;
    this.dragManager = dependencies.dragManager;
    this.handleObjectUpdate = dependencies.handleObjectUpdate;
    this.handleObjectDelete = dependencies.handleObjectDelete as any;
    
    this.setupGlobalListeners();
  }
  
  public updateHandlers(handlers: { 
    handleObjectUpdate: (id: string, updates: Partial<DiaryObject>) => void;
    handleObjectDelete: (id: string, updates?: Partial<DiaryObject>) => void;
  }) {
    this.handleObjectUpdate = handlers.handleObjectUpdate;
    this.handleObjectDelete = handlers.handleObjectDelete;
  }

  public setPageSize(size: { width: number, height: number }) {
    this.pageSize = size;
  }

  public setViewport(viewport: ViewportEngine) {
    this.viewportEngine = viewport;
  }

  public registerStrategy(type: string, strategy: ObjectInteractionStrategy): void {
    if (this.isDestroyed) return;
    this.strategies.set(type, strategy);
  }
  
  destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    this.cleanupGlobalListeners();
    this.dragManager.destroy();
    this.strategies.clear();
    this.lastClick = null;
    this.lastPointerPosition = null;
  }
  
  public setPointerDownContext(context: PointerDownContext) {
    this.pointerDownContext = context;
  }
  
  private setupGlobalListeners = () => {
      this.unsubscribeRequestDrag = diaryEventManager.addEventListener('diary:requestStartDrag', this.onRequestStartDrag);
      this.unsubscribeDragStart = diaryEventManager.addEventListener('drag:start', this.onDragStart);
      this.unsubscribeDragUpdate = diaryEventManager.addEventListener('drag:update', this.onDragUpdate);
      this.unsubscribeDragEnd = diaryEventManager.addEventListener('drag:end', this.onDragEnd);
      this.unsubscribeDragCancel = diaryEventManager.addEventListener('drag:cancel', this.onDragCancel);
      
      // Add global click listener for deselection
      this.setupGlobalClickListener();
  };

  private isClickOnToolbarOrUI = (event: PointerEvent): boolean => {
    const target = event.target as HTMLElement;
    if (!target) return false;

    // Check if click is on contextual toolbar or any UI element
    const path = (event.composedPath() as HTMLElement[]) || [];
    
    for (const element of path) {
      if (!element.classList) continue;
      
      // Skip if clicking on contextual toolbar
      if (element.closest('[data-radix-popper-content-wrapper]') || 
          element.closest('.contextual-toolbar') ||
          element.classList.contains('contextual-toolbar')) {
        return true;
      }
      
      // Skip if clicking on any popover, dropdown, or modal
      if (element.closest('[data-radix-portal]') ||
          element.closest('[role="dialog"]') ||
          element.closest('[role="menu"]') ||
          element.closest('[role="listbox"]') ||
          element.closest('.popover') ||
          element.closest('.dropdown') ||
          element.closest('.modal')) {
        return true;
      }
      
      // Skip if clicking on any button, slider, or input in a toolbar/popover
      if ((element.tagName === 'BUTTON' || 
           element.tagName === 'INPUT' || 
           element.tagName === 'SLIDER' ||
           element.role === 'slider' ||
           element.role === 'button') && 
          element.closest('.toolbar, .popover, [data-radix-popper-content-wrapper]')) {
        return true;
      }
    }
    
    return false;
  };

  private setupGlobalClickListener = () => {
    this.globalClickListener = (event: Event) => {
      const pointerEvent = event as PointerEvent;
      if (!pointerEvent.clientX && !pointerEvent.clientY) return; // Not a pointer event

      // Don't deselect if we're in view mode or no selections
      if (this.stateMachine.isViewMode() || this.stateMachine.getContext().selectedObjectIds.length === 0) {
        return;
      }

      // Don't deselect if clicking on toolbar or UI elements
      if (this.isClickOnToolbarOrUI(pointerEvent)) {
        return;
      }

      // Don't deselect if currently editing content - let the text editing handle its own blur logic
      if (this.stateMachine.getCurrentState() === 'editing_content') {
        return;
      }

      const hitResult = this.getHitTarget(pointerEvent);
      
      // If we didn't hit any object or hit an empty area, deselect
      if (!hitResult.objectId) {
        
        // End any active interaction first
        if (this.stateMachine.isInteracting()) {
          if (this.stateMachine.can(InteractionEvent.END_INTERACTION)) {
            this.stateMachine.trigger(InteractionEvent.END_INTERACTION);
          }
        }
        
        // Clear selection
        this.stateMachine.selectObjects([]);
        
        // Reset click tracker
        this.lastClick = null;
        this.lastPointerPosition = null;
      }
    };

    // Use capture phase to ensure we get the event before page-flip library
    document.addEventListener('pointerdown', this.globalClickListener, { capture: true });
    document.addEventListener('click', this.globalClickListener, { capture: true });
  };

  private cleanupGlobalListeners = () => {
    this.unsubscribeRequestDrag?.();
    this.unsubscribeDragStart?.();
    this.unsubscribeDragUpdate?.();
    this.unsubscribeDragEnd?.();
    this.unsubscribeDragCancel?.();
    
    // Clean up global click listener
    if (this.globalClickListener) {
      document.removeEventListener('pointerdown', this.globalClickListener, { capture: true });
      document.removeEventListener('click', this.globalClickListener, { capture: true });
      this.globalClickListener = undefined;
    }
  };

  /**
   * Custom double-click detection logic
   */
  private detectDoubleClick(objectId: string, event: PointerEvent): number {
    const now = Date.now();
    const currentPos = { x: event.clientX, y: event.clientY };

    // If we have a previous click on the same object
    if (this.lastClick && this.lastClick.objectId === objectId) {
      const timeDiff = now - this.lastClick.timestamp;
      const distance = this.lastPointerPosition 
        ? Math.sqrt(
            Math.pow(currentPos.x - this.lastPointerPosition.x, 2) + 
            Math.pow(currentPos.y - this.lastPointerPosition.y, 2)
          )
        : 0;

      // Check if it's within double-click time and distance thresholds
      if (timeDiff <= this.DOUBLE_CLICK_THRESHOLD && distance <= this.DOUBLE_CLICK_DISTANCE_THRESHOLD) {
        this.lastClick.clickCount++;
        this.lastClick.timestamp = now;
        this.lastPointerPosition = currentPos;
        return this.lastClick.clickCount;
      }
    }

    // Reset or create new click tracker
    this.lastClick = {
      objectId,
      timestamp: now,
      clickCount: 1
    };
    this.lastPointerPosition = currentPos;
    
    return 1;
  }

  private getHitTarget(event: PointerEvent): { 
      objectId?: string, 
      pageId?: string, 
      zone?: ObjectZone, 
      object?: DiaryObject, 
      strategy?: ObjectInteractionStrategy,
      pageElement?: HTMLElement,
  } {
      const path = (event.composedPath() as HTMLElement[]) || [];
      
      const pageElement = path.find(el => el?.dataset?.pageId && el.classList.contains('page--page')) as HTMLElement | undefined;
      
      if (!pageElement) {
          return {};
      }

      const pageId = pageElement.dataset.pageId;
      const objectElement = path.find(el => el?.dataset?.diaryObjectId) as HTMLElement | undefined;

      if (!objectElement) {
          return { pageId, pageElement };
      }
      
      const objectId = objectElement.dataset.diaryObjectId;
      const object = this.objectManager.getObject(pageId!, objectId!);
      
      if (!object) {
          return { pageId, pageElement };
      }

      const strategy = this.strategies.get(object.type);
      if (!strategy) return { objectId, pageId, object, pageElement };
      
      const zones = strategy.getZones(objectElement, this.stateMachine.getContext().selectedObjectIds.includes(objectId!));
      
      for (const element of path) {
          for (const zone of zones) {
              if (element === zone.element) {
                   return { objectId, pageId, zone, object, strategy, pageElement };
              }
          }
      }
      
      return { objectId, pageId, object, strategy, pageElement };
  }

  public handlePointerDown = (event: PointerEvent): void => {
      if (this.isDestroyed || !this.viewportEngine || this.stateMachine.isViewMode()) {
          return;
      }

      const hitResult = this.getHitTarget(event);
      const { objectId, pageId, object, zone } = hitResult;
      
      if (!objectId || !object) {
          this.handleEmptyAreaClick();
          return;
      }

      // Drawing Logic
      if (object.type === 'drawing' && this.stateMachine.getCurrentState() === 'edit') {
        if (this.stateMachine.can(InteractionEvent.START_DRAWING, { objectId })) {
            this.stateMachine.trigger(InteractionEvent.START_DRAWING, { objectId });
            this.startDrawingStroke(event, objectId, hitResult.pageElement!);
            return;
        }
      }
      
      // Use custom double-click detection
      const clickCount = this.detectDoubleClick(objectId, event);
      
      // Check for double-click on text content zone
      if (clickCount >= 2 && object.type === 'text' && object.behavior.isEditable && zone?.type === 'content') {
          this.stateMachine.trigger(InteractionEvent.START_CONTENT_EDIT, { objectId });
          return; // Stop further processing to prevent drag
      }
      
      // If clicking on different object while editing content, end current edit and save content
      if (this.stateMachine.getCurrentState() === 'editing_content' && objectId !== this.stateMachine.getContext().editingObjectId) {
          if (this.stateMachine.can(InteractionEvent.END_INTERACTION)) {
              this.stateMachine.trigger(InteractionEvent.END_INTERACTION);
          }
      }
      
      this.stateMachine.selectObjects([objectId], event.ctrlKey || event.metaKey);
      
      // Only start drag on single click and if not in content zone for text objects
      if (clickCount === 1 && object.behavior.isDraggable && zone?.type !== 'content') {
         this.initiateDrag(pageId!, [objectId], event);
      }
  };

  private handleEmptyAreaClick = () => {
    // End any active interaction first
    if (this.stateMachine.isInteracting()) {
        if (this.stateMachine.can(InteractionEvent.END_INTERACTION)) {
           this.stateMachine.trigger(InteractionEvent.END_INTERACTION);
        }
    }
    
    // Clear selection
    this.stateMachine.selectObjects([]);
    
    // Reset click tracker when clicking on empty space
    this.lastClick = null;
    this.lastPointerPosition = null;
  };
  
  private onRequestStartDrag = (detail: any): void => {
      if (this.isDestroyed || this.stateMachine.isViewMode()) return;
      const { pageId, objectIds, pointerEvent } = detail;

      this.initiateDrag(pageId, objectIds, pointerEvent);
  };

  private initiateDrag(pageId: string, objectIds: string[], event: PointerEvent): void {
      if (!this.viewportEngine) return;

      const pageElement = document.querySelector(`[data-page-id="${pageId}"]`) as HTMLElement;
      if (!pageElement) return;

      const startRelative = this.viewportEngine.screenToViewport({ x: event.clientX, y: event.clientY }, pageElement);
      if (!startRelative) return;

      const transforms = new Map<string, DiaryGeometry.Transform>();
      objectIds.forEach(id => {
          const obj = this.objectManager.getObject(pageId, id);
          if (obj) transforms.set(id, { ...obj.transform });
      });
      
      this.dragManager.startDrag({
          pageId: pageId,
          objectIds,
          pointerEvent: event,
          startRelativePoint: startRelative,
          transforms,
          convertScreenToRelative: (p: DiaryGeometry.Point) => this.viewportEngine!.screenToViewport(p, pageElement)
      });
  }

  // --- Drawing-specific Logic ---
  private startDrawingStroke = (event: PointerEvent, objectId: string, pageElement: HTMLElement) => {
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    let currentStroke: DrawingStroke = {
      points: [],
      color: '#374151',
      width: 4
    };

    const drawingObject = this.objectManager.getObject(this.stateMachine.getContext().drawingPageId!, objectId);
    if (!drawingObject || drawingObject.type !== 'drawing') return;

    const onPointerMove = (moveEvent: PointerEvent) => {
        if (moveEvent.pointerId !== event.pointerId) return;
        const point = this.getRelativePointInObject(moveEvent, drawingObject);
        if (point) {
            currentStroke.points.push(point);
            // Optionally, we could dispatch an event here for live preview rendering
        }
    };

    const onPointerUp = (upEvent: PointerEvent) => {
        if (upEvent.pointerId !== event.pointerId) return;

        (upEvent.target as HTMLElement).releasePointerCapture(upEvent.pointerId);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        
        if (currentStroke.points.length > 1) {
             const existingStrokes = drawingObject.content.strokes || [];
             this.handleObjectUpdate(objectId, {
                 content: { strokes: [...existingStrokes, currentStroke] }
             });
        }

        if (this.stateMachine.can(InteractionEvent.END_INTERACTION)) {
            this.stateMachine.trigger(InteractionEvent.END_INTERACTION);
        }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    // Add the first point
    const firstPoint = this.getRelativePointInObject(event, drawingObject);
    if (firstPoint) {
      currentStroke.points.push(firstPoint);
    }
  };

  private getRelativePointInObject = (event: PointerEvent, object: DiaryObject): DiaryGeometry.Point | null => {
    const objElement = document.querySelector(`[data-diary-object-id="${object.id}"]`) as HTMLElement;
    if (!objElement) return null;

    const rect = objElement.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
        return { x, y };
    }
    return null;
  };


  private onDragStart = (detail: { objectIds: string[], pageId: string, startPoint: DiaryGeometry.Point }): void => {};
  private onDragUpdate = (detail: { objectIds: string[], pageId: string, currentPoint: DiaryGeometry.Point }): void => {};

  private onDragEnd = (detail: { objectIds: string[], pageId: string, startPoint: DiaryGeometry.Point, endPoint: DiaryGeometry.Point, originalTransforms: Map<string, DiaryGeometry.Transform> }): void => {
    const { objectIds, pageId, startPoint, endPoint, originalTransforms } = detail;
    
    if (!originalTransforms) return;

    originalTransforms.forEach((orig: DiaryGeometry.Transform, id: string) => {
        const dx = endPoint.x - startPoint.x;
        const dy = endPoint.y - startPoint.y;

        const finalTransform = {
            ...orig,
            x: orig.x + dx,
            y: orig.y + dy,
        };
        
        this.handleObjectUpdate(id, { transform: finalTransform });
    });
  };

  private onDragCancel = (detail: { objectIds: string[], pageId: string, originalTransforms: Map<string, DiaryGeometry.Transform> }): void => {
    const { objectIds, pageId, originalTransforms } = detail;
    
    if (originalTransforms) {
        originalTransforms.forEach((orig: DiaryGeometry.Transform, id: string) => {
            this.handleObjectUpdate(id, { transform: orig });
        });
    }

    if (this.stateMachine.can(InteractionEvent.CANCEL_INTERACTION)) {
      this.stateMachine.trigger(InteractionEvent.CANCEL_INTERACTION, { reason: 'pointercancel' });
    }
  };
}
