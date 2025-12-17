
// src/services/client/error-manager.service.ts

import { ApiServiceError } from '@/lib/errors';

/**
 * @fileoverview A simple, client-side error manager to catch and log global errors.
 * This provides a basic framework for error handling and can be expanded later
 * to include features like remote logging or user-facing error messages.
 */

interface ErrorEntry {
  type: 'javascript' | 'promise' | 'custom';
  message: string;
  stack?: string;
  timestamp: number;
  filename?: string;
  lineno?: number;
  colno?: number;
  reason?: any; // Add reason for promise rejections
  // Specific to our custom errors
  code?: string; 
}

class ErrorManager {
  private static instance: ErrorManager;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): ErrorManager {
    if (!ErrorManager.instance) {
      ErrorManager.instance = new ErrorManager();
    }
    return ErrorManager.instance;
  }

  public initialize(): void {
    if (this.isInitialized || typeof window === 'undefined') {
      return;
    }

    this.setupGlobalErrorHandling();
    this.isInitialized = true;
    console.log("ErrorManager initialized.");
  }

  private setupGlobalErrorHandling(): void {
    // Catch standard JavaScript errors
    window.addEventListener('error', (event: ErrorEvent) => {
        let stack: string | undefined;
        let message = event.message;

        // If the main error object is missing, try to construct a message
        if (!event.error && event.message) {
            message = `Script error: ${event.message} at ${event.filename}:${event.lineno}`;
        } else if (event.error instanceof Error) {
            stack = event.error.stack;
            message = event.error.message;
        }

        this.logError({
            type: 'javascript',
            message: message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            stack: stack,
        });
    });


    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      let message = 'Unhandled promise rejection';
      let stack: string | undefined;
      let code: string | undefined;
      const reason = event.reason;

      if (reason instanceof ApiServiceError) {
        message = reason.message;
        stack = reason.stack;
        code = reason.code;
      } else if (reason instanceof Error) {
        message = reason.message;
        stack = reason.stack;
      } else if (typeof reason === 'string' && reason.trim()) { 
        message = reason;
      } else if (typeof reason === 'object' && reason !== null) {
        message = (reason as any).message || `Unhandled rejection with non-Error object.`;
      } else if (reason !== undefined && reason !== null) {
        message = `Unhandled rejection with value: ${String(reason)}`;
      }

      this.logError({
        type: 'promise',
        message: message,
        stack: stack,
        reason: event.reason,
        code: code,
      });
    });
  }

  public logError(errorData: Omit<ErrorEntry, 'timestamp'> & { timestamp?: number }): void {
    try {
      const errorEntry: ErrorEntry = {
        timestamp: Date.now(),
        type: errorData.type || 'custom',
        message: errorData.message || "An undefined error occurred.", // Fallback message
        stack: errorData.stack,
        filename: errorData.filename,
        lineno: errorData.lineno,
        colno: errorData.colno,
        reason: errorData.reason,
        code: errorData.code,
      };
      
      const logObject = Object.fromEntries(
          Object.entries(errorEntry).filter(([, value]) => value !== undefined && value !== null)
      );

      if (Object.keys(logObject).length <= 2 && !logObject.message) {
        logObject.message = "An empty or undefined error object was caught.";
      }
      
      console.error(`[ErrorManager - ${errorEntry.type.toUpperCase()}]`, logObject);

    } catch (loggingError) {
      console.error('[ErrorManager - FATAL]', 'Failed to process and log an error. Raw data:', errorData, 'Logging Error:', loggingError);
    }
  }
}

// Export a singleton instance
export const AppErrorManager = ErrorManager.getInstance();
