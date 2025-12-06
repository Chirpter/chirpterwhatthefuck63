// src/features/diary/business/tools/sticker-tool.ts
import type { ToolDefinition, DiaryTool } from '../../types';
import { ObjectFactory } from '../factories/object-factory';

export const StickerToolDefinition: ToolDefinition = {
  id: 'sticker' as DiaryTool,
  name: 'Add Sticker',
  icon: 'Stamp',
  category: 'media',
  defaultSize: { x: 0.1, y: 0.1, width: 0.1, height: 0.1, rotation: 0 },
  behavior: {
    isDraggable: true,
    isResizable: true,
    isEditable: false,
    isSelectable: true,
    allowInlineEdit: false,
    maintainAspectRatio: true,
    showSelectionUI: true
  },
  constraints: {
    minSize: { width: 30, height: 30 },
    aspectRatio: 1,
    constrainToBounds: true
  },
  createObject: (coords, emoji) => ObjectFactory.create({ type: 'sticker', transform: coords, content: emoji }),
  config: {
    supportsMultipleInstances: true
  }
};
