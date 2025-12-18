// src/features/create/hooks/useCreationJob.ts
// ✅ FIX: Prevent reset race condition + snapshot origin at submit

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
const getInitialFormData = (primaryLang: string, getSuggestion: () => string): Partial<CreationFormValues> => {
  return {
    type: 'book',
    primaryLanguage: primaryLang,
    availableLanguages: [primaryLang],
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

const calculateOrigin = (
  primaryLanguage: string,
  availableLanguages: string[],
  unit: ContentUnit
): string => {
  const [primary, secondary] = availableLanguages;
  let origin = primary;
  if (secondary) origin += `-${secondary}`;
  if (unit === 'phrase' && secondary) origin += '-ph';
  return origin;
};

interface UseCreationJobParams {
  type: 'book' | 'piece';
}

export function useCreationJob({ type }: UseCreationJobParams) {
  const { t } = useTranslation(['createPage', 'common', 'toast', 'presets']);
  const { toast } = useToast();
  const { user } = useUser();
  const router = useRouter();

  // ✅ NEW: Create stable suggestion getter
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
    getInitialFormData('en', getSuggestion)
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
  
  // This hook is now for UI feedback only, the critical check is on the server
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
                newFormData.availableLanguages = value ? [newFormData.primaryLanguage!, 'vi'] : [newFormData.primaryLanguage!];
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
  }, [isPromptDefault]);

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
  
  // ✅ FIX: Stabilize reset dependencies
  const reset = useCallback((newType: 'book' | 'piece') => {
    
    const defaultData = getInitialFormData('en', getSuggestion);
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
    setIsBusy(false);
    setActiveId(null);
    setJobData(null);
    setFinalizedId(null);
    
    // Clear storage INSIDE reset, not in submit
    if (typeof window !== 'undefined' && user?.uid) {
        sessionStorage.removeItem(`activeJobId_${user.uid}`);
        sessionStorage.removeItem(`finalizedJobId_${user.uid}`);
    }
  }, [user?.uid, getSuggestion]); // Only stable dependencies

  // ✅ FIX: Prevent reset during processing
  useEffect(() => {
    if (isBusy || activeId) {
      return;
    }
    reset(type);
  }, [type, reset, isBusy, activeId]); // Add guards

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || validationMessage || isRateLimited) {
        if (!isPromptDefault && (!formData.aiPrompt || formData.aiPrompt.trim() === '')) {
            setPromptError('empty');
        }
        return;
    }

    // REMOVED: This check is now on the server
    // if (processingJobsCount >= 3) { ... }

    // ✅ FIX: Snapshot form data IMMEDIATELY
    const snapshotData = { ...formData, type } as CreationFormValues;
    
    setIsBusy(true);
    setFinalizedId(null);
    
    let submissionStatus = 'pending_to_server';
    try {
      // ✅ Use snapshot, not current formData
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

  useEffect(() => {
    if (!activeId || !user) return;

    const docRef = doc(db, `users/${user.uid}/libraryItems`, activeId);
    unsubscribeRef.current = onSnapshot(docRef, (snapshot) => {
      if (!snapshot.exists()) return;
      
      const data = snapshot.data() as LibraryItem;
      setJobData(data);
      
      let isComplete = false;
      if (data.type === 'book') {
          const bookData = data as Book;
          isComplete = bookData.contentState !== 'processing' && bookData.coverState !== 'processing';
      } else if (data.type === 'piece') {
          const pieceData = data as Piece;
          isComplete = pieceData.contentState !== 'processing';
      }

      if (isComplete) {
        setFinalizedId(activeId);
        if(user?.uid) sessionStorage.setItem(`finalizedJobId_${user.uid}`, activeId);
        setIsBusy(false);
        setActiveId(null);
        if(user?.uid) sessionStorage.removeItem(`activeJobId_${user.uid}`);
      }
    });
    
    return () => unsubscribeRef.current?.();
  }, [activeId, user]);

  const handleViewResult = useCallback(() => {
    if (finalizedId) router.push(`/read/${finalizedId}`);
  }, [finalizedId, router]);

  useEffect(() => {
    return () => {
      unsubscribeRef.current?.();
    };
  }, []);

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

    