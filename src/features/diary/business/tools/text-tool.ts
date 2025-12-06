// src/features/diary/business/tools/text-tool.ts
import type { ToolDefinition } from '../../types';
import { ObjectFactory } from '../factories/object-factory';
import type { DiaryTool } from '../../types';

export const TextToolDefinition: ToolDefinition = {
  id: 'text' as DiaryTool,
  name: 'Add Text',
  icon: 'Pilcrow',
  category: 'basic',
  defaultSize: { x: 0.1, y: 0.1, width: 0.3, height: 0.15, rotation: 0 },
  behavior: {
    isDraggable: true,
    isResizable: true,
    isEditable: true,
    isSelectable: true
  },
  constraints: {
    minSize: { width: 50, height: 20 },
    constrainToBounds: true
  },
  createObject: (coords) => ObjectFactory.create({ type: 'text', transform: coords, content: '<p>New Text</p>' }),
  validateObject: (obj) => obj.type === 'text' ? {isValid: true, errors: []} : {isValid: false, errors: ['Not a text object']},
  config: {
    allowsStyleCustomization: true,
    supportsMultipleInstances: true
  }
};
