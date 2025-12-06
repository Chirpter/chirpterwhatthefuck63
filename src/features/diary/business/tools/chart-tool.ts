// src/features/diary/business/tools/chart-tool.ts
import type { ToolDefinition, DiaryTool } from '../../types';
import { ObjectFactory } from '../factories/object-factory';

export const ChartToolDefinition: ToolDefinition = {
  id: 'chart' as DiaryTool,
  name: 'Add Chart',
  icon: 'BarChart',
  category: 'widgets',
  defaultSize: { x: 0.1, y: 0.1, width: 0.5, height: 0.4, rotation: 0 },
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
        type: 'chart', // Add a type property
        chartType: 'bar',
        data: [
          { label: 'A', value: 10 },
          { label: 'B', value: 20 },
          { label: 'C', value: 15 }
        ]
    })
  })
};
