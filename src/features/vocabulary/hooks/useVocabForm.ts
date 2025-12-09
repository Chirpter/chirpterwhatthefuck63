
// src/features/vocabulary/hooks/useVocabForm.ts

import { useState, useCallback, useMemo } from 'react';
import { validateVocabFields, validateFolderName } from '../utils/validation.utils';
import { resolveFolderForStorage } from '../utils/folder.utils';

interface UseVocabFormOptions {
  allFolders: string[];
  onSubmitSuccess?: () => void;
  onSubmitError?: (error: Error) => void;
}

interface VocabFormState {
  term: string;
  meaning: string;
  example: string;
  folder: string;
  termLang: string;
  meanLang: string;
  termLanguage: string;
  meaningLanguage: string;
}

export function useVocabForm(options: UseVocabFormOptions) {
  const { allFolders, onSubmitSuccess, onSubmitError } = options;
  
  const [isCreatingNewFolder, setIsCreatingNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Real-time vocab validation
  const getVocabValidation = useCallback((formState: Partial<VocabFormState>) => {
    return validateVocabFields({
      term: formState.term,
      meaning: formState.meaning,
      example: formState.example,
    });
  }, []);

  // Real-time folder validation
  const folderValidation = useMemo(() => {
    if (!isCreatingNewFolder) {
      return { isValid: true, error: null };
    }
    return validateFolderName(newFolderName, allFolders);
  }, [isCreatingNewFolder, newFolderName, allFolders]);

  // Handle folder selection change
  const handleFolderChange = useCallback((selectedFolder: string) => {
    if (selectedFolder === 'new') {
      setIsCreatingNewFolder(true);
      return;
    }
    setIsCreatingNewFolder(false);
    setNewFolderName('');
  }, []);

  // Resolve final folder value for submission
  const resolveFinalFolder = useCallback((currentFolder: string) => {
    try {
      return resolveFolderForStorage(currentFolder, isCreatingNewFolder, newFolderName);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      }
      throw err;
    }
  }, [isCreatingNewFolder, newFolderName]);

  // Generic submit handler
  const handleSubmit = useCallback(async (
    formState: VocabFormState,
    submitFn: (data: any) => Promise<void>
  ) => {
    console.log('[useVocabForm] HandleSubmit called with formState:', formState);
    // Validate vocab fields
    const vocabValidation = getVocabValidation(formState);
    if (!vocabValidation.isValid) {
      setError(vocabValidation.error!);
      console.error('[useVocabForm] Vocab validation failed:', vocabValidation.error);
      return false;
    }

    // Validate folder if creating new
    if (isCreatingNewFolder && !folderValidation.isValid) {
      setError(folderValidation.error!);
       console.error('[useVocabForm] Folder validation failed:', folderValidation.error);
      return false;
    }

    setError(null);
    setIsSubmitting(true);
    console.log('[useVocabForm] Submitting...');

    try {
      const finalFolder = resolveFinalFolder(formState.folder);
      
      const dataToSubmit = {
        term: formState.term.trim(),
        meaning: formState.meaning.trim(),
        example: formState.example.trim() || undefined,
        folder: finalFolder,
        termLang: formState.termLanguage,
        meanLang: formState.meaningLanguage,
      };
      
      console.log('[useVocabForm] Data prepared for submission:', dataToSubmit);
      await submitFn(dataToSubmit);
      
      if (onSubmitSuccess) {
        onSubmitSuccess();
      }
      console.log('[useVocabForm] Submit successful.');
      return true;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error.message);
      console.error('[useVocabForm] Submit error:', error);
      
      if (onSubmitError) {
        onSubmitError(error);
      }
      
      return false;
    } finally {
      setIsSubmitting(false);
       console.log('[useVocabForm] Submission process finished.');
    }
  }, [
    isCreatingNewFolder,
    folderValidation,
    resolveFinalFolder,
    getVocabValidation,
    onSubmitSuccess,
    onSubmitError,
  ]);

  // Reset form state
  const resetForm = useCallback(() => {
    setIsCreatingNewFolder(false);
    setNewFolderName('');
    setIsSubmitting(false);
    setError(null);
  }, []);

  return {
    // State
    isCreatingNewFolder,
    newFolderName,
    isSubmitting,
    error,
    
    // Setters
    setIsCreatingNewFolder,
    setNewFolderName,
    setError,
    
    // Validation
    getVocabValidation,
    folderValidation,
    
    // Handlers
    handleFolderChange,
    handleSubmit,
    resetForm,
  };
}
