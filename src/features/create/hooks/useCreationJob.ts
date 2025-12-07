

'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/useToast';
import { updateLibraryItem } from '@/services/library-service';
import { getLibraryItemById } from '@/services/client/library-service';
import { 
    createBookAndStartGeneration, 
    addChaptersToBook, 
    regenerateBookContent 
} from '@/services/book-creation.service';
import { createPieceAndStartGeneration, regeneratePieceContent } from '@/services/piece-creation.service';
import type { GenerateBookContentInput } from '@/lib/types';
import type { GeneratePieceInput } from '@/lib/types';
import type { Book, Piece, LibraryItem, CreationFormValues, PieceFormValues } from '@/lib/types';
import { 
  LANGUAGES, 
  BOOK_LENGTH_OPTIONS, 
  MAX_IMAGE_SIZE_BYTES, 
  MAX_PROMPT_LENGTH,
} from '@/lib/constants'; 
import { useUser } from '@/contexts/user-context';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getFavoritesKey } from '@/lib/utils';

const JOB_TIMEOUT_MS = 180000;
const MAX_CHAPTER_COUNT = 15;
const DEFAULT_BOOK_PROMPT = "A fantasy story about a lost dragon finding its way home. Title: Home";
const DEFAULT_PIECE_PROMPT = "A short, motivational quote about perseverance.";

interface UseCreationJobProps {
  type: 'book' | 'piece';
  editingBookId?: string | null;
  mode?: string | null;
}

export const useCreationJob = ({ type, editingBookId, mode }: UseCreationJobProps) => {
  const { toast } = useToast();
  const { t, i18n } = useTranslation(['createPage', 'common', 'toast']);
  const router = useRouter();
  const { user } = useUser();
  
  const jobTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const coverPromptManuallyEditedRef = useRef(false);
  
  // --- STATE MANAGEMENT ---
  
  const defaultFormValues: CreationFormValues = useMemo(() => {
    const defaultOption = BOOK_LENGTH_OPTIONS.find(opt => !opt.disabled) || BOOK_LENGTH_OPTIONS[0];
    const baseValues = {
        primaryLanguage: i18n.language,
        availableLanguages: [i18n.language],
        bilingualFormat: 'sentence' as 'sentence' | 'phrase',
        tags: [],
    };
    if (type === 'book') {
        return {
          ...baseValues,
          aiPrompt: DEFAULT_BOOK_PROMPT,
          title: { primary: '' },
          coverImageOption: 'ai',
          coverImageAiPrompt: '',
          coverImageFile: null,
          previousContentSummary: '',
          targetChapterCount: defaultOption.defaultChapters,
          bookLength: defaultOption.value,
          generationScope: 'full',
          presentationStyle: 'book',
          aspectRatio: undefined,
        };
    } else { // piece
        return {
          ...baseValues,
          aiPrompt: DEFAULT_PIECE_PROMPT,
          title: { primary: '' },
          presentationStyle: 'card',
          aspectRatio: '3:4',
          // Book specific fields (defaults)
          coverImageOption: 'none',
          coverImageAiPrompt: '',
          coverImageFile: null,
          previousContentSummary: '',
          targetChapterCount: 0,
          bookLength: 'short-story',
          generationScope: 'full',
        };
    }
  }, [type, i18n.language]);

  const [formData, setFormData] = useState<CreationFormValues>(defaultFormValues);
  const [isPromptDefault, setIsPromptDefault] = useState(true);
  const [isLoadingExistingBook, setIsLoadingExistingBook] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [finalizedId, setFinalizedId] = useState<string | null>(null);
  const [jobData, setJobData] = useState<Book | Piece | null>(null);

  // --- DERIVED STATE & MEMOS ---

  const isProUser = useMemo(() => user?.plan === 'pro', [user]);

  const minChaptersForCurrentLength = useMemo(() => {
    if (type !== 'book') return 1;
    const option = BOOK_LENGTH_OPTIONS.find(opt => opt.value === formData.bookLength);
    return option?.minChapters || 1;
  }, [type, formData.bookLength]);
  
  const creditCost = useMemo(() => {
    if (type === 'piece') return 1;
    if (mode === 'addChapters') return formData.targetChapterCount || 1;
    
    let contentCost = 0;
    switch (formData.bookLength) {
      case 'short-story': contentCost = 1; break;
      case 'mini-book': contentCost = 2; break;
      case 'standard-book': contentCost = formData.generationScope === 'full' ? 8 : 2; break;
      case 'long-book': contentCost = 15; break;
    }
    const coverCost = (formData.coverImageOption === 'ai' || formData.coverImageOption === 'upload') ? 1 : 0;
    return contentCost + coverCost;
  }, [type, mode, formData]);

  const isBusy = isSubmitting || (!!activeId && !finalizedId);
  const canGenerate = useMemo(() => user ? user.credits >= creditCost : false, [user, creditCost]);

  const promptError = useMemo(() => {
    if (formData.aiPrompt.length > MAX_PROMPT_LENGTH) {
      return 'too_long';
    }
    return null;
  }, [formData.aiPrompt]);

  const validationMessage = useMemo(() => {
    const trimmedPrompt = formData.aiPrompt.trim();
    if (mode !== 'addChapters' && isPromptDefault) {
      // Valid to use default
    } else if (trimmedPrompt.length === 0) {
      return t('formErrors.prompt.empty');
    }
    if (promptError) {
      return t('formErrors.prompt.tooLong');
    }
    if (formData.availableLanguages.length > 1 && !formData.availableLanguages.find(l => l !== formData.primaryLanguage)) {
        return t('formErrors.language.secondaryMissing');
    }
    if (formData.availableLanguages.length > 1 && new Set(formData.availableLanguages).size < formData.availableLanguages.length) {
        return t('formErrors.language.sameLanguage');
    }
    if (type === 'book') {
        const isChapterCountValid = formData.targetChapterCount >= minChaptersForCurrentLength && formData.targetChapterCount <= MAX_CHAPTER_COUNT;
        if (!isChapterCountValid) {
            return t('formErrors.chapters.outOfRange', { min: minChaptersForCurrentLength, max: MAX_CHAPTER_COUNT });
        }
        const isCoverValid = formData.coverImageOption !== 'upload' || (isProUser && !!formData.coverImageFile);
        if (!isCoverValid && formData.coverImageOption === 'upload') {
            return t('formErrors.cover.uploadMissing');
        }
    }
    return ''; // Valid
  }, [formData, type, mode, isProUser, minChaptersForCurrentLength, isPromptDefault, t, promptError]);

  // --- CALLBACKS & HANDLERS ---

  const clearJobTimeout = useCallback(() => {
    if (jobTimeoutRef.current) {
      clearTimeout(jobTimeoutRef.current);
      jobTimeoutRef.current = null;
    }
  }, []);

  const reset = useCallback((newType?: 'book' | 'piece') => {
    clearJobTimeout();
    setFormData(defaultFormValues);
    setIsPromptDefault(true);
    setIsSubmitting(false);
    setActiveId(null);
    setFinalizedId(null);
    setJobData(null);
    coverPromptManuallyEditedRef.current = false;
    if (user) sessionStorage.removeItem(`activeJobId_${user.uid}`);
  }, [defaultFormValues, user, clearJobTimeout]);

  const handleValueChange = useCallback((name: keyof CreationFormValues, value: any) => {
    if (name === 'coverImageAiPrompt') {
      coverPromptManuallyEditedRef.current = true;
    }
    if (name === 'isBilingual') {
        setFormData(prev => {
            const newLangs = value ? [prev.primaryLanguage, ''] : [prev.primaryLanguage];
            return { ...prev, availableLanguages: newLangs };
        });
    } else if (name === 'secondaryLanguage') {
        setFormData(prev => ({
            ...prev,
            availableLanguages: [prev.primaryLanguage, value],
        }));
    } else if (name === 'primaryLanguage') {
        setFormData(prev => ({
            ...prev,
            primaryLanguage: value,
            availableLanguages: [value, ...prev.availableLanguages.filter(l => l !== prev.primaryLanguage && l !== value)],
        }));
    } else {
        setFormData(prev => ({ ...prev, [name]: typeof value === 'function' ? value(prev[name]) : value }));
    }
  }, []);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'aiPrompt') setIsPromptDefault(false);
    if (name === 'coverImageAiPrompt') coverPromptManuallyEditedRef.current = true;
    
    if (name === 'targetChapterCount') {
        const numValue = parseInt(value, 10);
        setFormData(prev => ({ ...prev, [name]: isNaN(numValue) ? 0 : numValue }));
    } else {
        setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handlePromptFocus = useCallback(() => {
    if (isPromptDefault) {
      setFormData(prev => ({ ...prev, aiPrompt: '' }));
      setIsPromptDefault(false);
    }
  }, [isPromptDefault]);
  
  const handleTagClick = useCallback((tag: string) => {
    handlePromptFocus(); // Ensure default prompt is cleared on first interaction
  
    setFormData(prev => {
      const currentTags = prev.tags || [];
      const isRemoving = currentTags.includes(tag);
      let newTags: string[];
      let newPrompt = prev.aiPrompt;
  
      if (isRemoving) {
        newTags = currentTags.filter(t => t !== tag);
        const regex = new RegExp(`\\s*,?\\s*${'\\b'}${tag}\\b`, 'gi');
        newPrompt = newPrompt.replace(regex, '').replace(/,(\\s*,)+/g, ',').replace(/^,s*/, '').replace(/,s*$/, '').trim();
      } else {
        if (currentTags.length >= 3) {
          return prev;
        }
        newTags = [...currentTags, tag];
        if (newPrompt.trim() && !newPrompt.endsWith(',')) {
          newPrompt = `${newPrompt}, ${tag}`;
        } else if (newPrompt.trim()) {
          newPrompt = `${newPrompt} ${tag}`;
        } else {
          newPrompt = tag;
        }
      }
      
      return { ...prev, tags: newTags, aiPrompt: newPrompt };
    });
  }, [handlePromptFocus]);

  const handleCustomTagAdd = useCallback((tag: string) => {
    if ((formData.tags || []).length < 3) {
      handleTagClick(tag);
    }
  }, [formData.tags, handleTagClick]);

  const handleChapterCountBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    let count = parseInt(e.target.value, 10);
    if (isNaN(count)) count = minChaptersForCurrentLength;
    if (count > MAX_CHAPTER_COUNT) count = MAX_CHAPTER_COUNT;
    else if (count < minChaptersForCurrentLength) count = minChaptersForCurrentLength;
    setFormData(prev => ({ ...prev, targetChapterCount: count }));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast({ title: t('toast:invalidFileTypeTitle'), description: t('toast:invalidFileTypeDesc'), variant: "destructive" });
        e.target.value = ""; handleValueChange('coverImageFile', null); return;
      }
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        toast({ variant: 'destructive', title: t('toast:uploadFailedTitle'), description: t('toast:fileTooLargeDesc', { maxSize: 2 }) });
        e.target.value = ""; handleValueChange('coverImageFile', null); return;
      }
      handleValueChange('coverImageFile', file);
    } else {
      handleValueChange('coverImageFile', null);
    }
  };
  
  const handlePresentationStyleChange = useCallback((combinedValue: string) => {
    setFormData(prev => {
      if (combinedValue === 'book') {
        return { ...prev, presentationStyle: 'book', aspectRatio: undefined };
      }
      const parts = combinedValue.split('_');
      const style = parts[0] as 'card';
      const ratio = parts.slice(1).join(':') as '1:1' | '3:4' | '4:3';
      return { ...prev, presentationStyle: style, aspectRatio: ratio };
    });
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !user || !!validationMessage || !canGenerate) return;
    
    setIsSubmitting(true);
    setFinalizedId(null);
    clearJobTimeout();
    let jobId = '';

    try {
        if (type === 'book') {
            if (mode === 'addChapters' && editingBookId) {
                // Logic for adding chapters to an existing book
            } else {
                jobId = await createBookAndStartGeneration(user.uid, formData);
            }
        } else { // Piece
            const contentInput: GeneratePieceInput = {
                userPrompt: formData.aiPrompt,
                primaryLanguage: formData.primaryLanguage,
                availableLanguages: formData.availableLanguages.filter(Boolean),
                bilingualFormat: formData.bilingualFormat,
            };
            jobId = await createPieceAndStartGeneration(user.uid, formData as PieceFormValues, contentInput);
        }
        
        setActiveId(jobId);
        sessionStorage.setItem(`activeJobId_${user.uid}`, jobId);
        jobTimeoutRef.current = setTimeout(async () => {
          if (user && jobId && !finalizedId) {
            toast({ title: t('toast:jobTimeoutTitle'), description: t('toast:jobTimeoutDesc'), variant: 'destructive' });
            await updateLibraryItem(user.uid, jobId, { status: 'draft', contentStatus: 'error', coverStatus: 'error' });
            reset(type);
          }
        }, JOB_TIMEOUT_MS);
    } catch (error) {
        const errorMessage = (error as Error).message;
        toast({ title: t('toast:bookGenFailed'), description: errorMessage, variant: 'destructive' });
        setIsSubmitting(false);
        if (jobId) sessionStorage.removeItem(`activeJobId_${user.uid}`);
        setActiveId(null);
        clearJobTimeout();
    }
  }, [formData, type, mode, editingBookId, isSubmitting, user, validationMessage, canGenerate, t, toast, clearJobTimeout, reset, finalizedId]);

  // --- EFFECTS ---

  useEffect(() => {
    reset(type);
  }, [type, reset]);

  useEffect(() => {
    if (!coverPromptManuallyEditedRef.current) {
      setFormData(prev => ({ ...prev, coverImageAiPrompt: prev.aiPrompt }));
    }
  }, [formData.aiPrompt]);
  
  useEffect(() => {
    const option = formData.coverImageOption;
    if (option === 'none') setFormData(prev => ({ ...prev, coverImageFile: null, coverImageAiPrompt: '' }));
    else if (option === 'ai') setFormData(prev => ({ ...prev, coverImageFile: null }));
    else if (option === 'upload') setFormData(prev => ({ ...prev, coverImageAiPrompt: '' }));
  }, [formData.coverImageOption]);

  useEffect(() => {
    if (type === 'book') {
        const selectedOption = BOOK_LENGTH_OPTIONS.find(opt => opt.value === formData.bookLength);
        if (selectedOption) {
            setFormData(prev => ({
                ...prev,
                targetChapterCount: selectedOption.defaultChapters,
                generationScope: (prev.bookLength === 'standard-book' || prev.bookLength === 'long-book') ? prev.generationScope : 'full',
            }));
        }
    }
  }, [formData.bookLength, type]);
  
  useEffect(() => {
    if (user && !activeId) {
      const storedJobId = sessionStorage.getItem(`activeJobId_${user.uid}`);
      if (storedJobId && !finalizedId) {
        setActiveId(storedJobId);
      }
    }
  }, [user, finalizedId, activeId]);

  useEffect(() => {
    if (!user || !activeId) {
      clearJobTimeout();
      return;
    }
    const docRef = doc(db, `users/${user.uid}/libraryItems`, activeId);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const item = { id: docSnap.id, ...docSnap.data() } as LibraryItem;
        setJobData(item);
        const isDone = item.contentStatus !== 'processing' && (item.type === 'piece' || (item as Book).coverStatus !== 'processing');
        if (isDone) {
          if (user) sessionStorage.removeItem(`activeJobId_${user.uid}`);
          clearJobTimeout();
          setFinalizedId(item.id);
          if (isSubmitting) setIsSubmitting(false);
        }
      } else { setJobData(null); }
    }, (error) => {
      console.error(`Error listening to job ${activeId}:`, error);
      reset(type);
    });
    return () => { unsubscribe(); clearJobTimeout(); };
  }, [user, activeId, isSubmitting, clearJobTimeout, reset, type]);
  
  useEffect(() => {
    // Prefill form for "add chapters" mode
  }, [mode, editingBookId, t, toast, router, user]);

  return {
    formData,
    handleInputChange,
    handleValueChange,
    handleSubmit,
    handleFileChange,
    handleChapterCountBlur,
    handlePromptFocus,
    handlePresentationStyleChange,
    handleTagClick,
    handleCustomTagAdd,
    isPromptDefault,
    isBusy,
    isProUser,
    activeId,
    finalizedId,
    jobData,
    creditCost,
    reset,
    mode,
    isLoadingExistingBook,
    availableLanguages: LANGUAGES,
    validationMessage,
    canGenerate,
    minChaptersForCurrentLength,
    maxChapters: MAX_CHAPTER_COUNT,
    handleViewResult: () => finalizedId && router.push(`/read/${finalizedId}`),
    promptError,
  };
};
