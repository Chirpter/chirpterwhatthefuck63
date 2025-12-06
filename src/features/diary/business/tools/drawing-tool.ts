// src/features/diary/business/tools/drawing-tool.ts
import type { ToolDefinition } from '../../types';
import { ObjectFactory } from '../factories/object-factory';
import type { DiaryTool } from '../../types';

export const DrawingToolDefinition: ToolDefinition = {
  id: 'drawing' as DiaryTool,
  name: 'Draw',
  icon: 'Feather',
  category: 'basic',
  defaultSize: { x: 0.1, y: 0.1, width: 0.5, height: 0.5, rotation: 0 },
  behavior: {
    isDraggable: true,
    isResizable: true,
    isEditable: true, // A drawing object is "editable" by adding more strokes
    allowInlineEdit: true,
    isSelectable: true,
    showSelectionUI: true,
  },
  constraints: {
    minSize: { width: 100, height: 100 },
    constrainToBounds: true
  },
  createObject: (coords) => ObjectFactory.create({ type: 'drawing', transform: coords, content: { strokes: [] } }),
  config: {
    supportsMultipleInstances: true
  }
};
