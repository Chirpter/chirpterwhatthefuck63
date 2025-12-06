// src/features/diary/business/strategies/bounded-object-strategy.ts

import type { ObjectInteractionStrategy, ObjectZone, StrictInteractionEvent } from '../../types';
import { InteractionType } from '../../types';
import type { InteractionStateMachine } from '../../foundation/interaction-state-machine';

export class BoundedObjectStrategy implements ObjectInteractionStrategy {
  
  getZones(element: HTMLElement, isSelected: boolean): ObjectZone[] {
    const zones: ObjectZone[] = [];
    
    zones.push({
      type: 'body',
      element: element,
      interactionType: InteractionType.OBJECT_DRAG,
      cursor: 'grab'
    });
    
    if (isSelected) {
      const resizeHandles = element.querySelectorAll('[data-resize-handle]') as NodeListOf<HTMLElement>;
      resizeHandles.forEach(handle => {
        zones.push({
          type: 'resize_handle',
          element: handle,
          interactionType: InteractionType.OBJECT_RESIZE,
          cursor: handle.style.cursor || 'nwse-resize'
        });
      });
    }
    
    return zones;
  }
  
  handleInteraction(event: StrictInteractionEvent, stateMachine: InteractionStateMachine): boolean {
    const { objectId } = event.target;
    if (!objectId) return false;

    // Always select the object on any interaction.
    stateMachine.selectObjects([objectId], event.modifiers.ctrl);

    // Delegate drag/resize initiation to the Coordinator by returning false.
    // The Coordinator will see this and check the zone type to start the drag/resize.
    return false;
  }
}
