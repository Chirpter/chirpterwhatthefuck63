// src/features/diary/foundation/history-manager.ts

import type { Command } from '../types';

interface HistoryManagerConfig {
  maxSize?: number;
}

interface HistoryEvents {
  change: () => void;
  undo: (command: Command) => void;
  redo: (command: Command) => void;
  execute: (command: Command) => void;
}

type EventCallback<T> = T extends keyof HistoryEvents 
  ? HistoryEvents[T] 
  : never;

/**
 * Manages the command history for undo and redo operations.
 * This is a straightforward implementation of the Command Pattern.
 * Now with event emission capabilities.
 */
export class HistoryManager {
  private history: Command[] = [];
  private currentIndex: number = -1;
  private readonly maxSize: number;
  private isExecuting = false; // Prevents re-entrant calls
  private eventListeners: Map<keyof HistoryEvents, Set<Function>> = new Map();

  constructor(config?: HistoryManagerConfig) {
    this.maxSize = config?.maxSize ?? 100;
  }

  /**
   * Clears the entire history stack.
   */
  destroy(): void {
    this.history = [];
    this.currentIndex = -1;
    this.emit('change');
  }

  /**
   * Executes a new command and adds it to the history stack.
   * This will clear any "redo" history.
   * @param command The command to execute.
   */
  executeCommand(command: Command): void {
    if (this.isExecuting) return;

    this.isExecuting = true;
    try {
      // Clear any commands that were undone
      this.history = this.history.slice(0, this.currentIndex + 1);

      // Execute and add the new command
      command.execute();
      this.history.push(command);
      this.currentIndex++;

      // Enforce the maximum history size
      if (this.history.length > this.maxSize) {
        this.history.shift();
        this.currentIndex--;
      }

      this.emit('execute', command);
      this.emit('change');
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Executes multiple commands as a single batch operation
   * @param commands Array of commands to execute
   */
  executeBatch(commands: Command[]): void {
    if (this.isExecuting || commands.length === 0) return;

    this.isExecuting = true;
    try {
      // Clear any commands that were undone
      this.history = this.history.slice(0, this.currentIndex + 1);

      // Execute all commands in the batch
      commands.forEach(command => {
        command.execute();
        this.history.push(command);
        this.currentIndex++;
      });

      // Enforce the maximum history size
      while (this.history.length > this.maxSize) {
        this.history.shift();
        this.currentIndex--;
      }

      this.emit('change');
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Undoes the most recent command.
   * @returns True if an action was undone, false otherwise.
   */
  undo(): boolean {
    if (this.isExecuting || !this.canUndo()) return false;
    
    this.isExecuting = true;
    try {
      const command = this.history[this.currentIndex];
      command.undo();
      this.currentIndex--;
      
      this.emit('undo', command);
      this.emit('change');
      return true;
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Redoes the most recently undone command.
   * @returns True if an action was redone, false otherwise.
   */
  redo(): boolean {
    if (this.isExecuting || !this.canRedo()) return false;
    
    this.isExecuting = true;
    try {
      this.currentIndex++;
      const command = this.history[this.currentIndex];
      command.execute();
      
      this.emit('redo', command);
      this.emit('change');
      return true;
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Checks if there is an action to undo.
   */
  canUndo(): boolean {
    return this.currentIndex >= 0;
  }

  /**
   * Checks if there is an action to redo.
   */
  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  /**
   * Gets the current history state for persistence
   */
  getSnapshot(): { history: Command[]; currentIndex: number } {
    return {
      history: [...this.history],
      currentIndex: this.currentIndex
    };
  }

  /**
   * Restores history from a snapshot
   */
  restoreSnapshot(snapshot: { history: Command[]; currentIndex: number }): void {
    this.history = [...snapshot.history];
    this.currentIndex = snapshot.currentIndex;
    this.emit('change');
  }

  /**
   * Subscribe to history events
   */
  on<T extends keyof HistoryEvents>(event: T, callback: EventCallback<T>): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  /**
   * Unsubscribe from history events
   */
  off<T extends keyof HistoryEvents>(event: T, callback: EventCallback<T>): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  /**
   * Emit events to all subscribers
   */
  private emit<T extends keyof HistoryEvents>(event: T, ...args: any[]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`Error in ${event} event listener:`, error);
        }
      });
    }
  }
}
