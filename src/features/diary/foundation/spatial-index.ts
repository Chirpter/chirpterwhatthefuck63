// src/features/diary/foundation/spatial-index.ts

import type { DiaryObject, DiaryGeometry } from '../types';

/** Enhanced spatial index interface */
interface ISpatialIndex {
  insert(object: DiaryObject): boolean;
  remove(objectId: string): boolean;
  update(object: DiaryObject): boolean;
  queryObjectIds(point: DiaryGeometry.Point): string[];
  queryObjectIdsByRect(rect: DiaryGeometry.Rect): string[];
  queryObjectIdsByLayer(layerId: string): string[];
  clear(): void;
  destroy(): void;
  optimize(): void;
}

/** Utility functions */
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Calculate axis-aligned bounding box for rotated rectangle */
function rotatedAABB(t: DiaryGeometry.Transform): DiaryGeometry.Rect {
  const cx = t.x + t.width / 2;
  const cy = t.y + t.height / 2;
  const rad = ((t.rotation || 0) * Math.PI) / 180;

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

/** High-performance grid-based spatial index */
export class EnhancedGridSpatialIndex implements ISpatialIndex {
  private gridSize: number;
  private spaceW: number;
  private spaceH: number;
  private mode: string;
  
  private grid: Map<string, Set<string>> = new Map();
  private objectToCell: Map<string, Set<string>> = new Map();
  private layerIndex: Map<string, Set<string>> = new Map();
  private objectToLayer: Map<string, string> = new Map();
  private isDestroyed = false;

  constructor(config?: any) {
    this.gridSize = Math.max(4, Math.floor(config?.gridSize || 16));
    const space = config?.coordinateSpace || { width: 1, height: 1 };
    this.spaceW = isNum(space.width) && space.width > 0 ? space.width : 1;
    this.spaceH = isNum(space.height) && space.height > 0 ? space.height : 1;
    this.mode = config?.mode || 'edit';
  }

  get isInitialized(): boolean { return !this.isDestroyed; }

  clear(): void {
    if (!this.isInitialized) return;
    this.grid.clear();
    this.objectToCell.clear();
    this.layerIndex.clear();
    this.objectToLayer.clear();
  }

  destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    this.clear();
  }

  optimize(): void {
    if (!this.isInitialized || this.mode !== 'view') return;
    
    const activeGridCells = new Map<string, Set<string>>();
    for (const [cellKey, objectIds] of this.grid) {
      if (objectIds.size > 0) {
        activeGridCells.set(cellKey, objectIds);
      }
    }
    this.grid = activeGridCells;
  }

  private cellKey(col: number, row: number): string {
    return `${'${col}'},${'${row}'}`;
  }

  private getCellKey(x: number, y: number): string {
    if (!isNum(x) || !isNum(y)) return this.cellKey(0, 0);
    const col = clamp(Math.floor((clamp(x, 0, this.spaceW) / this.spaceW) * this.gridSize), 0, this.gridSize - 1);
    const row = clamp(Math.floor((clamp(y, 0, this.spaceH) / this.spaceH) * this.gridSize), 0, this.gridSize - 1);
    return this.cellKey(col, row);
  }

  private getCellsForAABB(box: DiaryGeometry.Rect): string[] {
    if (!isNum(box.x) || !isNum(box.y) || !isNum(box.width) || !isNum(box.height)) {
      return [this.getCellKey(0, 0)];
    }
    
    const x0 = clamp(box.x, 0, this.spaceW);
    const y0 = clamp(box.y, 0, this.spaceH);
    const x1 = clamp(box.x + Math.max(0, box.width), 0, this.spaceW);
    const y1 = clamp(box.y + Math.max(0, box.height), 0, this.spaceH);

    const c0 = clamp(Math.floor((x0 / this.spaceW) * this.gridSize), 0, this.gridSize - 1);
    const r0 = clamp(Math.floor((y0 / this.spaceH) * this.gridSize), 0, this.gridSize - 1);
    const c1 = clamp(Math.floor((x1 / this.spaceW) * this.gridSize), 0, this.gridSize - 1);
    const r1 = clamp(Math.floor((y1 / this.spaceH) * this.gridSize), 0, this.gridSize - 1);

    const cells = new Set<string>();
    for (let c = c0; c <= c1; c++) {
      for (let r = r0; r <= r1; r++) cells.add(this.cellKey(c, r));
    }
    return Array.from(cells);
  }

  insert(object: DiaryObject): boolean {
    if (!this.isInitialized || !object?.id || !object?.transform) return false;
    
    this.remove(object.id);

    try {
      const t = object.transform;
      const aabb = rotatedAABB({
        x: t.x, y: t.y,
        width: Math.max(0.001, t.width || 0.001),
        height: Math.max(0.001, t.height || 0.001),
        rotation: t.rotation || 0,
      });

      const cells = this.getCellsForAABB(aabb);
      if (cells.length === 0) return false;

      const cellSet = new Set(cells);
      for (const key of cells) {
        let bucket = this.grid.get(key);
        if (!bucket) {
          bucket = new Set();
          this.grid.set(key, bucket);
        }
        bucket.add(object.id);
      }
      this.objectToCell.set(object.id, cellSet);

      const layerId = object.layerId || 'default';
      this.objectToLayer.set(object.id, layerId);
      if (!this.layerIndex.has(layerId)) {
        this.layerIndex.set(layerId, new Set());
      }
      this.layerIndex.get(layerId)!.add(object.id);

      return true;
    } catch (e) {
      console.error('Error inserting object into spatial index:', e);
      return false;
    }
  }

  update(object: DiaryObject): boolean {
    return this.insert(object);
  }

  remove(objectId: string): boolean {
    if (!this.isInitialized || !objectId) return false;
    
    try {
      const cells = this.objectToCell.get(objectId);
      if (!cells) return false;
      
      for (const key of cells) {
        const bucket = this.grid.get(key);
        if (bucket) {
          bucket.delete(objectId);
          if (bucket.size === 0) this.grid.delete(key);
        }
      }
      this.objectToCell.delete(objectId);

      const layerId = this.objectToLayer.get(objectId);
      if (layerId) {
        this.layerIndex.get(layerId)?.delete(objectId);
        this.objectToLayer.delete(objectId);
      }

      return true;
    } catch (e) {
      console.error('Error removing object from spatial index:', e);
      return false;
    }
  }

  queryObjectIds(point: DiaryGeometry.Point): string[] {
    if (!this.isInitialized || !point || !isNum(point.x) || !isNum(point.y)) return [];
    
    try {
      const cell = this.grid.get(this.getCellKey(point.x, point.y));
      return cell ? Array.from(cell) : [];
    } catch (e) {
      console.error('Error querying spatial index:', e);
      return [];
    }
  }

  queryObjectIdsByRect(rect: DiaryGeometry.Rect): string[] {
    if (!this.isInitialized) return [];
    
    try {
      const cells = this.getCellsForAABB(rect);
      const result = new Set<string>();
      
      for (const key of cells) {
        const bucket = this.grid.get(key);
        if (bucket) {
          for (const id of bucket) result.add(id);
        }
      }
      return Array.from(result);
    } catch (e) {
      console.error('Error rect-query spatial index:', e);
      return [];
    }
  }

  queryObjectIdsByLayer(layerId: string): string[] {
    if (!this.isInitialized) return [];
    const layer = this.layerIndex.get(layerId);
    return layer ? Array.from(layer) : [];
  }
}
