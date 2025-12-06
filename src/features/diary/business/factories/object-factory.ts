// src/features/diary/business/factories/object-factory.ts

import { generateLocalUniqueId } from '@/lib/utils';
import type { 
    DiaryObject, 
    DiaryObjectType, 
    TextObject,
    ImageObject,
    ImageContent,
    DrawingObject,
    StickerObject,
    LineObject,
    PlantObject,
    BaseObject,
    DiaryGeometry,
    GroupObject,
    TextStyle
} from '../../types';
import { 
    createDefaultBehavior, 
    createDefaultConstraints, 
    createObjectMetadata,
    createDefaultTextStyle
} from '../../types';

// Helper to validate line style
const isValidLineStyle = (style: any): style is 'solid' | 'dashed' | 'dotted' => {
  return ['solid', 'dashed', 'dotted'].includes(style);
};

// Overload signatures for external type safety and IntelliSense
type CreateObjectParams = 
  | { type: 'text', transform: DiaryGeometry.Transform, content?: string }
  | { type: 'image', transform: DiaryGeometry.Transform, content?: ImageContent }
  | { type: 'drawing', transform: DiaryGeometry.Transform, content?: { strokes: any[] } }
  | { type: 'sticker', transform: DiaryGeometry.Transform, content: string } // emoji
  | { type: 'line', transform: DiaryGeometry.Transform, content?: { style: 'solid' | 'dashed' | 'dotted', color: string, width: number } }
  | { type: 'plant', transform: DiaryGeometry.Transform, content?: any }
  | { type: 'group', transform: DiaryGeometry.Transform, content: { childIds: string[] } };
  
export class ObjectFactory {
  /**
   * Creates a new diary object of a specified type.
   * This is a single, unified factory method that is fully type-safe.
   * @param params - An object containing the type, transform, and content for the new object.
   * @returns A newly created DiaryObject.
   */
  static create(params: CreateObjectParams): DiaryObject {
    const { type, transform, content } = params;
    
    const objectId = generateLocalUniqueId();

    const baseObject: Omit<BaseObject, 'type'> = {
      id: objectId,
      transform,
      zIndex: 1, // Will be updated by the manager
      behavior: createDefaultBehavior(type),
      constraints: createDefaultConstraints(type),
      metadata: createObjectMetadata(),
      visible: true,
      locked: false,
    };

    let finalObject: DiaryObject;

    switch (type) {
      case 'text':
        finalObject = {
          ...baseObject,
          type: 'text',
          content: (content as string) || '<p>New Text</p>',
          style: createDefaultTextStyle()
        } satisfies TextObject;
        break;

      case 'image':
        const imageContent = content as ImageContent | undefined;
        finalObject = {
          ...baseObject,
          type: 'image',
          content: {
            src: imageContent?.src || '',
            alt: imageContent?.alt || 'diary image'
          },
          style: {}
        } satisfies ImageObject;
        break;

      case 'drawing':
        const drawingContent = content as { strokes: any[] } | undefined;
        finalObject = {
          ...baseObject,
          type: 'drawing',
          content: {
            strokes: drawingContent?.strokes || []
          }
        } satisfies DrawingObject;
        break;

      case 'sticker':
        if (typeof content !== 'string' || !content) {
          throw new Error('Sticker requires a string as content');
        }
        finalObject = {
          ...baseObject,
          type: 'sticker',
          content: { emoji: content }
        } satisfies StickerObject;
        break;

      case 'line':
        const lineContent = content as { style: string, color: string, width: number } | undefined;
        finalObject = {
          ...baseObject,
          type: 'line',
          content: {
            style: isValidLineStyle(lineContent?.style) ? lineContent.style : 'solid'
          },
          style: {
            color: lineContent?.color || '#6B7280',
            width: lineContent?.width || 2
          }
        } satisfies LineObject;
        break;

      case 'plant':
        finalObject = {
          ...baseObject,
          type: 'plant',
          content: {
            growthStage: 'seed',
            lastWatered: Date.now()
          }
        } satisfies PlantObject;
        break;

      case 'group':
        const groupContent = content as { childIds: string[] };
        finalObject = {
            ...baseObject,
            type: 'group',
            childIds: groupContent.childIds,
        } satisfies GroupObject;
        break;

      default:
        // This should be unreachable if DiaryObjectType is correct
        const _exhaustiveCheck: never = type;
        throw new Error(`Unknown object type: ${_exhaustiveCheck}`);
    }

    return finalObject;
  }

  // --- Type Guards ---
  static isTextObject(obj: DiaryObject): obj is TextObject { return obj.type === 'text'; }
  static isImageObject(obj: DiaryObject): obj is ImageObject { return obj.type === 'image'; }
  static isDrawingObject(obj: DiaryObject): obj is DrawingObject { return obj.type === 'drawing'; }
  static isStickerObject(obj: DiaryObject): obj is StickerObject { return obj.type === 'sticker'; }
  static isLineObject(obj: DiaryObject): obj is LineObject { return obj.type === 'line'; }
  static isPlantObject(obj: DiaryObject): obj is PlantObject { return obj.type === 'plant'; }
}
