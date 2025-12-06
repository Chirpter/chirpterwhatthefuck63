// src/features/diary/business/strategies/editable-content-strategy.ts

import type { ObjectInteractionStrategy, ObjectZone, StrictInteractionEvent } from '../../types';
import { InteractionType } from '../../types';
import type { InteractionStateMachine } from '../../foundation/interaction-state-machine';
import { InteractionEvent } from '../../foundation/interaction-state-machine';

export class EditableContentStrategy implements ObjectInteractionStrategy {

  getZones(element: HTMLElement, isSelected: boolean): ObjectZone[] {
    const zones: ObjectZone[] = [];
    
    const contentEl = element.querySelector('[data-text-content]') as HTMLElement;
    if (contentEl) {
      zones.push({
        type: 'content',
        element: contentEl,
        interactionType: InteractionType.CONTENT_EDIT,
        cursor: isSelected ? 'text' : 'default'
      });
    }
    
    const dragHandle = element.querySelector('[data-drag-handle]') as HTMLElement;
    if (dragHandle) {
        zones.push({
            type: 'drag_handle',
            element: dragHandle,
            interactionType: InteractionType.OBJECT_DRAG,
            cursor: 'grab'
        });
    }
    
    const resizeHandles = element.querySelectorAll('[data-resize-handle]') as NodeListOf<HTMLElement>;
    resizeHandles.forEach(handle => {
      zones.push({
        type: 'resize_handle',
        element: handle,
        interactionType: InteractionType.OBJECT_RESIZE,
        cursor: handle.style.cursor || 'nw-resize'
      });
    });
    
    // The body itself can be a drag target if not editing
    zones.push({
        type: 'body',
        element: element,
        interactionType: InteractionType.OBJECT_DRAG,
        cursor: 'move'
    });
    
    return zones;
  }
  
  handleInteraction(event: StrictInteractionEvent, stateMachine: InteractionStateMachine): boolean {
    const { objectId, zone } = event.target;
    if (!objectId) return false;

    // Handle content zone interactions specifically for text editing
    if (zone === 'content') {
      const isCurrentlySelected = stateMachine.getContext().selectedObjectIds.includes(objectId);
      const isEditingThisObject = stateMachine.getContext().editingObjectId === objectId;
      
      if (event.originalEvent.type === 'pointerdown') {
        // If already selected and not editing, start content editing
        if (isCurrentlySelected && !isEditingThisObject && !stateMachine.isInteracting()) {
          
          if (stateMachine.can(InteractionEvent.START_CONTENT_EDIT, { objectId })) {
            stateMachine.trigger(InteractionEvent.START_CONTENT_EDIT, { objectId });
            return true; // We handled this interaction
          }
        }
        // If not selected, let the coordinator handle selection first
        else if (!isCurrentlySelected) {
          return false;
        }
      }
      
      if (event.originalEvent.type === 'dblclick' || event.originalEvent.type === 'doubleclick') { // Handle both event names
        
        if (stateMachine.can(InteractionEvent.START_CONTENT_EDIT, { objectId })) {
          stateMachine.trigger(InteractionEvent.START_CONTENT_EDIT, { objectId });
          return true; // We handled this interaction
        }
      }
    }

    // For all other interactions (drag, resize, body clicks), defer to coordinator
    return false;
  }
}
