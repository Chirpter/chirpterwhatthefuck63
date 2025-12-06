// src/features/diary/business/strategies/simple-transform-strategy.ts

import type { ObjectInteractionStrategy, ObjectZone, StrictInteractionEvent } from '../../types';
import { InteractionType } from '../../types';
import type { InteractionStateMachine } from '../../foundation/interaction-state-machine';

export class SimpleTransformStrategy implements ObjectInteractionStrategy {

  getZones(element: HTMLElement, isSelected: boolean): ObjectZone[] {
    return [{
      type: 'body',
      element: element,
      interactionType: InteractionType.OBJECT_DRAG,
      cursor: 'grab'
    }];
  }
  
  handleInteraction(event: StrictInteractionEvent, stateMachine: InteractionStateMachine): boolean {
    const { objectId } = event.target;
    if (!objectId) return false;

    // The coordinator will handle selection and drag initiation.
    // This strategy simply confirms the interaction type.
    if (event.type === InteractionType.OBJECT_DRAG) {
      // The coordinator will see that this strategy didn't handle it (return false)
      // and will initiate a drag based on the zone type.
      return false; 
    }
    
    return false;
  }
}
