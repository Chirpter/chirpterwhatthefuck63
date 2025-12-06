// src/features/diary/foundation/event-manager.ts
import type { DiaryGeometry, DiaryTool, DiaryObject } from '../types';

export interface DiaryEventDetail {
  [key: string]: any;
}

interface DiaryEventMap {
  'selection:changed': { from: string[]; to: string[] };
  'diary:startTextEdit': { objectId: string; objectType: string };
  'drag:start': { objectIds: string[]; pageId: string; startPoint: DiaryGeometry.Point };
  'drag:update': { objectIds: string[]; pageId: string; currentPoint: DiaryGeometry.Point };
  'drag:end': { 
    objectIds: string[]; 
    pageId: string; 
    startPoint: DiaryGeometry.Point; 
    endPoint: DiaryGeometry.Point;
    originalTransforms: Map<string, DiaryGeometry.Transform>;
  };
  'drag:cancel': { 
    objectIds: string[]; 
    pageId: string;
    originalTransforms: Map<string, DiaryGeometry.Transform>;
  };
  'diary:createObject': {
    tool: DiaryTool;
    coords: DiaryGeometry.Transform;
    pageId: string;
    data?: any;
  };
  'diary:requestStartDrag': {
    objectIds: string[];
    pageId: string;
    pointerEvent: PointerEvent;
  };
  'diary:stateChange': { from: string; to: string; context: any };
}

export type DiaryEventListener<K extends keyof DiaryEventMap> = (detail: DiaryEventMap[K]) => void;

type Listener = Function;

export interface DispatchOptions {
  /** If true, listeners will be invoked asynchronously (scheduled) to avoid blocking. Default: false (sync). */
  async?: boolean;
}

/**
 * DiaryEventManager: lightweight pub/sub for diary internals.
 * Responsibilities:
 *  - manage listeners in an internal Map
 *  - provide safe dispatch (sync default, optional async)
 *  - minimize heavy DEV logging (console.trace) to avoid overwhelming dev console
 */
export class DiaryEventManager {
  private static instance: DiaryEventManager;
  private isEditMode: boolean = false;
  private eventListeners: Map<string, Set<Listener>> = new Map();

  private constructor() {
    // internal-only: use Map rather than DOM EventTarget for control
  }

  static getInstance(): DiaryEventManager {
    if (!DiaryEventManager.instance) {
      DiaryEventManager.instance = new DiaryEventManager();
    }
    return DiaryEventManager.instance;
  }

  setEditMode(editMode: boolean): void {
    this.isEditMode = editMode;
  }

  /**
   * Dispatch an event. By default, listeners are invoked synchronously (preserve existing semantics).
   * Use options.async = true to schedule listeners asynchronously (non-blocking).
   */
  dispatchEvent<K extends keyof DiaryEventMap>(eventName: K, detail: DiaryEventMap[K], options?: DispatchOptions): boolean;
  dispatchEvent(eventName: string, detail?: DiaryEventDetail, options?: DispatchOptions): boolean {
    if (process.env.NODE_ENV === 'development' && eventName === 'diary:createObject') {
      console.debug('[EVENT_MANAGER] Dispatching diary:createObject event (dev):', detail);
    }

    if (this.isEditMode && eventName.startsWith('pageflip:')) {
      return false;
    }

    const listeners = this.eventListeners.get(eventName);
    if (!listeners || listeners.size === 0) return true;

    const useAsync = options?.async === true;

    // iterate snapshot to avoid mutation during iteration issues
    const snapshot = Array.from(listeners);
    if (useAsync) {
      // schedule listeners asynchronously (do not block caller)
      for (const listener of snapshot) {
        // use queueMicrotask for minimal delay when available, fallback to setTimeout
        try {
          if (typeof queueMicrotask === 'function') {
            queueMicrotask(() => {
              try { (listener as Function)(detail); } catch (e) { console.error('Error in async listener for', eventName, e); }
            });
          } else {
            setTimeout(() => {
              try { (listener as Function)(detail); } catch (e) { console.error('Error in async listener for', eventName, e); }
            }, 0);
          }
        } catch (e) {
          // fallback safe call
          try { (listener as Function)(detail); } catch (err) { console.error('Error invoking listener for', eventName, err); }
        }
      }
    } else {
      // synchronous dispatch (existing behavior)
      for (const listener of snapshot) {
        try {
          (listener as Function)(detail);
        } catch (e) {
          console.error(`Error in event listener for ${eventName}:`, e);
        }
      }
    }

    return true;
  }

  /**
   * Add a listener for eventName. Returns an unsubscribe function.
   * Behavior:
   *  - listeners are stored in a Set to avoid exact-duplicate function registrations.
   *  - minimal DEV logging only.
   */
  addEventListener<K extends keyof DiaryEventMap>(eventName: K, callback: DiaryEventListener<K>): () => void {
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName as string, new Set());
    }

    const listeners = this.eventListeners.get(eventName as string)!;
    listeners.add(callback as Listener);

    if (process.env.NODE_ENV === 'development' && eventName === 'diary:createObject') {
      console.debug(`[EVENT_MANAGER] Added listener for diary:createObject — total listeners: ${listeners.size}`);
    }

    // return unsubscribe
    return () => {
      const s = this.eventListeners.get(eventName as string);
      if (s) {
        s.delete(callback as Listener);
        if (s.size === 0) this.eventListeners.delete(eventName as string);
      }
      if (process.env.NODE_ENV === 'development' && eventName === 'diary:createObject') {
        console.debug(`[EVENT_MANAGER] Removed listener for diary:createObject — remaining: ${this.eventListeners.get(eventName as string)?.size ?? 0}`);
      }
    };
  }

  removeAllListeners(): void {
    this.eventListeners.clear();
  }

  onSelectionChanged(callback: DiaryEventListener<'selection:changed'>): () => void {
    return this.addEventListener('selection:changed', callback);
  }
}

export const diaryEventManager = DiaryEventManager.getInstance();
