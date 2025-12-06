// src/features/diary/business/tools/table-tool.ts
import type { ToolDefinition, DiaryTool } from '../../types';
import { ObjectFactory } from '../factories/object-factory';

export const TableToolDefinition: ToolDefinition = {
  id: 'table' as DiaryTool,
  name: 'Add Table',
  icon: 'Table',
  category: 'widgets',
  defaultSize: { x: 0.1, y: 0.1, width: 0.6, height: 0.4, rotation: 0 },
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
    minSize: { width: 200, height: 100 },
    constrainToBounds: true
  },
  createObject: (coords) => ObjectFactory.create({
    type: 'text', 
    transform: coords, 
    content: JSON.stringify({
        type: 'table', // Add a type property
        rows: 3,
        columns: 3,
        cells: Array(9).fill('').map((_, i) => ({ content: `Cell ${i + 1}`, style: {} }))
    })
  })
};
