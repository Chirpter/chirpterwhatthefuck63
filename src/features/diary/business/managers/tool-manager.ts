// src/features/diary/business/managers/tool-manager.ts

import { ObjectFactory } from '../factories/object-factory';
import type { DiaryObject, DiaryObjectType, ToolDefinition, DiaryTool, DiaryGeometry } from '../../types';
import { SafeZoneManager } from './safe-zone-manager';
import type { ViewportEngine } from '../../foundation/viewport-engine';

// --- Import individual tool definitions ---
import { TextToolDefinition } from '../tools/text-tool';
import { ImageToolDefinition } from '../tools/image-tool';
import { DrawingToolDefinition } from '../tools/drawing-tool';
import { LineToolDefinition } from '../tools/line-tool';
import { ChecklistToolDefinition } from '../tools/checklist-tool';
import { TableToolDefinition } from '../tools/table-tool';
import { ChartToolDefinition } from '../tools/chart-tool';
import { StickerToolDefinition } from '../tools/sticker-tool';
import { PlantToolDefinition } from '../tools/plant-tool';
import { DateToolDefinition } from '../tools/date-tool';


export interface ToolCategory {
  name: string;
  borderColor: string;
  tools: ToolDefinition[];
}

export class DiaryToolManager {
  private static instance: DiaryToolManager;
  private tools: Map<DiaryTool, ToolDefinition> = new Map();
  private categories: Map<string, ToolCategory> = new Map();

  private constructor() {
    this.registerBuiltInTools();
    this.setupToolCategories();
  }
  
  static getInstance(): DiaryToolManager {
    if (!DiaryToolManager.instance) {
      DiaryToolManager.instance = new DiaryToolManager();
    }
    return DiaryToolManager.instance;
  }

  private registerBuiltInTools(): void {
    const allTools = [
        TextToolDefinition,
        ImageToolDefinition,
        DrawingToolDefinition,
        LineToolDefinition,
        ChecklistToolDefinition,
        TableToolDefinition,
        ChartToolDefinition,
        StickerToolDefinition,
        PlantToolDefinition,
        DateToolDefinition,
    ];

    allTools.forEach(toolDef => this.registerTool(toolDef));
  }
  
  private setupToolCategories(): void {
    this.categories.set('basic', {
      name: 'Basic',
      borderColor: 'border-yellow-400/30',
      tools: [
        this.tools.get('text')!,
        this.tools.get('drawing')!,
        this.tools.get('line')!
      ].filter(Boolean)
    });

    this.categories.set('widgets', {
      name: 'Widgets',
      borderColor: 'border-yellow-500/40',
      tools: [
        this.tools.get('dateMarker')!,
        this.tools.get('checklist')!,
        this.tools.get('chart')!,
        this.tools.get('table')!,
      ].filter(Boolean)
    });

    this.categories.set('media', {
      name: 'Media',
      borderColor: 'border-yellow-600/50',
      tools: [
        this.tools.get('image')!,
      ].filter(Boolean)
    });
  }

  registerTool(tool: ToolDefinition): void {
    this.tools.set(tool.id, tool);
  }

  getTool(id: DiaryTool): ToolDefinition | undefined {
    return this.tools.get(id);
  }

  getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  getToolsByCategory(category: string): ToolDefinition[] {
    const categoryData = this.categories.get(category);
    return categoryData ? categoryData.tools : [];
  }

  getToolCategories(): ToolCategory[] {
    return Array.from(this.categories.values());
  }
  
  async createObject(
    type: DiaryTool, // Changed from DiaryObjectType
    coordinates: DiaryGeometry.Transform,
    pageId: string,
    viewport: ViewportEngine,
    data?: any
  ): Promise<DiaryObject | null> {
    
    const toolDef = this.getTool(type);
    if (!toolDef) {
      console.error(`Tool definition not found for type: ${type}`);
      return null;
    }
    
    const finalCoords = {
        ...coordinates,
        width: toolDef.defaultSize.width,
        height: toolDef.defaultSize.height,
    };
    
    // Call the tool's specific createObject function
    const tempObject = toolDef.createObject(finalCoords, data);

    const safeZoneManager = new SafeZoneManager();
    const { cleanObjects } = await safeZoneManager.auditPageObjects(pageId, [tempObject], viewport);
    
    if (cleanObjects.length === 0) {
      return null;
    }
    
    const finalObject = cleanObjects[0];

    if (toolDef.validateObject) {
      const validation = toolDef.validateObject(finalObject);
      if (!validation.isValid) {
        return null;
      }
    }
    
    return finalObject;
  }
}
