// src/features/diary/foundation/object-lifecycle-manager.ts

import { diaryEventManager } from './event-manager';
import type { DiaryObject, DiaryGeometry, Layer, SelectionState, Command, GroupObject, ObjectBehavior } from '../types';
import { InteractionStateMachine } from './interaction-state-machine';
import { EnhancedGridSpatialIndex } from './spatial-index';

/** Diary-specific modes for different optimization strategies */
export enum DiaryMode {
  VIEW = 'view',
  EDIT = 'edit'
}

/** Enhanced spatial index configuration */
interface SpatialIndexConfig {
  gridSize?: number;
  coordinateSpace?: { width: number; height: number };
  mode?: DiaryMode;
}

/** Utility functions */
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const normDeg = (deg: number) => ((deg % 360) + 360) % 360;

/** Calculate axis-aligned bounding box for rotated rectangle */
function rotatedAABB(t: DiaryGeometry.Transform): DiaryGeometry.Rect {
  const cx = t.x + t.width / 2;
  const cy = t.y + t.height / 2;
  const rad = (normDeg(t.rotation || 0) * Math.PI) / 180;

  const corners = [
    { x: t.x, y: t.y },
    { x: t.x + t.width, y: t.y },
    { x: t.x + t.width, y: t.y + t.height },
    { x: t.x, y: t.y + t.height },
  ];

  const rotatePoint = (p: { x: number; y: number }) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
  };

  const rotatedCorners = corners.map(rotatePoint);
  const minX = Math.min(...rotatedCorners.map(p => p.x));
  const maxX = Math.max(...rotatedCorners.map(p => p.x));
  const minY = Math.min(...rotatedCorners.map(p => p.y));
  const maxY = Math.max(...rotatedCorners.map(p => p.y));
  
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Safe object update with enhanced validation */
function updateDiaryObject(object: DiaryObject, updates: Partial<DiaryObject>): DiaryObject {
  if (!object || !object.id) throw new Error('Invalid object provided to updateDiaryObject');
  
  const result: any = { ...object, ...updates };
  const t = updates.transform;

  if (t) {
    const base = object.transform || ({} as any);
    result.transform = {
      x: isNum(t.x) ? t.x : (isNum(base.x) ? base.x : 0),
      y: isNum(t.y) ? t.y : (isNum(base.y) ? base.y : 0),
      width: isNum(t.width) ? Math.max(0.001, t.width) : (isNum(base.width) ? Math.max(0.001, base.width) : 0.1),
      height: isNum(t.height) ? Math.max(0.001, t.height) : (isNum(base.height) ? Math.max(0.001, base.height) : 0.1),
      rotation: isNum(t.rotation) ? t.rotation : (isNum(base.rotation) ? base.rotation : 0),
    };
  }

  return result as DiaryObject;
}

/**
 * ObjectLifecycleManager
 *
 * Responsibilities:
 *  - Manage objects grouped by page
 *  - Maintain spatial indexes per page lazily (to reduce overhead in VIEW mode)
 *  - Provide efficient bulk registration
 *  - Clean up resources on reset/destroy
 */
export class ObjectLifecycleManager {
  private objectsByPage: Map<string, Map<string, DiaryObject>> = new Map();
  private spatialIndexes: Map<string, EnhancedGridSpatialIndex> = new Map();
  private maxZIndexByPage: Map<string, number> = new Map();
  private layersByPage: Map<string, Map<string, Layer>> = new Map();
  private selectionStateByPage: Map<string, SelectionState> = new Map();
  private commandHistory: Map<string, Command[]> = new Map();
  private historyIndex: Map<string, number> = new Map();
  
  private isDestroyed = false;
  private mode: DiaryMode = DiaryMode.EDIT;
  private indexConfig: SpatialIndexConfig;

  constructor(config?: SpatialIndexConfig & { mode?: DiaryMode }) {
    this.indexConfig = config ?? {};
    this.mode = config?.mode ?? DiaryMode.EDIT;
  }

  get isInitialized(): boolean { return !this.isDestroyed; }
  get currentMode(): DiaryMode { return this.mode; }

  /** Switch between view and edit modes */
  public setMode(mode: DiaryMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    
    // When switching to EDIT, ensure indexes optimized/created lazily when needed.
    this.spatialIndexes.forEach(index => {
      if ('optimize' in index) {
        try { index.optimize(); } catch (e) { /* fail gracefully */ }
      }
    });

    diaryEventManager.dispatchEvent('objects:modeChanged' as any, { mode } as any);
  }

  /** Reset all data and fully clear indexes/resources */
  public reset(): void {
    if (!this.isInitialized) return;
    
    try {
      // Destroy spatial indexes (if any)
      this.spatialIndexes.forEach(idx => {
        try { idx.destroy(); } catch (e) { /* ignore */ }
      });
      this.objectsByPage.clear();
      this.spatialIndexes.clear();
      this.maxZIndexByPage.clear();
      this.layersByPage.clear();
      this.selectionStateByPage.clear();
      this.commandHistory.clear();
      this.historyIndex.clear();
    } catch (e) {
      console.error('Error during ObjectLifecycleManager reset:', e);
    }
  }

  /** Full cleanup */
  public destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    this.reset();
  }

  /**
   * Internal: get spatial index for a page.
   * @param pageId page id string
   * @param createIfMissing if true, create an index when missing; otherwise return undefined when missing.
   */
  private getOrCreateSpatialIndex(pageId: string, createIfMissing: boolean = true): EnhancedGridSpatialIndex | undefined {
    if (!this.isInitialized || !pageId) {
      throw new Error('Manager not initialized or invalid pageId');
    }

    if (!this.spatialIndexes.has(pageId)) {
      if (!createIfMissing) return undefined;
      const config = { ...this.indexConfig, mode: this.mode };
      try {
        this.spatialIndexes.set(pageId, new EnhancedGridSpatialIndex(config));
      } catch (e) {
        console.error('Failed to create spatial index for page', pageId, e);
        return undefined;
      }
    }
    return this.spatialIndexes.get(pageId);
  }

  private updateMaxZIndex(pageId: string, zIndex: number): void {
    if (!this.isInitialized || !pageId || !isNum(zIndex)) return;
    
    const currentMax = this.maxZIndexByPage.get(pageId) ?? 0;
    this.maxZIndexByPage.set(pageId, Math.max(currentMax, zIndex));
  }

  public getNextZIndex(pageId: string, layerId?: string): number {
    if (!this.isInitialized || !pageId) return 1;
    
    let base = 0;
    if (layerId) {
      const layer = this.getLayer(pageId, layerId);
      base = layer?.zIndexBase || 0;
    }
    
    const currentMax = this.maxZIndexByPage.get(pageId) ?? 0;
    return Math.max(base + 1, currentMax + 1);
  }
  
  public getLayer(pageId: string, layerId: string): Layer | undefined {
    return this.layersByPage.get(pageId)?.get(layerId);
  }

  /**
   * Register a single object.
   * - Will NOT create a spatial index if we're in VIEW mode unless index already exists.
   */
  public registerObject(pageId: string, obj: DiaryObject, stateMachine?: InteractionStateMachine): boolean {
    if (!this.isInitialized || !obj?.id || !pageId) return false;

    try {
      if (!this.objectsByPage.has(pageId)) {
        this.objectsByPage.set(pageId, new Map());
      }

      const layerId = obj.layerId || 'default';
      const z = isNum(obj.zIndex) ? obj.zIndex : this.getNextZIndex(pageId, layerId);
      const objectWithZ = updateDiaryObject(obj, { zIndex: z, layerId });

      this.objectsByPage.get(pageId)!.set(obj.id, objectWithZ);

      // Only create index if in EDIT mode OR index already exists (on-demand)
      const shouldCreateIndex = (this.mode === DiaryMode.EDIT) || this.spatialIndexes.has(pageId);
      const spatialIndex = this.getOrCreateSpatialIndex(pageId, shouldCreateIndex);

      let success = true;
      if (spatialIndex) {
        try {
          success = spatialIndex.insert(objectWithZ);
        } catch (e) {
          success = false;
          console.error('Spatial index insert failed for object', obj.id, e);
        }
      }

      if (success) {
        this.updateMaxZIndex(pageId, z);
        if (this.mode === DiaryMode.EDIT) {
          this.selectObject(pageId, obj.id, stateMachine);
        }

        diaryEventManager.dispatchEvent('object:registered' as any, {
          pageId,
          objectId: obj.id,
          object: objectWithZ
        } as any);
      }

      return success;
    } catch (e) {
      console.error('Error registering object:', e);
      return false;
    }
  }
  
  /**
   * Efficient bulk registration:
   * - Create spatial index once if needed (EDIT mode).
   * - Insert objects into objectsByPage map and index in a loop (single index instance).
   */
  public registerBulkObjects(pageId: string, objects: DiaryObject[]): void {
    if (!this.isInitialized || !pageId || !objects) return;

    try {
      if (!this.objectsByPage.has(pageId)) {
        this.objectsByPage.set(pageId, new Map());
      }
      const pageMap = this.objectsByPage.get(pageId)!;

      // Only create index upfront if EDIT mode OR index previously existed
      const createIndex = (this.mode === DiaryMode.EDIT) || this.spatialIndexes.has(pageId);
      const spatialIndex = this.getOrCreateSpatialIndex(pageId, createIndex);

      // We'll compute/update max z in one pass
      let localMaxZ = this.maxZIndexByPage.get(pageId) ?? 0;

      for (const obj of objects) {
        if (!obj || !obj.id) continue;
        const layerId = obj.layerId || 'default';
        const z = isNum(obj.zIndex) ? obj.zIndex : Math.max(localMaxZ + 1, this.getNextZIndex(pageId, layerId));
        const objectWithZ = updateDiaryObject(obj, { zIndex: z, layerId });

        pageMap.set(obj.id, objectWithZ);

        if (spatialIndex) {
          try {
            spatialIndex.insert(objectWithZ);
          } catch (e) {
            console.error('Spatial index bulk-insert failed for object', obj.id, e);
          }
        }

        localMaxZ = Math.max(localMaxZ, z);
      }

      // persist computed max Z for page
      if (localMaxZ > 0) {
        this.maxZIndexByPage.set(pageId, Math.max(this.maxZIndexByPage.get(pageId) ?? 0, localMaxZ));
      }

      // If page is empty after ops, and we're in VIEW mode, free index to save memory
      if ((pageMap.size === 0) && this.mode === DiaryMode.VIEW) {
        const idx = this.spatialIndexes.get(pageId);
        if (idx) {
          try { idx.destroy(); } catch (e) { /* ignore */ }
          this.spatialIndexes.delete(pageId);
        }
      }
    } catch (e) {
      console.error('Error in registerBulkObjects:', e);
    }
  }

  public updateObject(pageId: string, objId: string, updates: Partial<DiaryObject>): DiaryObject | null {
    if (!this.isInitialized || !pageId || !objId) return null;

    const page = this.objectsByPage.get(pageId);
    const currentObject = page?.get(objId);
    if (!currentObject) return null;

    try {
      const updatedObject = updateDiaryObject(currentObject, updates);
      page!.set(objId, updatedObject);

      if ('zIndex' in updates && isNum(updates.zIndex)) {
        this.updateMaxZIndex(pageId, updates.zIndex);
      }

      // Only update spatial index if it exists (do not create one during update)
      if ((updates.transform || updates.layerId) && this.spatialIndexes.has(pageId)) {
        const spatialIndex = this.spatialIndexes.get(pageId)!;
        try {
          spatialIndex.update(updatedObject);
        } catch (e) {
          console.error('Spatial index update failed for object', objId, e);
        }
      }

      return updatedObject;
    } catch (e) {
      console.error('Error updating object:', e);
      return null;
    }
  }
  
  public removeObject(pageId: string, objId: string): boolean {
    if (!this.isInitialized || !pageId || !objId) return false;
    const page = this.objectsByPage.get(pageId);
    if (!page || !page.has(objId)) return false;

    try {
      page.delete(objId);
      const spatialIndex = this.spatialIndexes.get(pageId);
      if (spatialIndex) {
        try {
          spatialIndex.remove(objId);
        } catch (e) {
          console.error('Spatial index remove failed for object', objId, e);
        }
      }
      
      diaryEventManager.dispatchEvent('object:removed' as any, { pageId, objectId: objId } as any);

      // If page has become empty, free its index (in VIEW mode) to save memory
      if (page.size === 0 && this.mode === DiaryMode.VIEW) {
        const idx = this.spatialIndexes.get(pageId);
        if (idx) {
          try { idx.destroy(); } catch (e) { /* ignore */ }
          this.spatialIndexes.delete(pageId);
        }
      }

      return true;
    } catch (e) {
      console.error('Error removing object:', e);
      return false;
    }
  }

  public findObjectAtPoint(pageId: string, point: DiaryGeometry.Point): DiaryObject | null {
    if (!this.isInitialized || !pageId || !point) {
      return null;
    }

    const spatialIndex = this.spatialIndexes.get(pageId);
    const page = this.objectsByPage.get(pageId);
    if (!page) {
      return null;
    }

    // If no spatial index, fall back to linear scan (safe but slower)
    try {
      let candidateIds: string[] = [];
      if (spatialIndex) {
        candidateIds = spatialIndex.queryObjectIds(point);
      } else {
        // fallback: consider all objects on page
        candidateIds = Array.from(page.keys());
      }

      let topObject: DiaryObject | null = null;
      let topZIndex = -1;

      for (const id of candidateIds) {
        const obj = page.get(id);
        if (obj && this.pointInObject(point, obj)) {
            const zIndex = obj.zIndex || 0;
            if (zIndex > topZIndex) {
              topZIndex = zIndex;
              topObject = obj;
            }
        }
      }

      return topObject;
    } catch (e) {
      console.error('Error finding object at point:', e);
      return null;
    }
  }

  private pointInObject(point: DiaryGeometry.Point, object: DiaryObject): boolean {
    if (!this.isInitialized || !point || !object?.transform) return false;

    const t = object.transform;
    if (!isNum(point.x) || !isNum(point.y)) return false;

    const rotation = normDeg(t.rotation || 0);
    if (rotation === 0) {
      return (
        point.x >= t.x &&
        point.x <= t.x + t.width &&
        point.y >= t.y &&
        point.y <= t.y + t.height
      );
    }

    const centerX = t.x + t.width / 2;
    const centerY = t.y + t.height / 2;
    const radians = (-rotation * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    
    const translatedX = point.x - centerX;
    const translatedY = point.y - centerY;
    
    const rotatedX = translatedX * cos - translatedY * sin;
    const rotatedY = translatedX * sin + translatedY * cos;
    
    const localX = rotatedX + centerX;
    const localY = rotatedY + centerY;
    
    return (
      localX >= t.x &&
      localX <= t.x + t.width &&
      localY >= t.y &&
      localY <= t.y + t.height
    );
  }

  public getObjectsForPage(pageId: string): DiaryObject[] {
    if (!this.isInitialized || !pageId) return [];
    
    const pageMap = this.objectsByPage.get(pageId);
    return pageMap ? Array.from(pageMap.values()) : [];
  }

  public getObject(pageId: string, objectId: string): DiaryObject | null {
    if (!this.isInitialized || !pageId || !objectId) return null;
    return this.objectsByPage.get(pageId)?.get(objectId) || null;
  }

  public findPageIdForObject(objectId: string): string | null {
    for (const [pageId, objects] of this.objectsByPage.entries()) {
      if (objects.has(objectId)) {
        return pageId;
      }
    }
    return null;
  }
  
  public getObjectsByIds(ids: string[], pageIds?: string[]): DiaryObject[] {
    if (!this.isInitialized || ids.length === 0) return [];
    
    const result: DiaryObject[] = [];
    const idSet = new Set(ids);
    
    const targetPageMaps = pageIds 
      ? pageIds.map(id => this.objectsByPage.get(id)).filter((map): map is Map<string, DiaryObject> => !!map) 
      : Array.from(this.objectsByPage.values());
    
    for (const pageMap of targetPageMaps) {
      for (const objectId of Array.from(idSet)) {
          if (pageMap.has(objectId)) {
              result.push(pageMap.get(objectId)!);
              idSet.delete(objectId);
          }
      }
      if (idSet.size === 0) break;
    }
    
    return result;
  }

  public getObjectsFromPages(pageIds: string[]): DiaryObject[] {
    if (!this.isInitialized || pageIds.length === 0) return [];
    
    const result: DiaryObject[] = [];
    for (const pageId of pageIds) {
      const pageObjects = this.objectsByPage.get(pageId);
      if (pageObjects) {
        result.push(...Array.from(pageObjects.values()));
      }
    }
    
    return result;
  }

  // Simplified selectObject, assuming stateMachine is passed when needed
  public selectObject(pageId: string, objectId: string, stateMachine?: InteractionStateMachine): void {
      if (this.mode === DiaryMode.EDIT && stateMachine) {
          stateMachine.selectObjects([objectId], false);
      }
  }
}
