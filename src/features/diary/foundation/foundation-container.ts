// src/features/diary/foundation/foundation-container.ts

import { InteractionStateMachine } from './interaction-state-machine';
import { ViewportEngine } from './viewport-engine';
import { ObjectLifecycleManager } from './object-lifecycle-manager';
import { InteractionCoordinator } from './interaction-coordinator';
import { HistoryManager } from './history-manager';
import { DiaryToolManager } from '../business/managers/tool-manager';
import { SafeZoneManager } from '../business/managers/safe-zone-manager';
import * as Strategies from '../business/strategies';
import type { DiaryObject } from '../types';
import { DiaryDragManager } from './drag-manager';
import { DiaryMode } from './object-lifecycle-manager';

interface FoundationContainerProps {
  pageSize: { width: number; height: number };
  handleObjectUpdate: (id: string, updates: Partial<DiaryObject>) => void;
  handleObjectDelete: (id: string, updates?: Partial<DiaryObject>) => void;
}

/**
 * FoundationContainer
 *
 * Acts as a DI container for all diary "foundation" services.
 * Responsibilities:
 *  - create and wire services once
 *  - allow handler updates (handlers may change identity in React)
 *  - lazily create DOM-connected services (ViewportEngine, InteractionCoordinator) inside connectDom
 *  - perform robust destroy() to teardown services and release references
 */
export class FoundationContainer {
  public stateMachine: InteractionStateMachine;
  public objects: ObjectLifecycleManager;
  public coordinator: InteractionCoordinator | null = null;
  public history: HistoryManager;
  public toolManager: DiaryToolManager;
  public safeZoneManager: SafeZoneManager;
  public dragManager: DiaryDragManager;
  public handleObjectUpdate: (id: string, updates: Partial<DiaryObject>) => void;
  public handleObjectDelete: (id: string, updates?: Partial<DiaryObject>) => void;

  // ViewportEngine is created when connectDom is called (depends on DOM node)
  public viewport: ViewportEngine | null = null;

  private isDestroyed = false;
  private props: FoundationContainerProps;

  // Internal handler refs to always call latest implementations without recreating coordinator
  private _handleObjectUpdateRef: { current: (id: string, updates: Partial<DiaryObject>) => void };
  private _handleObjectDeleteRef: { current: (id: string, updates?: Partial<DiaryObject>) => void };

  constructor(props: FoundationContainerProps) {
    this.props = props;

    // init handler refs pointing to initial functions
    this._handleObjectUpdateRef = { current: props.handleObjectUpdate };
    this._handleObjectDeleteRef = { current: props.handleObjectDelete };

    // Core services (non-DOM)
    this.stateMachine = new InteractionStateMachine();
    this.objects = new ObjectLifecycleManager({ mode: DiaryMode.EDIT });
    this.history = new HistoryManager();
    this.toolManager = DiaryToolManager.getInstance();
    this.safeZoneManager = new SafeZoneManager();
    this.dragManager = new DiaryDragManager();

    // Expose public handlers that delegate to refs
    this.handleObjectUpdate = (id: string, updates: Partial<DiaryObject>) => {
      try { this._handleObjectUpdateRef.current(id, updates); } catch (e) { console.error('handleObjectUpdate delegate error', e); }
    };
    this.handleObjectDelete = (id: string, updates?: Partial<DiaryObject>) => {
      try { this._handleObjectDeleteRef.current(id, updates); } catch (e) { console.error('handleObjectDelete delegate error', e); }
    };
  }

  /**
   * Allows updating the handler functions after initialization.
   * This is crucial because the handlers in the React hook are created with useCallback
   * and might be recreated, needing to be injected back into the services.
   *
   * We update internal refs and propagate to the coordinator (if present) so that
   * coordinator can call the latest functions without being re-created.
   */
  public updateHandlers(handlers: {
    handleObjectUpdate: (id: string, updates: Partial<DiaryObject>) => void;
    handleObjectDelete: (id: string, updates?: Partial<DiaryObject>) => void;
  }) {
    if (handlers.handleObjectUpdate) this._handleObjectUpdateRef.current = handlers.handleObjectUpdate;
    if (handlers.handleObjectDelete) this._handleObjectDeleteRef.current = handlers.handleObjectDelete;

    // Update public delegates
    this.handleObjectUpdate = (id: string, updates: Partial<DiaryObject>) => {
      try { this._handleObjectUpdateRef.current(id, updates); } catch (e) { console.error('handleObjectUpdate delegate error', e); }
    };
    this.handleObjectDelete = (id: string, updates?: Partial<DiaryObject>) => {
      try { this._handleObjectDeleteRef.current(id, updates); } catch (e) { console.error('handleObjectDelete delegate error', e); }
    };

    if (this.coordinator) {
      try {
        this.coordinator.updateHandlers({
          handleObjectUpdate: this.handleObjectUpdate,
          handleObjectDelete: this.handleObjectDelete,
        });
      } catch (e) {
        console.warn('[FoundationContainer] failed to propagate handlers to coordinator', e);
      }
    }
  }

  /**
   * Connects services that depend on a DOM element.
   * This must be called after the main component has mounted.
   * It is idempotent (safe to call multiple times).
   * @param containerElement The root HTML element for the diary canvas area.
   */
  public connectDom(containerElement: HTMLElement) {
    if (this.isDestroyed) {
      throw new Error('FoundationContainer is destroyed');
    }

    if (!containerElement) {
      throw new Error('connectDom requires a valid containerElement');
    }

    // If viewport already created and same container, skip
    if (this.viewport) {
      // Already connected. If container element differs, you may want to recreate viewport — not supported here.
      return;
    }

    try {
      // Create viewport engine (DOM dependent)
      this.viewport = new ViewportEngine(containerElement);

      // Create coordinator and wire up
      this.coordinator = new InteractionCoordinator({
        stateMachine: this.stateMachine,
        viewport: this.viewport,
        objects: this.objects,
        pageSize: this.props.pageSize,
        dragManager: this.dragManager,
        handleObjectUpdate: this.handleObjectUpdate,
        handleObjectDelete: this.handleObjectDelete,
      });

      // Register strategies
      this.registerInteractionStrategies();
    } catch (error) {
      console.error('[FoundationContainer] Failed to connect DOM or create coordinator:', error);
      // try best-effort cleanup
      try {
        this.viewport?.destroy();
      } catch (_) {}
      this.viewport = null;
      this.coordinator = null;
      throw error;
    }
  }

  private registerInteractionStrategies() {
    if (!this.coordinator) return;

    try {
      const editableContentStrategy = new Strategies.EditableContentStrategy();
      const boundedObjectStrategy = new Strategies.BoundedObjectStrategy();
      const simpleTransformStrategy = new Strategies.SimpleTransformStrategy();

      this.coordinator.registerStrategy('text', editableContentStrategy);
      this.coordinator.registerStrategy('sticker', boundedObjectStrategy);
      this.coordinator.registerStrategy('image', boundedObjectStrategy);
      this.coordinator.registerStrategy('drawing', boundedObjectStrategy);
      this.coordinator.registerStrategy('plant', boundedObjectStrategy);
      this.coordinator.registerStrategy('line', simpleTransformStrategy);
    } catch (e) {
      console.error('[FoundationContainer] Error registering interaction strategies:', e);
    }
  }

  public get isReady(): boolean {
    return !this.isDestroyed && !!this.coordinator && !!this.viewport;
  }

  /**
   * Tears down all services and event listeners.
   * This method is idempotent.
   */
  public destroy() {
    if (this.isDestroyed) return;

    try {
      this.stateMachine.destroy();
    } catch (e) {
      console.warn('[FoundationContainer] stateMachine.destroy failed', e);
    }

    try {
      this.objects.destroy();
    } catch (e) {
      console.warn('[FoundationContainer] objects.destroy failed', e);
    }

    try {
      this.coordinator?.destroy();
    } catch (e) {
      console.warn('[FoundationContainer] coordinator.destroy failed', e);
    } finally {
      this.coordinator = null;
    }

    try {
      this.viewport?.destroy();
    } catch (e) {
      console.warn('[FoundationContainer] viewport.destroy failed', e);
    } finally {
      this.viewport = null;
    }

    try {
      (this.dragManager as any)?.destroy?.();
    } catch (e) {
      // dragManager may not expose destroy
    }

    // clear other references
    this.history = null as any;
    this.toolManager = null as any;
    this.safeZoneManager = null as any;

    this.isDestroyed = true;
  }

  /**
   * Convenience methods that forward to the object lifecycle manager.
   * Using these keeps Consumers decoupled from internal structure.
   */
  public getObjectsByIds(ids: string[], pageIds?: string[]): DiaryObject[] {
    return this.objects.getObjectsByIds(ids, pageIds);
  }

  public getObjectsFromPages(pageIds: string[]): DiaryObject[] {
    return this.objects.getObjectsFromPages(pageIds);
  }
}
