// src/features/diary/business/tools/date-tool.ts
import type { ToolDefinition } from '../../types';
import { ObjectFactory } from '../factories/object-factory';
import type { DiaryTool } from '../../types';
import { getFormattedDate } from '@/lib/utils';

export const DateToolDefinition: ToolDefinition = {
  id: 'dateMarker' as DiaryTool,
  name: 'Add Date',
  icon: 'Calendar',
  category: 'widgets',
  defaultSize: { x: 0.1, y: 0.1, width: 0.4, height: 0.1, rotation: 0 },
  behavior: {
    isDraggable: true,
    isResizable: true,
    isEditable: true, 
    isSelectable: true,
    allowInlineEdit: false, 
    maintainAspectRatio: false,
    showSelectionUI: true,
  },
  constraints: {
    minSize: { width: 150, height: 40 },
    constrainToBounds: true,
  },
  createObject: (coords) => {
    const today = new Date();
    // The content is a simple date string, which the renderer will format.
    // The date itself will be stored on the DiaryEntry.
    return ObjectFactory.create({
        type: 'text', // We re-use the text object for rendering
        transform: coords,
        // The content will be specially rendered by ObjectRenderer, now with a default mood.
        content: `{"type": "dateMarker", "date": "${today.toISOString()}"}`
    });
  },
  config: {
    supportsMultipleInstances: true,
  }
};
