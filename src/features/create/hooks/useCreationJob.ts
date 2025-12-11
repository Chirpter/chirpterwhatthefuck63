// src/features/create/hooks/useCreationJob.ts
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/useToast';
import { useUser } from '@/contexts/user-context';
import type { CreationFormValues, LibraryItem, ContentUnit, Book } from '@/lib/types';
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

function getInitialFormData(type: 'book' | 'piece'): CreationFormValues {
  const primaryLang = 'en';
  
  const baseData = {
    type,
    primaryLanguage: primaryLang,
    availableLanguages: [primaryLang],
    aiPrompt: type === 'book' ? DEFAULT_BOOK_PROMPT : DEFAULT_PIECE_PROMPT,
    tags: [],
    title: { en: '' },
    origin: primaryLang,
    unit: 'sentence' as ContentUnit,
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
    if (typeof window === 'undefined' || !user?.uid) return null;
    return sessionStorage.getItem(`activeJobId_${user.uid}`) || null;
  });
  
  const [jobData, setJobData] = useState<LibraryItem | null>(null);
  const [finalizedId, setFinalizedId] = useState<string | null>(null);
  
  const timeoutRef = useRef<NodeJS.Timeout>();
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const creditCost = useMemo(() => {
    if (formData.type === 'piece') return 1;
    
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
  }, [formData.type, formData.bookLength, formData.generationScope, formData.coverImageOption]);

  const validationMessage = useMemo(() => {
    if (!user) return ''; 
    if (promptError === 'empty') return 'formErrors.prompt.empty';
    if (promptError === 'too_long') return 'formErrors.prompt.tooLong';
    
    if (formData.type === 'book') {
      const bookLengthOption = BOOK_LENGTH_OPTIONS.find(opt => opt.value === formData.bookLength);
      const min = bookLengthOption?.minChapters || 1;
      if (formData.targetChapterCount < min || formData.targetChapterCount > 15) {
        return 'formErrors.chapterCount.outOfRange';
      }
    }
    
    if (formData.availableLanguages.length > 1 && formData.availableLanguages[0] === formData.availableLanguages[1]) {
      return 'formErrors.languages.sameLanguage';
    }

    return '';
  }, [formData, promptError, user]);

  const canGenerate = useMemo(() => !validationMessage && user && user.credits >= creditCost, [validationMessage, user, creditCost]);
  
  const bookLengthOption = BOOK_LENGTH_OPTIONS.find(opt => opt.value === formData.bookLength);
  const minChaptersForCurrentLength = bookLengthOption?.minChapters || 1;
  const maxChapters = 15;
  const isProUser = user?.plan === 'pro';
  const availableLanguages = LANGUAGES;
  
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name === 'aiPrompt') {
      setIsPromptDefault(false);
      if (value.length === 0) setPromptError('empty');
      else if (value.length > MAX_PROMPT_LENGTH) setPromptError('too_long');
      else setPromptError(null);
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: name === 'targetChapterCount' ? parseInt(value, 10) || 0 : value
    }));
  }, []);

  const handleValueChange = useCallback((key: string, value: any) => {
    setFormData(prev => {
      const newData = { ...prev };
      
      const updateOrigin = (p: string, s: string | undefined, isPhrase: boolean) => {
        let newOrigin = p;
        if (s) newOrigin += `-${s}`;
        if (isPhrase && s) newOrigin += '-ph';
        return newOrigin;
      };

      let currentIsPhrase = prev.unit === 'phrase';
      let primary = prev.primaryLanguage;
      let secondary: string | undefined = prev.availableLanguages[1];

      if (key === 'isBilingual') {
        secondary = value ? 'vi' : undefined; 
        newData.availableLanguages = value ? [primary, 'vi'] : [primary];
      } else if (key === 'primaryLanguage') {
        primary = value;
        newData.primaryLanguage = value;
        newData.availableLanguages = [value, ...((prev.availableLanguages.length > 1 && prev.availableLanguages[1]) ? [prev.availableLanguages[1]] : [])];
      } else if (key === 'secondaryLanguage') {
        secondary = value;
        newData.availableLanguages = [primary, value as string];
      } else if (key === 'unit') {
        currentIsPhrase = value === 'phrase';
        newData.unit = value;
      } else {
        (newData as any)[key] = value;
      }

      newData.origin = updateOrigin(primary, secondary, currentIsPhrase);
      if (key === 'bookLength') {
        const option = BOOK_LENGTH_OPTIONS.find(o => o.value === value);
        if (option) newData.targetChapterCount = option.defaultChapters;
      }

      return newData;
    });
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, coverImageFile: e.target.files?.[0] || null }));
  }, []);

  const handleChapterCountBlur = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      targetChapterCount: Math.max(minChaptersForCurrentLength, Math.min(prev.targetChapterCount, maxChapters))
    }));
  }, [minChaptersForCurrentLength, maxChapters]);

  const handlePromptFocus = useCallback(() => {
    if (isPromptDefault) {
      setFormData(prev => ({ ...prev, aiPrompt: '' }));
      setIsPromptDefault(false);
    }
  }, [isPromptDefault]);

  const handlePresentationStyleChange = useCallback((value: string) => {
    const isBook = value === 'book';
    const aspectRatio = isBook ? undefined : value.split('_')[1].replace('_', ':') as '1:1' | '3:4' | '4:3';
    setFormData(prev => ({ ...prev, display: isBook ? 'book' : 'card', aspectRatio }));
  }, []);
  
  const handleTagClick = useCallback((tag: string) => {
    setFormData(prev => ({ ...prev, tags: prev.tags.includes(tag) ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag] }));
  }, []);

  const handleCustomTagAdd = useCallback((tag: string) => {
    setFormData(prev => ({ ...prev, tags: [...prev.tags, tag] }));
  }, []);

  const reset = useCallback((newType: 'book' | 'piece') => {
    setFormData(getInitialFormData(newType));
    setIsPromptDefault(true);
    setPromptError(null);
    setIsBusy(false);
    setActiveId(null);
    setJobData(null);
    setFinalizedId(null);
    if(user?.uid) sessionStorage.removeItem(`activeJobId_${user.uid}`);
  }, [user?.uid]);

  useEffect(() => {
    if (type) {
      reset(type);
    }
  }, [type, reset]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || validationMessage) return;

    setIsBusy(true);
    try {
      const jobId = await createLibraryItem(formData);
      setActiveId(jobId);
      sessionStorage.setItem(`activeJobId_${user.uid}`, jobId);
      
      timeoutRef.current = setTimeout(() => {
        toast({ title: t('toast.timeout'), description: t('toast.timeoutDesc'), variant: 'destructive' });
        reset(type);
      }, 180000);
      
      toast({ title: t('toast.generationStarted'), description: t('toast.generationStartedDesc') });
    } catch (error: any) {
      toast({ title: t('toast.error'), description: error.message, variant: 'destructive' });
      setIsBusy(false);
    }
  }, [user, validationMessage, formData, type, t, toast, reset]);

  useEffect(() => {
    if (!activeId || !user) return;

    const docRef = doc(db, `users/${user.uid}/libraryItems/${activeId}`);
    unsubscribeRef.current = onSnapshot(docRef, (snapshot) => {
      if (!snapshot.exists()) return;
      
      const data = snapshot.data() as LibraryItem;
      setJobData(data);
      
      const isBook = data.type === 'book';
      const contentDone = data.contentState === 'ready' || data.contentState === 'error';
      const coverDone = isBook ? (data as Book).coverState !== 'processing' : true;
      
      if (contentDone && coverDone) {
        setFinalizedId(activeId);
        setIsBusy(false);
        setActiveId(null);
        if(user?.uid) sessionStorage.removeItem(`activeJobId_${user.uid}`);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      }
    });
    
    return () => unsubscribeRef.current?.();
  }, [activeId, user]);

  const handleViewResult = useCallback(() => {
    if (finalizedId) router.push(`/library/${type}/${finalizedId}`);
  }, [finalizedId, type, router]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      unsubscribeRef.current?.();
    };
  }, []);

  return {
    formData, isPromptDefault, promptError, isBusy, isLoadingExistingBook, activeId, jobData, finalizedId, creditCost,
    validationMessage, canGenerate, minChaptersForCurrentLength, maxChapters, availableLanguages, isProUser, mode,
    handleInputChange, handleValueChange, handleFileChange, handleChapterCountBlur, handlePromptFocus,
    handlePresentationStyleChange, handleTagClick, handleCustomTagAdd, handleSubmit, handleViewResult, reset,
  };
}

    