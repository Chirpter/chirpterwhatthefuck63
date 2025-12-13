// src/features/vocabulary/utils/error-handler.ts
// ============================================================================
// CENTRALIZED ERROR HANDLING FOR VOCABULARY FEATURE
// Provides consistent error handling and user-friendly error messages
// ============================================================================

/**
 * Custom error class for vocabulary-related errors
 * Provides structured error information for better debugging and UX
 */
export class VocabularyError extends Error {
    constructor(
      message: string,
      public readonly code: VocabularyErrorCode,
      public readonly originalError?: Error,
      public readonly context?: Record<string, any>
    ) {
      super(message);
      this.name = 'VocabularyError';
      
      // Maintains proper stack trace for debugging
      if (Error.captureStackTrace) {
        Error.captureStackTrace(this, VocabularyError);
      }
    }
  }
  
  /**
   * Error codes for different vocabulary operations
   * Maps to i18n translation keys for user-facing messages
   */
  export enum VocabularyErrorCode {
    // Validation errors
    VALIDATION_TERM_REQUIRED = 'VALIDATION_TERM_REQUIRED',
    VALIDATION_MEANING_REQUIRED = 'VALIDATION_MEANING_REQUIRED',
    VALIDATION_HTML_NOT_ALLOWED = 'VALIDATION_HTML_NOT_ALLOWED',
    VALIDATION_SPECIAL_CHARS = 'VALIDATION_SPECIAL_CHARS',
    VALIDATION_MAX_LENGTH = 'VALIDATION_MAX_LENGTH',
    
    // Folder errors
    FOLDER_NAME_EMPTY = 'FOLDER_NAME_EMPTY',
    FOLDER_NAME_TOO_LONG = 'FOLDER_NAME_TOO_LONG',
    FOLDER_ALREADY_EXISTS = 'FOLDER_ALREADY_EXISTS',
    FOLDER_RESERVED_NAME = 'FOLDER_RESERVED_NAME',
    FOLDER_INVALID_CHARS = 'FOLDER_INVALID_CHARS',
    
    // Database errors
    DB_ITEM_NOT_FOUND = 'DB_ITEM_NOT_FOUND',
    DB_CREATE_FAILED = 'DB_CREATE_FAILED',
    DB_UPDATE_FAILED = 'DB_UPDATE_FAILED',
    DB_DELETE_FAILED = 'DB_DELETE_FAILED',
    DB_QUERY_FAILED = 'DB_QUERY_FAILED',
    
    // Sync errors
    SYNC_ENQUEUE_FAILED = 'SYNC_ENQUEUE_FAILED',
    
    // Auth errors
    AUTH_USER_NOT_AUTHENTICATED = 'AUTH_USER_NOT_AUTHENTICATED',
    
    // Unknown errors
    UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  }
  
  /**
   * Maps error codes to user-friendly messages
   * These should be moved to i18n files for proper translation
   */
  export const ERROR_MESSAGES: Record<VocabularyErrorCode, string> = {
    [VocabularyErrorCode.VALIDATION_TERM_REQUIRED]: 'Term is required',
    [VocabularyErrorCode.VALIDATION_MEANING_REQUIRED]: 'Meaning is required',
    [VocabularyErrorCode.VALIDATION_HTML_NOT_ALLOWED]: 'HTML tags are not allowed',
    [VocabularyErrorCode.VALIDATION_SPECIAL_CHARS]: 'Special characters like < > ( ) [ ] { } are not allowed',
    [VocabularyErrorCode.VALIDATION_MAX_LENGTH]: 'Text exceeds maximum length',
    
    [VocabularyErrorCode.FOLDER_NAME_EMPTY]: 'Folder name is required',
    [VocabularyErrorCode.FOLDER_NAME_TOO_LONG]: 'Folder name too long (max 50 characters)',
    [VocabularyErrorCode.FOLDER_ALREADY_EXISTS]: 'A folder with this name already exists',
    [VocabularyErrorCode.FOLDER_RESERVED_NAME]: 'This folder name is reserved',
    [VocabularyErrorCode.FOLDER_INVALID_CHARS]: 'Folder name contains invalid characters',
    
    [VocabularyErrorCode.DB_ITEM_NOT_FOUND]: 'Vocabulary item not found',
    [VocabularyErrorCode.DB_CREATE_FAILED]: 'Failed to create vocabulary item',
    [VocabularyErrorCode.DB_UPDATE_FAILED]: 'Failed to update vocabulary item',
    [VocabularyErrorCode.DB_DELETE_FAILED]: 'Failed to delete vocabulary item',
    [VocabularyErrorCode.DB_QUERY_FAILED]: 'Failed to load vocabulary items',
    
    [VocabularyErrorCode.SYNC_ENQUEUE_FAILED]: 'Failed to sync changes',
    
    [VocabularyErrorCode.AUTH_USER_NOT_AUTHENTICATED]: 'User not authenticated',
    
    [VocabularyErrorCode.UNKNOWN_ERROR]: 'An unexpected error occurred',
  };
  
  /**
   * Handles errors consistently across the vocabulary feature
   * Logs errors appropriately and throws VocabularyError for UI handling
   */
  export function handleVocabularyError(
    error: unknown,
    context: string,
    defaultCode: VocabularyErrorCode = VocabularyErrorCode.UNKNOWN_ERROR
  ): never {
    // Log error with context for debugging
    console.error(`[Vocabulary/${context}]`, error);
    
    // If already a VocabularyError, re-throw it
    if (error instanceof VocabularyError) {
      throw error;
    }
    
    // If it's a standard Error, wrap it
    if (error instanceof Error) {
      throw new VocabularyError(
        ERROR_MESSAGES[defaultCode],
        defaultCode,
        error,
        { context }
      );
    }
    
    // For unknown error types
    throw new VocabularyError(
      ERROR_MESSAGES[VocabularyErrorCode.UNKNOWN_ERROR],
      VocabularyErrorCode.UNKNOWN_ERROR,
      undefined,
      { context, originalError: error }
    );
  }
  
  /**
   * Creates a VocabularyError with the given code
   * Useful for validation errors where we want to throw immediately
   */
  export function createVocabularyError(
    code: VocabularyErrorCode,
    context?: Record<string, any>
  ): VocabularyError {
    return new VocabularyError(
      ERROR_MESSAGES[code],
      code,
      undefined,
      context
    );
  }
  
  /**
   * Type guard to check if an error is a VocabularyError
   */
  export function isVocabularyError(error: unknown): error is VocabularyError {
    return error instanceof VocabularyError;
  }
  
  /**
   * Extracts a user-friendly error message from any error type
   * Used in UI components to display appropriate error messages
   */
  export function getErrorMessage(error: unknown): string {
    if (isVocabularyError(error)) {
      return error.message;
    }
    
    if (error instanceof Error) {
      return error.message;
    }
    
    return ERROR_MESSAGES[VocabularyErrorCode.UNKNOWN_ERROR];
  }
  
  /**
   * Logs error without throwing
   * Useful for non-critical operations where we want to continue execution
   */
  export function logVocabularyError(
    error: unknown,
    context: string,
    severity: 'error' | 'warn' = 'error'
  ): void {
    const logFn = severity === 'error' ? console.error : console.warn;
    logFn(`[Vocabulary/${context}]`, error);
    
    if (isVocabularyError(error) && error.originalError) {
      logFn('Original error:', error.originalError);
    }
  }
