// src/features/create/hooks/useCreationJob.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/useToast';
import { useUser } from '@/contexts/user-context';
import type { CreationFormValues, LibraryItem } from '@/lib/types';
import { createLibraryItem } from '@/services/creation-service';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { LANGUAGES, BOOK_LENGTH_OPTIONS, MAX_PROMPT_LENGTH } from '@/lib/constants';

const DEFAULT_BOOK_PROMPT = "Write a captivating story about...";
const DEFAULT_PIECE_PROMPT = "Create an inspiring piece about...";

interface UseCreationJobParams {
  type: 'book' | 'piece';
  editingBookId: string | null;
  mode: string | null;
}

export function useCreationJob({ type, editingBookId, mode }: UseCreationJobParams) {
  const { t } = useTranslation(['createPage']);
  const { toast } = useToast();
  const { user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [formData, setFormData] = useState<CreationFormValues>(() => getInitialFormData(type));
  const [isPromptDefault, setIsPromptDefault] = useState(true);
  const [promptError, setPromptError] = useState<'empty' | 'too_long' | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isLoadingExistingBook, setIsLoadingExistingBook] = useState(false);
  
  const [activeId, setActiveId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem(`activeJobId_${user?.uid}`) || null;
  });
  
  const [jobData, setJobData] = useState<LibraryItem | null>(null);
  const [finalizedId, setFinalizedId] = useState<string | null>(null);
  
  const timeoutRef = useRef<NodeJS.Timeout>();
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Calculate credit cost
  const creditCost = calculateCreditCost(formData);

  // Validation
  const validationMessage = getValidationMessage(formData, promptError, user);
  const canGenerate = !validationMessage && user && user.credits >= creditCost;

  // Min/max chapters
  const bookLengthOption = BOOK_LENGTH_OPTIONS.find(opt => opt.value === formData.bookLength);
  const minChaptersForCurrentLength = bookLengthOption?.minChapters || 1;
  const maxChapters = 15;

  const availableLanguages = LANGUAGES;
  const isProUser = user?.plan === 'pro';

  // Input handlers
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name === 'aiPrompt') {
      setIsPromptDefault(false);
      
      if (value.length === 0) {
        setPromptError('empty');
      } else if (value.length > MAX_PROMPT_LENGTH) {
        setPromptError('too_long');
      } else {
        setPromptError(null);
      }
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: name === 'targetChapterCount' ? parseInt(value) || 0 : value
    }));
  }, []);

  const handleValueChange = useCallback((key: string, value: any) => {
    setFormData(prev => {
      const newData = { ...prev };
      
      if (key === 'isBilingual') {
        if (value) {
          newData.availableLanguages = [prev.primaryLanguage, 'vi'];
          newData.origin = `${prev.primaryLanguage}-vi`;
        } else {
          newData.availableLanguages = [prev.primaryLanguage];
          newData.origin = prev.primaryLanguage;
        }
      } else if (key === 'primaryLanguage') {
        newData.primaryLanguage = value;
        newData.availableLanguages = [value, ...(prev.availableLanguages.slice(1))];
        newData.origin = prev.availableLanguages.length > 1 
          ? `${value}-${prev.availableLanguages[1]}${prev.origin.endsWith('-ph') ? '-ph' : ''}`
          : value;
      } else if (key === 'secondaryLanguage') {
        newData.availableLanguages = [prev.primaryLanguage, value];
        newData.origin = `${prev.primaryLanguage}-${value}${prev.origin.endsWith('-ph') ? '-ph' : ''}`;
      } else if (key === 'origin') {
        // Toggle phrase mode
        if (prev.origin.endsWith('-ph')) {
          newData.origin = prev.origin.slice(0, -3);
        } else {
          newData.origin = prev.origin + '-ph';
        }
      } else {
        (newData as any)[key] = value;
      }
      
      return newData;
    });
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setFormData(prev => ({ ...prev, coverImageFile: file }));
  }, []);

  const handleChapterCountBlur = useCallback(() => {
    const count = formData.targetChapterCount;
    if (count < minChaptersForCurrentLength) {
      setFormData(prev => ({ ...prev, targetChapterCount: minChaptersForCurrentLength }));
    } else if (count > maxChapters) {
      setFormData(prev => ({ ...prev, targetChapterCount: maxChapters }));
    }
  }, [formData.targetChapterCount, minChaptersForCurrentLength, maxChapters]);

  const handlePromptFocus = useCallback(() => {
    if (isPromptDefault) {
      setFormData(prev => ({ ...prev, aiPrompt: '' }));
      setIsPromptDefault(false);
    }
  }, [isPromptDefault]);

  const handlePresentationStyleChange = useCallback((value: string) => {
    if (value === 'book') {
      setFormData(prev => ({ ...prev, display: 'book', aspectRatio: undefined }));
    } else {
      const [, ratio] = value.split('_');
      const aspectRatio = ratio.replace('_', ':') as '1:1' | '3:4' | '4:3';
      setFormData(prev => ({ ...prev, display: 'card', aspectRatio }));
    }
  }, []);

  const handleTagClick = useCallback((tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tag) 
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag]
    }));
  }, []);

  const handleCustomTagAdd = useCallback((tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: [...prev.tags, tag]
    }));
  }, []);

  // Submit handler
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || validationMessage) {
      return;
    }
    
    setIsBusy(true);
    
    try {
      const jobId = await createLibraryItem(formData);
      
      setActiveId(jobId);
      sessionStorage.setItem(`activeJobId_${user.uid}`, jobId);
      
      // Set timeout
      timeoutRef.current = setTimeout(() => {
        toast({
          title: t('toast.timeout'),
          description: t('toast.timeoutDesc'),
          variant: 'destructive'
        });
        reset(type);
      }, 180000);
      
      toast({
        title: t('toast.generationStarted'),
        description: t('toast.generationStartedDesc'),
        variant: 'default'
      });
      
    } catch (error: any) {
      console.error('Creation error:', error);
      toast({
        title: t('toast.error'),
        description: error.message,
        variant: 'destructive'
      });
      setIsBusy(false);
    }
  }, [user, validationMessage, formData, type, t, toast]);

  // Realtime listener
  useEffect(() => {
    if (!activeId || !user) return;
    
    const docRef = doc(db, `users/${user.uid}/libraryItems/${activeId}`);
    
    unsubscribeRef.current = onSnapshot(docRef, (snapshot) => {
      if (!snapshot.exists()) return;
      
      const data = snapshot.data() as LibraryItem;
      setJobData(data);
      
      // Check if finalized
      const isBook = data.type === 'book';
      const contentDone = data.contentState === 'ready' || data.contentState === 'error';
      const coverDone = isBook 
        ? (data.coverState === 'ready' || data.coverState === 'error' || data.coverState === 'ignored')
        : true;
      
      if (contentDone && coverDone) {
        setFinalizedId(activeId);
        setIsBusy(false);
        setActiveId(null);
        sessionStorage.removeItem(`activeJobId_${user.uid}`);
        
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      }
    });
    
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [activeId, user]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  const handleViewResult = useCallback(() => {
    if (finalizedId) {
      router.push(`/library/${type === 'book' ? 'book' : 'other'}/${finalizedId}`);
    }
  }, [finalizedId, type, router]);

  const reset = useCallback((newType: 'book' | 'piece') => {
    setFormData(getInitialFormData(newType));
    setIsPromptDefault(true);
    setPromptError(null);
    setIsBusy(false);
    setActiveId(null);
    setJobData(null);
    setFinalizedId(null);
    sessionStorage.removeItem(`activeJobId_${user?.uid}`);
  }, [user]);

  return {
    formData,
    isPromptDefault,
    promptError,
    isBusy,
    isLoadingExistingBook,
    activeId,
    jobData,
    finalizedId,
    creditCost,
    validationMessage,
    canGenerate,
    minChaptersForCurrentLength,
    maxChapters,
    availableLanguages,
    isProUser,
    mode,
    handleInputChange,
    handleValueChange,
    handleFileChange,
    handleChapterCountBlur,
    handlePromptFocus,
    handlePresentationStyleChange,
    handleTagClick,
    handleCustomTagAdd,
    handleSubmit,
    handleViewResult,
    reset,
  };
}

function getInitialFormData(type: 'book' | 'piece'): CreationFormValues {
  const baseData = {
    type,
    primaryLanguage: 'en',
    availableLanguages: ['en'],
    aiPrompt: type === 'book' ? DEFAULT_BOOK_PROMPT : DEFAULT_PIECE_PROMPT,
    tags: [],
    title: { en: '' },
    origin: 'en',
    coverImageOption: 'none' as const,
    coverImageAiPrompt: '',
    coverImageFile: null,
    previousContentSummary: '',
    targetChapterCount: 3,
    bookLength: 'short-story' as const,
    generationScope: 'full' as const,
  };
  
  if (type === 'piece') {
    return {
      ...baseData,
      display: 'card' as const,
      aspectRatio: '3:4' as const,
    };
  }
  
  return {
    ...baseData,
    display: 'book' as const,
  };
}

function calculateCreditCost(formData: CreationFormValues): number {
  if (formData.type === 'piece') {
    return 1;
  }
  
  let cost = 0;
  const bookLengthOption = BOOK_LENGTH_OPTIONS.find(opt => opt.value === formData.bookLength);
  
  if (bookLengthOption) {
    if (formData.bookLength === 'standard-book') {
      cost = formData.generationScope === 'full' ? 8 : 2;
    } else {
      cost = { 'short-story': 1, 'mini-book': 2, 'long-book': 15 }[formData.bookLength] || 1;
    }
  }
  
  if (formData.coverImageOption === 'ai' || formData.coverImageOption === 'upload') {
    cost += 1;
  }
  
  return cost;
}

function getValidationMessage(
  formData: CreationFormValues,
  promptError: 'empty' | 'too_long' | null,
  user: any
): string {
  if (!user) return '';
  
  if (promptError === 'empty') {
    return 'formErrors.prompt.empty';
  }
  
  if (promptError === 'too_long') {
    return 'formErrors.prompt.tooLong';
  }
  
  if (formData.type === 'book') {
    const bookLengthOption = BOOK_LENGTH_OPTIONS.find(opt => opt.value === formData.bookLength);
    const min = bookLengthOption?.minChapters || 1;
    
    if (formData.targetChapterCount < min || formData.targetChapterCount > 15) {
      return 'formErrors.chapterCount.outOfRange';
    }
  }
  
  if (formData.availableLanguages.length > 1) {
    if (formData.availableLanguages[0] === formData.availableLanguages[1]) {
      return 'formErrors.languages.sameLanguage';
    }
  }
  
  return '';
}