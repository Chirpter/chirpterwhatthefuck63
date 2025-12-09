
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
  example?: string;
  folder: string;
  termLanguage: string;
  meaningLanguage: string;
}

export function useVocabForm(options: UseVocabFormOptions) {
  const { allFolders, onSubmitSuccess, onSubmitError } = options;
  
  const [isCreatingNewFolder, setIsCreatingNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getVocabValidation = useCallback((formState: Partial<VocabFormState>) => {
    return validateVocabFields({
      term: formState.term || '',
      meaning: formState.meaning || '',
      example: formState.example,
    });
  }, []);

  const folderValidation = useMemo(() => {
    if (!isCreatingNewFolder) {
      return { isValid: true, error: null };
    }
    return validateFolderName(newFolderName, allFolders);
  }, [isCreatingNewFolder, newFolderName, allFolders]);

  const handleFolderChange = useCallback((selectedFolder: string) => {
    if (selectedFolder === 'new') {
      setIsCreatingNewFolder(true);
      return;
    }
    setIsCreatingNewFolder(false);
    setNewFolderName('');
  }, []);

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

  const handleSubmit = useCallback(async (
    formState: VocabFormState,
    submitFn: (data: any) => Promise<void>
  ) => {
    const vocabValidation = getVocabValidation(formState);
    if (!vocabValidation.isValid) {
      setError(vocabValidation.error!);
      return false;
    }

    if (isCreatingNewFolder && !folderValidation.isValid) {
      setError(folderValidation.error!);
      return false;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const finalFolder = resolveFinalFolder(formState.folder);
      
      const dataToSubmit = {
        term: formState.term.trim(),
        meaning: formState.meaning.trim(),
        example: formState.example ? formState.example.trim() : undefined,
        folder: finalFolder,
        termLang: formState.termLanguage,
        meanLang: formState.meaningLanguage,
      };
      
      await submitFn(dataToSubmit);
      
      onSubmitSuccess?.();
      return true;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error.message);
      onSubmitError?.(error);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [
    isCreatingNewFolder,
    folderValidation,
    resolveFinalFolder,
    getVocabValidation,
    onSubmitSuccess,
    onSubmitError,
  ]);

  const resetForm = useCallback(() => {
    setIsCreatingNewFolder(false);
    setNewFolderName('');
    setIsSubmitting(false);
    setError(null);
  }, []);

  return {
    isCreatingNewFolder,
    newFolderName,
    isSubmitting,
    error,
    setIsCreatingNewFolder,
    setNewFolderName,
    setError,
    getVocabValidation,
    folderValidation,
    handleFolderChange,
    handleSubmit,
    resetForm,
  };
}

    