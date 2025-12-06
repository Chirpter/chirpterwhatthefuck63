// src/features/diary/foundation/performance-manager.ts

export interface UpdatePayload<TMeta = Record<string, unknown>> {
  id: string;
  meta?: TMeta;
  priority?: "low" | "normal" | "high";
}

export interface PerformanceManagerConfig<TMeta = Record<string, unknown>> {
  /** Target to dispatch event, defaults to window */
  target?: EventTarget;
  /** Name of the batch update event, defaults to 'diary:batchUpdate' */
  eventName?: string;
  /** Limits the number of updates per batch, defaults to Infinity */
  batchLimit?: number;
  /** Hook that runs before dispatching a batch */
  onBeforeDispatch?: (updates: UpdatePayload<TMeta>[]) => void;
  /** Hook that runs after dispatching a batch */
  onAfterDispatch?: (updates: UpdatePayload<TMeta>[]) => void;
}

export class PerformanceManager<TMeta = Record<string, unknown>> {
  private renderQueue: Map<string, UpdatePayload<TMeta>> = new Map();
  private animationFrame: number | null = null;
  private isDestroyed = false;
  private target: EventTarget;
  private eventName: string;
  private batchLimit: number;
  private onBeforeDispatch?: (updates: UpdatePayload<TMeta>[]) => void;
  private onAfterDispatch?: (updates: UpdatePayload<TMeta>[]) => void;

  constructor(config: PerformanceManagerConfig<TMeta> = {}) {
    this.target = config.target ?? window;
    this.eventName = config.eventName ?? "diary:batchUpdate";
    this.batchLimit = config.batchLimit ?? Infinity;
    this.onBeforeDispatch = config.onBeforeDispatch;
    this.onAfterDispatch = config.onAfterDispatch;
  }

  destroy(): void {
    this.isDestroyed = true;
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    this.renderQueue.clear();
  }

  scheduleObjectUpdate(payload: UpdatePayload<TMeta>): void {
    if (this.isDestroyed) return;

    // Overwrite if the same ID is scheduled, ensuring uniqueness and latest state.
    this.renderQueue.set(payload.id, payload);

    if (this.animationFrame === null) {
      this.animationFrame = requestAnimationFrame(() =>
        this.processRenderQueue()
      );
    }
  }

  private processRenderQueue(): void {
    if (this.isDestroyed) return;

    try {
      if (this.renderQueue.size > 0) {
        // Sort by priority to process important updates first
        const sorted = Array.from(this.renderQueue.values()).sort(
          (a, b) => this.priorityWeight(b.priority) - this.priorityWeight(a.priority)
        );

        this.renderQueue.clear();

        // If batching is needed
        const batches =
          this.batchLimit < Infinity
            ? this.chunkArray(sorted, this.batchLimit)
            : [sorted];

        for (const batch of batches) {
          this.onBeforeDispatch?.(batch);
          this.target.dispatchEvent(
            new CustomEvent(this.eventName, { detail: { updates: batch } })
          );
          this.onAfterDispatch?.(batch);
        }
      }
    } finally {
      // Always reset to ensure it's not stuck
      this.animationFrame = null;
    }
  }

  private priorityWeight(priority: UpdatePayload<TMeta>["priority"]): number {
    switch (priority) {
      case "high":
        return 2;
      case "low":
        return 0;
      default: // 'normal' or undefined
        return 1;
    }
  }

  private chunkArray<T>(arr: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      result.push(arr.slice(i, i + size));
    }
    return result;
  }
}
