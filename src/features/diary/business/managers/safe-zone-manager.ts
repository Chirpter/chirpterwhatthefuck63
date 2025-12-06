// src/features/diary/business/managers/safe-zone-manager.ts

import type { DiaryObject, DiaryGeometry } from '../../types';
import type { ViewportEngine } from '../../foundation/viewport-engine';


interface SafeZoneViolation {
  objectId: string;
  violationType: 'outside' | 'partial' | 'tooSmall';
  severity: 'warning' | 'error';
  autoFixable: boolean;
  originalPosition?: DiaryGeometry.Transform;
}

export interface SafeZoneBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface CleanupReport {
  pageId: string;
  totalObjects: number;
  fixedObjects: number;
  removedObjects: number;
  violations: SafeZoneViolation[];
  autoFixedCount: number;
}

export class SafeZoneManager {
  private violations: Map<string, SafeZoneViolation[]> = new Map();
  
  private bounds: SafeZoneBounds = {
    left: 0.05,
    top: 0.05, 
    right: 0.95,
    bottom: 0.95
  };

  async auditPageObjects(
    pageId: string, 
    objects: DiaryObject[], 
    viewport: ViewportEngine
  ): Promise<{ report: CleanupReport, cleanObjects: DiaryObject[] }> {
    const violations: SafeZoneViolation[] = [];
    const cleanObjects: DiaryObject[] = [];
    let fixedCount = 0;
    let removedCount = 0;
    
    for (const obj of objects) {
      const objViolations = this.checkObjectSafety(obj, viewport);
      
      if (objViolations.length === 0) {
        cleanObjects.push(obj);
        continue;
      }
      
      let shouldKeep = true;
      let fixedObject = obj;
      
      for (const violation of objViolations) {
        violations.push(violation);
        
        if (violation.violationType === 'outside' && !this.isRecoverable(obj)) {
          shouldKeep = false;
          removedCount++;
          break;
        }
        
        if (violation.autoFixable) {
          fixedObject = this.fixObjectViolation(fixedObject, violation, viewport);
          fixedCount++;
        }
      }
      
      if (shouldKeep) {
        cleanObjects.push(fixedObject);
      }
    }
    
    this.violations.set(pageId, violations);
    
    const report: CleanupReport = {
      pageId,
      totalObjects: objects.length,
      fixedObjects: fixedCount,
      removedObjects: removedCount,
      violations,
      autoFixedCount: violations.filter(v => v.autoFixable).length
    };
    
    if (violations.length > 0) {
      this.notifyUser(report);
    }
    
    return { report, cleanObjects };
  }

  private checkObjectSafety(obj: DiaryObject, viewport: ViewportEngine): SafeZoneViolation[] {
    const violations: SafeZoneViolation[] = [];
    const coords = obj.transform;
    const originalPosition = { ...coords };
    
    if (coords.x < -0.5 || coords.y < -0.5 || coords.x > 1.5 || coords.y > 1.5) {
      violations.push({
        objectId: obj.id,
        violationType: 'outside',
        severity: 'error',
        autoFixable: false,
        originalPosition
      });
      return violations;
    }
    
    if (coords.x < this.bounds.left || coords.y < this.bounds.top || 
        coords.x + coords.width > this.bounds.right || 
        coords.y + coords.height > this.bounds.bottom) {
      violations.push({
        objectId: obj.id,
        violationType: coords.x < 0 || coords.y < 0 ? 'outside' : 'partial',
        severity: coords.x < 0 || coords.y < 0 ? 'error' : 'warning',
        autoFixable: this.isRecoverable(obj),
        originalPosition
      });
    }
    
    const minSize = viewport.getMinimumObjectSize();
    if (coords.width < minSize.width || coords.height < minSize.height) {
      violations.push({
        objectId: obj.id,
        violationType: 'tooSmall',
        severity: 'warning',
        autoFixable: true,
        originalPosition
      });
    }
    
    if (coords.width > 0.8 || coords.height > 0.8) {
      violations.push({
        objectId: obj.id,
        violationType: 'partial',
        severity: 'warning',
        autoFixable: true,
        originalPosition
      });
    }
    
    return violations;
  }

  private isRecoverable(obj: DiaryObject): boolean {
    const { x, y, width, height } = obj.transform;
    const extendedBounds = { left: -0.3, top: -0.3, right: 1.3, bottom: 1.3 };
    const corners = [
      { x, y }, { x: x + width, y }, { x, y: y + height }, { x: x + width, y: y + height }
    ];
    return corners.some(corner => 
      corner.x >= extendedBounds.left && corner.x <= extendedBounds.right &&
      corner.y >= extendedBounds.top && corner.y <= extendedBounds.bottom
    );
  }

  private fixObjectViolation(obj: DiaryObject, violation: SafeZoneViolation, viewport: ViewportEngine): DiaryObject {
    let fixedCoords = { ...obj.transform };
    
    switch (violation.violationType) {
      case 'outside':
      case 'partial':
        fixedCoords = viewport.constrainToSafeZone(fixedCoords);
        break;
      case 'tooSmall':
        const minSize = viewport.getMinimumObjectSize();
        fixedCoords.width = Math.max(fixedCoords.width, minSize.width);
        fixedCoords.height = Math.max(fixedCoords.height, minSize.height);
        fixedCoords = viewport.constrainToSafeZone(fixedCoords);
        break;
    }
    
    return {
      ...obj,
      transform: fixedCoords,
      metadata: { ...obj.metadata, updatedAt: new Date(), version: obj.metadata.version + 1 }
    };
  }

  async cleanupOrphanedObjects(pageId: string, objects: DiaryObject[]): Promise<{ cleanObjects: DiaryObject[]; removedCount: number; }> {
    const cleanObjects: DiaryObject[] = [];
    let removedCount = 0;
    
    for (const obj of objects) {
      if (this.isRecoverable(obj)) {
        cleanObjects.push(obj);
      } else {
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      this.notifyUser({
        pageId, totalObjects: objects.length, fixedObjects: 0, removedObjects: removedCount, violations: [], autoFixedCount: 0
      }, `Removed ${removedCount} corrupted objects`);
    }
    
    return { cleanObjects, removedCount };
  }

  private notifyUser(report: CleanupReport, customMessage?: string): void {
    const message = customMessage || this.generateReportMessage(report);
    window.dispatchEvent(new CustomEvent('diary:safeZoneReport', { detail: { report, message } }));
  }
  
  private generateReportMessage(report: CleanupReport): string {
    const { violations, fixedObjects, removedObjects } = report;
    if (violations.length === 0) return "No issues found.";

    let message = `Found ${violations.length} issue(s). `;
    if (fixedObjects > 0) message += `${fixedObjects} object(s) were auto-corrected. `;
    if (removedObjects > 0) message += `${removedObjects} object(s) were removed due to being irrecoverably off-page.`;
    return message;
  }


  getSafeZoneBounds(): SafeZoneBounds {
    return { ...this.bounds };
  }

  updateSafeZoneBounds(newBounds: Partial<SafeZoneBounds>): void {
    this.bounds = { ...this.bounds, ...newBounds };
  }
}
