// src/features/diary/types/index.ts

// --- PRIORITY 1: UNIFIED TYPE SYSTEM ---

import { InteractionStateMachine } from "../foundation/interaction-state-machine";

export namespace DiaryGeometry {
  export interface Transform {
    x: number;      // 0-1 viewport coordinates
    y: number;      // 0-1 viewport coordinates  
    width: number;  // 0-1 viewport coordinates
    height: number; // 0-1 viewport coordinates
    rotation?: number; // degrees
  }
  
  export interface AbsoluteTransform {
    x: number;      // pixels
    y: number;      // pixels
    width: number;  // pixels
    height: number; // pixels
    rotation?: number;
  }
  
  export interface Point {
    x: number;
    y: number;
  }
  
  export interface Bounds {
    left: number;
    top: number;
    right: number;
    bottom: number;
  }

  export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
  }
}

// --- Base Object System ---

// NEW: Segregated behavior interfaces
export interface DragBehavior {
  isDraggable: boolean;
}

export interface ResizeBehavior {
  isResizable: boolean;
  maintainAspectRatio?: boolean;
}

export interface EditBehavior {
  isEditable: boolean;
  allowInlineEdit?: boolean;
}

export interface SelectionBehavior {
  isSelectable: boolean;
  showSelectionUI?: boolean;
}

// The main behavior interface is now a composite type.
export interface ObjectBehavior extends DragBehavior, ResizeBehavior, EditBehavior, SelectionBehavior {
  zIndexRange?: [number, number];
}


export interface ObjectConstraints {
  minSize?: { width: number; height: number };
  maxSize?: { width: number; height: number };
  aspectRatio?: number;
  snapToGrid?: boolean;
  constrainToBounds?: boolean;
}

export interface ObjectMetadata {
  createdAt: Date;
  updatedAt: Date;
  version: number;
  tags?: string[];
  group?: string;
}

export interface BaseObject {
  readonly id: string;
  readonly type: DiaryObjectType; // Use the specific union type
  transform: DiaryGeometry.Transform;
  zIndex: number;
  behavior: ObjectBehavior;
  constraints: ObjectConstraints;
  metadata: ObjectMetadata;
  // NEW: Advanced properties for layers and grouping
  layerId?: string;
  visible?: boolean;
  locked?: boolean;
  parentGroupId?: string;
}


// --- Type-specific Object Interfaces ---

export interface TextStyle {
    fontSize: number;
    color: string;
    fontWeight: 'normal' | 'bold';
    fontStyle: 'normal' | 'italic';
    textAlign: 'left' | 'center' | 'right';
    textDecoration: 'none' | 'underline';
    fontFamily?: string;
}

export interface TextObject extends BaseObject {
  readonly type: 'text';
  content: string; // HTML content, or JSON for special widgets
  style: TextStyle;
}

export interface ImageContent {
    src: string; // data URI
    alt?: string;
    naturalWidth?: number;
    naturalHeight?: number;
}

export interface ImageStyle {
    borderRadius?: number;
    opacity?: number;
    filter?: string;
}

export interface ImageObject extends BaseObject {
  readonly type: 'image';
  content: ImageContent;
  style?: ImageStyle;
}

export interface DrawingStroke {
    points: { x: number; y: number; pressure?: number }[];
    color: string;
    width: number;
}

export interface DrawingObject extends BaseObject {
  readonly type: 'drawing';
  content: {
    strokes: DrawingStroke[];
    backgroundColor?: string;
  };
  style?: {
    backgroundOpacity?: number;
  };
}

export interface StickerObject extends BaseObject {
  readonly type: 'sticker';
  content: {
    emoji: string;
    category?: string;
  };
}

export interface LineObject extends BaseObject {
  readonly type: 'line';
  content: {
    style: 'solid' | 'dashed' | 'dotted';
  };
  style: {
    color: string;
    width?: number;
  };
}

export type GrowthStage = 'seed' | 'sapling' | 'mature' | 'withered';

export interface PlantObjectData {
  growthStage: GrowthStage;
  lastWatered: number; // timestamp
}

export interface PlantObject extends BaseObject {
  readonly type: 'plant';
  content: PlantObjectData;
}

// NEW: Group Object
export interface GroupObject extends BaseObject {
    readonly type: 'group';
    childIds: string[];
}


// Perfect discriminated union - ZERO type overlap
export type DiaryObject = 
  | TextObject 
  | ImageObject 
  | DrawingObject 
  | StickerObject 
  | LineObject
  | PlantObject
  | GroupObject;

// FIX: This type now includes 'group'
export type DiaryObjectType = 'text' | 'image' | 'drawing' | 'sticker' | 'line' | 'plant' | 'group';

// --- Interaction & Tool System Types ---

export type ResizeHandle = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top' | 'bottom' | 'left' | 'right';

export interface KeyboardModifiers {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
}

export enum InteractionType {
  OBJECT_SELECT = 'object_select',
  OBJECT_DRAG = 'object_drag',
  OBJECT_RESIZE = 'object_resize',
  CONTENT_EDIT = 'content_edit',
  CANVAS_TAP = 'canvas_tap',
  PAGE_FLIP = 'page_flip',
}

export interface ObjectZone {
  type: 'content' | 'drag_handle' | 'resize_handle' | 'body';
  element: HTMLElement;
  interactionType: InteractionType;
  cursor: string;
}

export interface StrictInteractionEvent {
  type: InteractionType;
  target: {
    objectId?: string;
    objectType?: DiaryObjectType;
    zone?: ObjectZone['type'];
    resizeHandle?: ResizeHandle;
  };
  pointer: {
    screen: DiaryGeometry.Point;
    page: DiaryGeometry.Point;
    relative: DiaryGeometry.Point;
  };
  modifiers: KeyboardModifiers;
  originalEvent: PointerEvent;
}

export type DiaryTool = 'select' | 'text' | 'image' | 'drawing' | 'sticker' | 'line' | 'table' | 'chart' | 'checklist' | 'plant' | 'dateMarker';

export interface ToolDefinition {
    id: DiaryTool;
    name: string;
    icon: string; // IconName from lucide-react
    category: 'basic' | 'widgets' | 'media';
    defaultSize: DiaryGeometry.Transform;
    behavior: ObjectBehavior;
    constraints: ObjectConstraints;
    validateObject?: (object: DiaryObject) => { isValid: boolean; errors: string[] };
    createObject: (coordinates: DiaryGeometry.Transform, data?: any) => DiaryObject;
    config?: {
        allowsStyleCustomization?: boolean;
        requiresFileInput?: boolean;
        supportsMultipleInstances?: boolean;
    };
}


// --- Utility & Other Types ---

export interface DiaryEntry {
    id?: number; // Now optional and a number (auto-incrementing)
    date: string; // 'YYYY-MM-DD' format
    objects: DiaryObject[];
    mood?: string; // e.g., an emoji '😊'
}


// --- REFACTORED: Drag and Resize State ---
export type DragState = {
  isDragging: true;
  isResizing: false;
  objectIds: string[];
  startPoint: DiaryGeometry.Point;
  currentPoint: DiaryGeometry.Point;
  startPositions: Map<string, DiaryGeometry.Transform>;
};

export type ResizeState = {
  isResizing: true;
  isDragging: false;
  objectId: string;
  handle: ResizeHandle;
  startPoint: DiaryGeometry.Point;
  currentPoint: DiaryGeometry.Point;
  startTransform: DiaryGeometry.Transform;
  aspectRatio?: number;
};

// A discriminated union for the current interaction state managed by the Coordinator
export type InteractionState = DragState | ResizeState;


export interface ObjectInteractionStrategy {
  getZones(element: HTMLElement, isSelected: boolean): ObjectZone[];
  handleInteraction(event: StrictInteractionEvent, stateMachine: InteractionStateMachine): boolean;
}

// NEW: Layer, Selection, and Command types for advanced management
export interface SelectionState {
  selectedIds: Set<string>;
  focusedId: string | null;
  selectionRect?: DiaryGeometry.Rect;
}

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  zIndexBase: number;
}

export interface Command {
  id: string;
  execute(): void;
  undo(): void;
  description: string;
}


// --- Helper Functions for Default Values ---

export const createDefaultBehavior = (type: DiaryObjectType): ObjectBehavior => {
  const baseBehavior: ObjectBehavior = {
    isDraggable: true,
    isResizable: true,
    isEditable: false,
    allowInlineEdit: false,
    isSelectable: true,
    showSelectionUI: true,
  };

  switch (type) {
    case 'text':
      return { 
        ...baseBehavior, 
        isEditable: true, 
        allowInlineEdit: true 
      };
    case 'image':
    case 'sticker':
    case 'plant':
      return { 
        ...baseBehavior, 
        maintainAspectRatio: true 
      };
    case 'line':
      return { 
        ...baseBehavior, 
        isResizable: false 
      };
    default:
      return baseBehavior;
  }
};

export const createDefaultConstraints = (type: DiaryObjectType): ObjectConstraints => {
  const common = {
    minSize: { width: 0.03, height: 0.02 }, // relative sizes
    constrainToBounds: true,
    snapToGrid: false,
  };

  switch (type) {
    case 'line':
      return { ...common, minSize: { width: 0.05, height: 0.002 } };
    case 'sticker':
    case 'plant':
      return { ...common, aspectRatio: 1, minSize: {width: 0.05, height: 0.05} };
    case 'image':
      return { ...common, minSize: { width: 0.05, height: 0.05 } };
    default:
      return common;
  }
};

export const createObjectMetadata = (): ObjectMetadata => ({
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 1,
});

export const createDefaultTextStyle = (): TextStyle => ({
    fontSize: 14,
    color: '#374151',
    fontWeight: 'normal',
    fontStyle: 'normal', 
    textAlign: 'left',
    textDecoration: 'none'
});
