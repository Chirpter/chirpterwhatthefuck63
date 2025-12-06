// src/features/diary/business/tools/checklist-tool.ts
import type { ToolDefinition, DiaryTool } from '../../types';
import { ObjectFactory } from '../factories/object-factory';

export const ChecklistToolDefinition: ToolDefinition = {
  id: 'checklist' as DiaryTool,
  name: 'Add Checklist',
  icon: 'ListChecks',
  category: 'widgets',
  defaultSize: { x: 0.1, y: 0.1, width: 0.4, height: 0.3, rotation: 0 },
  behavior: {
    isDraggable: true,
    isResizable: true,
    isEditable: true,
    isSelectable: true,
    allowInlineEdit: true,
    maintainAspectRatio: false,
    showSelectionUI: true
  },
  constraints: {
    minSize: { width: 150, height: 100 },
    constrainToBounds: true
  },
  createObject: (coords) => ObjectFactory.create({
    type: 'text',
    transform: coords,
    content: JSON.stringify({
        type: 'checklist', // Add a type property
        items: [
          { id: '1', text: 'First item', completed: false },
          { id: '2', text: 'Second item', completed: false }
        ]
    })
  })
};
