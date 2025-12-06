// src/features/diary/business/strategies/drawing-strategy.ts

// Drawing objects are treated like images/stickers for interaction purposes.
// The actual drawing logic is handled by the DiaryInteractionManager and its state.

import { BoundedObjectStrategy } from './bounded-object-strategy';

export class DrawingObjectStrategy extends BoundedObjectStrategy {
    // Inherits all behavior from BoundedObjectStrategy for drag/resize
}
