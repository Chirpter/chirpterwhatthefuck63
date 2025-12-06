// src/features/diary/foundation/drag-manager.ts

import type { DiaryGeometry, DiaryObject } from '../types';
import { diaryEventManager } from './event-manager';

const DRAG_THRESHOLD = 6; // pixels
const DRAG_THRESHOLD_SQ = DRAG_THRESHOLD * DRAG_THRESHOLD;

export interface DragState {
    isDragging: boolean;
    objectIds: string[];
    pageId: string | null;
    // screen start point (pixels) used only for threshold calculation
    startScreenPoint: { x: number; y: number } | null;
    // startRelativePoint is in viewport space (0..1) — provided by caller (Coordinator)
    startRelativePoint?: DiaryGeometry.Point | null;
    currentRelativePoint?: DiaryGeometry.Point | null;
    offsetX: number;
    offsetY: number;
    originalTransforms: Map<string, DiaryGeometry.Transform>;
    pointerId?: number;
    targetElement?: EventTarget | null;
    // optional converter if caller prefers DragManager to convert screen->relative
    convertScreenToRelative?: (p: DiaryGeometry.Point, el?: HTMLElement) => DiaryGeometry.Point | null;
}

export class DiaryDragManager {
    public dragState: DragState = this.createInitialState();

    private isDestroyed = false;

    private createInitialState(): DragState {
        return {
            isDragging: false,
            objectIds: [],
            pageId: null,
            startScreenPoint: null,
            startRelativePoint: null,
            currentRelativePoint: null,
            offsetX: 0,
            offsetY: 0,
            originalTransforms: new Map(),
        };
    }
    
    startDrag(options: {
        pageId: string;
        objectIds: string[];
        pointerEvent: PointerEvent;
        startRelativePoint: DiaryGeometry.Point;
        transforms: Map<string, DiaryGeometry.Transform>;
        convertScreenToRelative?: (p: DiaryGeometry.Point, el?: HTMLElement) => DiaryGeometry.Point | null;
    }): void {
        if (this.isDestroyed || this.dragState.isDragging) return;

        const firstObjectTransform = options.transforms.get(options.objectIds[0]);
        if (!firstObjectTransform) return;

        this.dragState = {
            isDragging: false,
            objectIds: options.objectIds,
            pageId: options.pageId,
            startScreenPoint: { x: options.pointerEvent.clientX, y: options.pointerEvent.clientY },
            startRelativePoint: options.startRelativePoint,
            currentRelativePoint: options.startRelativePoint,
            offsetX: options.startRelativePoint.x - firstObjectTransform.x,
            offsetY: options.startRelativePoint.y - firstObjectTransform.y,
            originalTransforms: options.transforms,
            pointerId: options.pointerEvent.pointerId,
            targetElement: options.pointerEvent.target,
            convertScreenToRelative: options.convertScreenToRelative,
        };
        
        try {
            (options.pointerEvent.target as Element).setPointerCapture(options.pointerEvent.pointerId);
        } catch(e) {
            console.warn("Could not set pointer capture:", e);
        }

        window.addEventListener('pointermove', this.handlePointerMoveWithThreshold);
        window.addEventListener('pointerup', this.handlePointerUp);
        window.addEventListener('pointercancel', this.handlePointerCancel);
    }
    
    private updateDragRelative(currentRelativePoint: DiaryGeometry.Point): void {
      if (this.isDestroyed || !this.dragState.startRelativePoint) return;
      
      this.dragState.currentRelativePoint = currentRelativePoint;
      diaryEventManager.dispatchEvent('drag:update', { 
          objectIds: this.dragState.objectIds,
          pageId: this.dragState.pageId!,
          currentPoint: this.dragState.currentRelativePoint
      });
    }

    private handlePointerMoveWithThreshold = (event: PointerEvent): void => {
        if (!this.dragState.pointerId || event.pointerId !== this.dragState.pointerId) return;

        const dx = event.clientX - (this.dragState.startScreenPoint?.x ?? event.clientX);
        const dy = event.clientY - (this.dragState.startScreenPoint?.y ?? event.clientY);
        const distanceSq = dx * dx + dy * dy;

        const screenPoint = { x: event.clientX, y: event.clientY };
        let relativePoint: DiaryGeometry.Point | null = null;
        if (this.dragState.convertScreenToRelative) {
            try {
                relativePoint = this.dragState.convertScreenToRelative(screenPoint, this.dragState.targetElement as HTMLElement);
            } catch (e) {
                relativePoint = null;
            }
        }

        if (!relativePoint && this.dragState.startRelativePoint) {
            // Fallback calculation if conversion fails mid-drag
            relativePoint = null;
        }

        if (!this.dragState.isDragging && distanceSq > DRAG_THRESHOLD_SQ) {
            this.dragState.isDragging = true;
            diaryEventManager.dispatchEvent('drag:start', {
                objectIds: this.dragState.objectIds,
                pageId: this.dragState.pageId!,
                startPoint: this.dragState.startRelativePoint!
            });
        }
        
        if (this.dragState.isDragging && relativePoint) {
            this.updateDragRelative(relativePoint);
        }
    }

    private handlePointerUp = (event: PointerEvent): void => {
        if (!this.dragState.pointerId || event.pointerId !== this.dragState.pointerId) return;
        
        if (this.dragState.isDragging) {
            const screenPoint = { x: event.clientX, y: event.clientY };
            let finalRelative: DiaryGeometry.Point | null = null;
            if (this.dragState.convertScreenToRelative) {
                try {
                    finalRelative = this.dragState.convertScreenToRelative(screenPoint, this.dragState.targetElement as HTMLElement);
                } catch(e) {
                    finalRelative = this.dragState.currentRelativePoint ?? this.dragState.startRelativePoint ?? null;
                }
            }

            diaryEventManager.dispatchEvent('drag:end', {
                objectIds: this.dragState.objectIds,
                pageId: this.dragState.pageId!,
                startPoint: this.dragState.startRelativePoint!,
                endPoint: finalRelative || this.dragState.startRelativePoint!,
                originalTransforms: this.dragState.originalTransforms,
            });
        }
        
        this.cleanupAfterDrag();
    }
    
     private handlePointerCancel = (event: PointerEvent): void => {
        if (!this.dragState.pointerId || event.pointerId !== this.dragState.pointerId) return;
        
        if (this.dragState.isDragging) {
             diaryEventManager.dispatchEvent('drag:cancel', { 
                objectIds: this.dragState.objectIds, 
                pageId: this.dragState.pageId!,
                originalTransforms: this.dragState.originalTransforms,
            });
        }
        
        this.cleanupAfterDrag();
    }

    private cleanupAfterDrag() {
        if (this.dragState.targetElement && this.dragState.pointerId) {
            try {
                (this.dragState.targetElement as Element).releasePointerCapture(this.dragState.pointerId);
            } catch (e) {
                console.warn("Could not release pointer capture:", e);
            }
        }

        window.removeEventListener('pointermove', this.handlePointerMoveWithThreshold);
        window.removeEventListener('pointerup', this.handlePointerUp);
        window.removeEventListener('pointercancel', this.handlePointerCancel);

        this.resetDragState();
    }

    public getLiveTransform(objectId: string, currentRelativePoint?: DiaryGeometry.Point): DiaryGeometry.Transform | null {
        const originalTransform = this.dragState.originalTransforms.get(objectId);
        if (!originalTransform || !this.dragState.startRelativePoint) return null;
        if (!currentRelativePoint && !this.dragState.currentRelativePoint) return null;

        const cur = currentRelativePoint || this.dragState.currentRelativePoint!;
        const dx = cur.x - (this.dragState.startRelativePoint!.x);
        const dy = cur.y - (this.dragState.startRelativePoint!.y);

        return {
            ...originalTransform,
            x: originalTransform.x + dx,
            y: originalTransform.y + dy,
        };
    }

    isDragging(objectId?: string): boolean {
        if (objectId) {
            return this.dragState.isDragging && this.dragState.objectIds.includes(objectId);
        }
        return this.dragState.isDragging;
    }

    private resetDragState(): void {
        this.dragState = this.createInitialState();
    }

    destroy(): void {
        this.isDestroyed = true;
        this.cleanupAfterDrag();
    }
}
