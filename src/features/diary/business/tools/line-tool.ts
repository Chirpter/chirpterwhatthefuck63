// src/features/diary/business/tools/line-tool.ts
import type { ToolDefinition } from '../../types';
import { ObjectFactory } from '../factories/object-factory';
import type { DiaryTool } from '../../types';


export const LineToolDefinition: ToolDefinition = {
  id: 'line' as DiaryTool,
  name: 'Add Separator',
  icon: 'Minus',
  category: 'basic',
  defaultSize: { x: 0.1, y: 0.1, width: 0.6, height: 0.005, rotation: 0 },
  behavior: {
    isDraggable: true,
    isResizable: false,
    isEditable: false,
    isSelectable: true
  },
  constraints: {
    minSize: { width: 50, height: 2 },
    constrainToBounds: true
  },
  createObject: (coords) => ObjectFactory.create({ type: 'line', transform: coords, content: { style: 'solid' } as any }),
  config: {
    allowsStyleCustomization: true,
    supportsMultipleInstances: true
  }
};
