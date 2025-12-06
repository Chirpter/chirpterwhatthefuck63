// src/features/diary/business/tools/image-tool.ts
import type { ToolDefinition } from '../../types';
import { ObjectFactory } from '../factories/object-factory';
import type { DiaryTool } from '../../types';

export const ImageToolDefinition: ToolDefinition = {
  id: 'image' as DiaryTool,
  name: 'Add Image',
  icon: 'Image',
  category: 'media',
  defaultSize: { x: 0.1, y: 0.1, width: 0.4, height: 0.3, rotation: 0 },
  behavior: {
    isDraggable: true,
    isResizable: true,
    isEditable: false,
    isSelectable: true
  },
  constraints: {
    minSize: { width: 50, height: 50 },
    constrainToBounds: true
  },
  createObject: (coords, src) => ObjectFactory.create({ type: 'image', transform: coords, content: { src } }),
  config: {
    requiresFileInput: true,
    supportsMultipleInstances: true
  }
};
