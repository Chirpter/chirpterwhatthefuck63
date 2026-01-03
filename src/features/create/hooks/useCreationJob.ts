// src/features/create/hooks/useCreationJob.ts
// ✅ FIXED: Race condition, memory leak, type guards

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/useToast';
import { useUser } from '@/contexts/user-context';
import type { CreationFormValues, LibraryItem, ContentUnit, Book, Piece } from '@/lib/types';
import { createLibraryItem } from '@/services/server/creation-service';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { LANGUAGES, BOOK_LENGTH_OPTIONS, MAX_PROMPT_LENGTH } from '@/lib/constants';
import { useLibraryItems } from '@/features/library/hooks/useLibraryItems';

// ✅ MOVED OUTSIDE: Prevent closure issues
const getInitialFormData = (
    primaryLang: string, 
    secondaryLang: string | undefined, 
    getSuggestion: () => string
): Partial<CreationFormValues> => {
  const availableLanguages = [primaryLang];
  if (secondaryLang && secondaryLang !== 'none') {
    availableLanguages.push(secondaryLang);
  }

  return {
    type: 'book',
    primaryLanguage: primaryLang,
    availableLanguages: availableLanguages,
    aiPrompt: getSuggestion(),
    tags: [],
    origin: primaryLang,
    unit: 'sentence',
    presentationStyle: 'book',
    bookLength: 'short-story',
    targetChapterCount: 3,
    generationScope: 'full',
    coverImageOption: 'none',
    coverImageAiPrompt: '',
    coverImageFile: null,
    previousContentSummary: '',
  };
};

function calculateOrigin(
  primaryLanguage: string,
  availableLanguages: string[],
  unit: ContentUnit
): string {
  const [primary, secondary] = availableLanguages;
  let origin = primary;
  if (secondary) origin += `-${secondary}`;
  if (unit === 'phrase' && secondary) origin += '-ph';
  return origin;
}

// ✅ NEW: Type Guards
function isBook(item: LibraryItem): item is Book {
  return item.type === 'book' && 'coverState' in item;
}

function isPiece(item: LibraryItem): item is Piece {
  return item.type === 'piece' && 'presentationStyle' in item;
}

function isJobComplete(item: LibraryItem): boolean {
  if (isBook(item)) {
    return (
      item.contentState !== 'processing' && 
      item.coverState !== 'processing'
    );
  }
  
  if (isPiece(item)) {
    return item.contentState !== 'processing';
  }
  
  return false;
}

interface UseCreationJobParams {
  type: 'book' | 'piece';
}

export function useCreationJob({ type }: UseCreationJobParams) {
  const { t } = useTranslation(['createPage', 'common', 'toast', 'presets']);
  const { toast } = useToast();
  const { user } = useUser();
  const router = useRouter();

  // ✅ Stable suggestion getter
  const getSuggestion = useCallback(() => {
    const suggestions = [
      t('presets:bedtime_story'),
      t('presets:life_lesson'),
      t('presets:kindness_story'),
      t('presets:fantasy_story'),
      t('presets:fairy_tale'),
    ];
    return suggestions[Math.floor(Math.random() * suggestions.length)];
  }, [t]);

  const [formData, setFormData] = useState<Partial<CreationFormValues>>(() => 
    getInitialFormData(user?.primaryLanguage || 'en', user?.secondaryLanguage, getSuggestion)
  );
  
  const [isPromptDefault, setIsPromptDefault] = useState(true);
  const [promptError, setPromptError] = useState<'empty' | 'too_long' | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);
  
  const [activeId, setActiveId] = useState<string | null>(() => {
    if (typeof window === 'undefined' || !user?.uid) return null;
    return sessionStorage.getItem(`activeJobId_${user.uid}`) || null;
  });
  
  const [jobData, setJobData] = useState<LibraryItem | null>(null);
  const [finalizedId, setFinalizedId] = useState<string | null>(() => {
      if (typeof window === 'undefined' || !user?.uid) return null;
      return sessionStorage.getItem(`finalizedJobId_${user.uid}`) || null;
  });
  
  const unsubscribeRef = useRef<(() => void) | null>(null);
  
  const { items: processingItems } = useLibraryItems({ status: 'processing' });
  const processingJobsCount = processingItems.length;

  // --- DEBUGGING ---
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development' || !user?.uid) return;
    const debugState = {
      hasActiveJob: !!activeId,
      activeJobId: activeId,
      hasFinalizedJob: !!finalizedId,
      finalizedJobId: finalizedId,
    };
    sessionStorage.setItem('creation_debug_presubmit', JSON.stringify(debugState, null, 2));
  }, [activeId, finalizedId, user?.uid]);

  const creditCost = useMemo(() => {
    if (type === 'piece') return 1;
    
    let cost = 0;
    const bookLengthOption = BOOK_LENGTH_OPTIONS.find(opt => opt.value === formData.bookLength);
    if (bookLengthOption) {
      if (formData.bookLength === 'standard-book') {
        cost = formData.generationScope === 'full' ? 8 : 2;
      } else {
        cost = { 'short-story': 1, 'mini-book': 2, 'long-book': 15 }[formData.bookLength!] || 1;
      }
    }
    
    if (formData.coverImageOption === 'ai' || formData.coverImageOption === 'upload') {
      cost += 1;
    }
    return cost;
  }, [type, formData.bookLength, formData.generationScope, formData.coverImageOption]);

  const validationMessage = useMemo(() => {
    if (!user) return ''; 
    if (promptError === 'too_long') return 'formErrors.prompt.tooLong';
    
    if (!isPromptDefault && (!formData.aiPrompt || formData.aiPrompt.trim() === '')) {
        return 'formErrors.prompt.empty';
    }
    
    if (type === 'book') {
      const bookLengthOption = BOOK_LENGTH_OPTIONS.find(opt => opt.value === formData.bookLength);
      const min = bookLengthOption?.minChapters || 1;
      if (!formData.targetChapterCount || formData.targetChapterCount < min || formData.targetChapterCount > 15) {
        return 'formErrors.chapterCount.outOfRange';
      }
    }
    
    if (formData.availableLanguages && formData.availableLanguages.length > 1 && formData.availableLanguages[0] === formData.availableLanguages[1]) {
      return 'formErrors.languages.sameLanguage';
    }

    return '';
  }, [formData, promptError, user, isPromptDefault, type]);

  const canGenerate = useMemo(() => {
    if (validationMessage) return false;
    return user && user.credits >= creditCost;
  }, [validationMessage, user, creditCost]);
  
  const bookLengthOption = BOOK_LENGTH_OPTIONS.find(opt => opt.value === formData.bookLength);
  const minChaptersForCurrentLength = bookLengthOption?.minChapters || 1;
  const maxChapters = 15;
  const isProUser = user?.plan === 'pro';
  const availableLanguages = LANGUAGES;
  
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name === 'aiPrompt') {
        const trimmedValue = value.trim();
        if (isPromptDefault && value !== '') {
            setIsPromptDefault(false);
        }
        if (!isPromptDefault && trimmedValue === '') {
            setPromptError('empty');
        } else if (value.length > MAX_PROMPT_LENGTH) {
            setPromptError('too_long');
        } else {
            setPromptError(null);
        }
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: name === 'targetChapterCount' ? parseInt(value, 10) || 0 : value
    }));
  }, [isPromptDefault]);

  const handleValueChange = useCallback((key: string, value: any) => {
    if (key === 'aiPrompt' && isPromptDefault) {
      setIsPromptDefault(false);
    }

    setFormData(prev => {
        let newFormData: Partial<CreationFormValues> = { ...prev };
        
        switch(key) {
            case 'isBilingual':
                newFormData.availableLanguages = value ? [newFormData.primaryLanguage!, user?.secondaryLanguage || 'vi'] : [newFormData.primaryLanguage!];
                break;
            case 'isPhraseMode':
                 newFormData.unit = value ? 'phrase' : 'sentence';
                break;
            case 'primaryLanguage':
                newFormData.primaryLanguage = value;
                newFormData.availableLanguages = [value, ...(newFormData.availableLanguages && newFormData.availableLanguages.length > 1 ? [newFormData.availableLanguages[1]] : [])];
                break;
            case 'secondaryLanguage':
                newFormData.availableLanguages = [newFormData.primaryLanguage!, ...(value !== 'none' ? [value] : [])];
                break;
            case 'bookLength':
                const option = BOOK_LENGTH_OPTIONS.find(o => o.value === value);
                if (option) {
                    newFormData.targetChapterCount = option.defaultChapters;
                }
                newFormData.bookLength = value;
                break;
            default:
                (newFormData as any)[key] = value;
        }

        newFormData.origin = calculateOrigin(
          newFormData.primaryLanguage!,
          newFormData.availableLanguages!,
          newFormData.unit!
        );

        return newFormData;
    });
  }, [isPromptDefault, user?.secondaryLanguage]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, coverImageFile: e.target.files?.[0] || null }));
  }, []);

  const handleChapterCountBlur = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      targetChapterCount: Math.max(minChaptersForCurrentLength, Math.min(prev.targetChapterCount || 0, maxChapters))
    }));
  }, [minChaptersForCurrentLength, maxChapters]);

  const handlePromptFocus = useCallback(() => {
    if (isPromptDefault) {
      setFormData(prev => ({ ...prev, aiPrompt: '' }));
      setIsPromptDefault(false);
      setPromptError('empty');
    }
  }, [isPromptDefault]);
  
  const handlePresentationStyleChange = useCallback((style: 'doc' | 'card') => {
    setFormData(prev => ({ ...prev, presentationStyle: style }));
  }, []);

  const handleAspectRatioChange = useCallback((aspectRatio: '1:1' | '3:4' | '4:3') => {
    setFormData(prev => ({ ...prev, aspectRatio }));
  }, []);
  
  // ✅ FIX 1: Only clear storage if no active job
  const reset = useCallback((newType: 'book' | 'piece') => {
    const defaultData = getInitialFormData(user?.primaryLanguage || 'en', user?.secondaryLanguage, getSuggestion);
    let newFormData: Partial<CreationFormValues> = { ...defaultData, type: newType };

    if (newType === 'piece') {
        newFormData.presentationStyle = 'card';
        newFormData.aspectRatio = '3:4';
        delete newFormData.bookLength;
        delete newFormData.targetChapterCount;
        delete newFormData.generationScope;
        delete newFormData.coverImageOption;
        delete newFormData.coverImageAiPrompt;
        delete newFormData.coverImageFile;
    } else {
        newFormData.presentationStyle = 'book';
        delete newFormData.aspectRatio;
    }
    
    newFormData.origin = calculateOrigin(
      newFormData.primaryLanguage!,
      newFormData.availableLanguages!,
      newFormData.unit!
    );
    
    setFormData(newFormData);
    setIsPromptDefault(true);
    setPromptError(null);
    
    // ✅ CRITICAL FIX: Only reset if no active job
    if (!isBusy && !activeId) {
      setIsBusy(false);
      setJobData(null);
      setFinalizedId(null);
      
      if (typeof window !== 'undefined' && user?.uid) {
        sessionStorage.removeItem(`activeJobId_${user.uid}`);
        sessionStorage.removeItem(`finalizedJobId_${user.uid}`);
      }
    }
  }, [user?.uid, user?.primaryLanguage, user?.secondaryLanguage, getSuggestion, isBusy, activeId]);

  // ✅ FIX: Prevent reset during processing
  useEffect(() => {
    if (isBusy || activeId) {
      return;
    }
    reset(type);
  }, [type, reset]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || validationMessage || isRateLimited) {
        if (!isPromptDefault && (!formData.aiPrompt || formData.aiPrompt.trim() === '')) {
            setPromptError('empty');
        }
        return;
    }

    // ✅ Snapshot form data IMMEDIATELY
    const snapshotData = { ...formData, type } as CreationFormValues;
    
    setIsBusy(true);
    setFinalizedId(null);
    
    let submissionStatus = 'pending_to_server';
    try {
      const dataToSubmit = { ...snapshotData };

      if (process.env.NODE_ENV === 'development') {
          const snapshot = {
              submittedAt: new Date().toISOString(),
              formDataSent: {
                  ...dataToSubmit,
                  coverImageFile: dataToSubmit.coverImageFile ? { 
                    name: dataToSubmit.coverImageFile.name, 
                    size: dataToSubmit.coverImageFile.size, 
                    type: dataToSubmit.coverImageFile.type 
                  } : null
              },
              creditCost,
              processingJobsCount,
          };
          sessionStorage.setItem('creation_debug_data', JSON.stringify(snapshot, null, 2));
      }

      const jobId = await createLibraryItem(dataToSubmit);
      submissionStatus = 'success';
      setActiveId(jobId);
      if(user.uid) {
        sessionStorage.setItem(`activeJobId_${user.uid}`, jobId);
      }
      
      toast({ title: t('toast:generationStarted'), description: t('toast:generationStartedDesc') });
    } catch (error: any) {
      submissionStatus = 'failed';
      console.error('❌ [Submit] Failed:', error);
      toast({ title: t('toast:error'), description: error.message, variant: 'destructive' });
      setIsBusy(false);
    } finally {
        if (process.env.NODE_ENV === 'development') {
            const dataRaw = sessionStorage.getItem('creation_debug_data');
            if(dataRaw) {
                const data = JSON.parse(dataRaw);
                data.submissionStatus = submissionStatus;
                sessionStorage.setItem('creation_debug_data', JSON.stringify(data, null, 2));
            }
        }
    }
  }, [user, validationMessage, formData, t, toast, processingJobsCount, isRateLimited, isPromptDefault, type, creditCost]);

  // ✅ FIX 2: Proper cleanup of Firestore listener
  useEffect(() => {
    if (!activeId || !user) {
      // ✅ Cleanup any existing listener when no active job
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      return;
    }

    const docRef = doc(db, `users/${user.uid}/libraryItems`, activeId);
    
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          console.warn(`[Job ${activeId}] Document not found`);
          return;
        }
        
        const data = snapshot.data();
        
        // ✅ FIX 3: Validate data structure
        if (!data || !data.type) {
          console.error('[Job] Invalid data structure:', data);
          return;
        }
        
        const item = data as LibraryItem;
        setJobData(item);
        
        // ✅ Use type guard
        if (isJobComplete(item)) {
          setFinalizedId(activeId);
          if (user?.uid) sessionStorage.setItem(`finalizedJobId_${user.uid}`, activeId);
          setIsBusy(false);
          setActiveId(null);
          if (user?.uid) sessionStorage.removeItem(`activeJobId_${user.uid}`);
        }
      },
      (error) => {
        // ✅ Handle listener errors
        console.error('[Firestore Listener Error]:', error);
        setIsBusy(false);
        toast({
          title: t('toast:error'),
          description: 'Lost connection to server. Please refresh.',
          variant: 'destructive'
        });
      }
    );
    
    unsubscribeRef.current = unsubscribe;
    
    // ✅ Cleanup on unmount or activeId change
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [activeId, user, toast, t]);

  // ✅ Global cleanup on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, []);

  const handleViewResult = useCallback(() => {
    if (finalizedId) router.push(`/read/${finalizedId}`);
  }, [finalizedId, router]);

  return {
    formData: formData as CreationFormValues,
    isPromptDefault, 
    promptError, 
    isBusy, 
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
    handleInputChange, 
    handleValueChange, 
    handleFileChange, 
    handleChapterCountBlur, 
    handlePromptFocus,
    handlePresentationStyleChange, 
    handleAspectRatioChange, 
    handleSubmit, 
    handleViewResult, 
    reset,
    isRateLimited, 
  };
}
