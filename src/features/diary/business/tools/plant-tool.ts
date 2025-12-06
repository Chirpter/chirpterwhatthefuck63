// src/features/diary/business/tools/plant-tool.ts
import type { ToolDefinition, DiaryTool } from '../../types';
import { ObjectFactory } from '../factories/object-factory';

export const PlantToolDefinition: ToolDefinition = {
  id: 'plant' as DiaryTool,
  name: 'Add Plant',
  icon: 'Leaf',
  category: 'media',
  defaultSize: { x: 0.1, y: 0.1, width: 0.15, height: 0.15, rotation: 0 },
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
    minSize: { width: 50, height: 50 },
    aspectRatio: 1,
    constrainToBounds: true
  },
  createObject: (coords) => ObjectFactory.create({ 
    type: 'plant', 
    transform: coords, 
    content: {
        growthStage: 'seed',
        lastWatered: Date.now()
    }
  }),
  config: {
    supportsMultipleInstances: true
  }
};
