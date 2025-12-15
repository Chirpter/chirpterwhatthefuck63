// src/features/create/hooks/useCreationJob.ts
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/useToast';
import { useUser } from '@/contexts/user-context';
import type { CreationFormValues, LibraryItem, ContentUnit, Book, Piece } from '@/lib/types';
import { createLibraryItem } from '@/services/server/creation.service';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { LANGUAGES, BOOK_LENGTH_OPTIONS, MAX_PROMPT_LENGTH } from '@/lib/constants';
import { useLibraryItems } from '@/features/library/hooks/useLibraryItems';

const getInitialFormData = (t: (key: string) => string): CreationFormValues => {
  const primaryLang = 'en';

  const suggestions = [
    t('presets:bedtime_story'),
    t('presets:life_lesson'),
    t('presets:kindness_story'),
    t('presets:fantasy_story'),
    t('presets:fairy_tale'),
  ];
  const defaultPrompt = suggestions[Math.floor(Math.random() * suggestions.length)];
  
  return {
    type: 'book', // Default type
    primaryLanguage: primaryLang,
    availableLanguages: [primaryLang],
    aiPrompt: defaultPrompt,
    tags: [],
    presentationStyle: 'book',
    origin: primaryLang,
    unit: 'sentence' as ContentUnit,
    coverImageOption: 'none' as const,
    coverImageAiPrompt: '',
    coverImageFile: null,
    previousContentSummary: '',
    targetChapterCount: 3,
    bookLength: 'short-story' as const,
    generationScope: 'full' as const,
    aspectRatio: '3:4' as const,
  };
};

interface UseCreationJobParams {
  type: 'book' | 'piece';
}

export function useCreationJob({ type }: UseCreationJobParams) {
  const { t } = useTranslation(['createPage', 'common', 'toast', 'presets']);
  const { toast } = useToast();
  const { user } = useUser();
  const router = useRouter();

  const [formData, setFormData] = useState<CreationFormValues>(() => getInitialFormData(t));
  const [isPromptDefault, setIsPromptDefault] = useState(true);
  const [promptError, setPromptError] = useState<'empty' | 'too_long' | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);
  
  const [activeId, setActiveId] = useState<string | null>(() => {
    if (typeof window === 'undefined' || !user?.uid) return null;
    return sessionStorage.getItem(`activeJobId_${user.uid}`) || null;
  });
  
  const [jobData, setJobData] = useState<LibraryItem | null>(null);
  const [finalizedId, setFinalizedId] = useState<string | null>(null);
  
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const { items: processingItems } = useLibraryItems({ status: 'processing' });
  const processingJobsCount = processingItems.length;

  const creditCost = useMemo(() => {
    if (type === 'piece') return 1;
    
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
  }, [type, formData.bookLength, formData.generationScope, formData.coverImageOption]);

  const validationMessage = useMemo(() => {
    if (!user) return ''; 
    if (promptError === 'too_long') return 'formErrors.prompt.tooLong';
    
    if (!isPromptDefault && formData.aiPrompt.trim() === '') {
        return 'formErrors.prompt.empty';
    }
    
    if (type === 'book') {
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
        let newFormData = { ...prev };
        
        switch(key) {
            case 'isBilingual':
                newFormData.availableLanguages = value ? [newFormData.primaryLanguage, 'vi'] : [newFormData.primaryLanguage];
                break;
            case 'isPhraseMode':
                 newFormData.unit = value ? 'phrase' : 'sentence';
                break;
            case 'primaryLanguage':
                newFormData.primaryLanguage = value;
                newFormData.availableLanguages = [value, ...(newFormData.availableLanguages.length > 1 ? [newFormData.availableLanguages[1]] : [])];
                break;
            case 'secondaryLanguage':
                newFormData.availableLanguages = [newFormData.primaryLanguage, ...(value !== 'none' ? [value] : [])];
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

        const [primary, secondary] = newFormData.availableLanguages;
        let newOrigin = primary;
        if (secondary) newOrigin += `-${secondary}`;
        if (newFormData.unit === 'phrase' && secondary) newOrigin += '-ph';
        newFormData.origin = newOrigin;

        return newFormData;
    });
  }, [isPromptDefault]);

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
      setPromptError('empty'); // Set error immediately on focus if default
    }
  }, [isPromptDefault]);
  
  const handlePresentationStyleChange = useCallback((style: 'doc' | 'card') => {
    setFormData(prev => ({ ...prev, presentationStyle: style }));
  }, []);

  const handleAspectRatioChange = useCallback((aspectRatio: '1:1' | '3:4' | '4:3') => {
    setFormData(prev => ({ ...prev, aspectRatio }));
  }, []);
  

  const reset = useCallback((newType: 'book' | 'piece') => {
    setFormData(getInitialFormData(t));
    setIsPromptDefault(true);
    setPromptError(null);
    setIsBusy(false);
    setActiveId(null);
    setJobData(null);
    setFinalizedId(null);
    if(user?.uid) sessionStorage.removeItem(`activeJobId_${user.uid}`);
  }, [user?.uid, t]);

  useEffect(() => {
    reset(type);
  }, [type, reset]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || validationMessage || isRateLimited) {
        if (!isPromptDefault && formData.aiPrompt.trim() === '') {
            setPromptError('empty');
        }
        return;
    }

    if (processingJobsCount >= 3) {
        toast({
            title: t('toast:tooManyJobsTitle'),
            description: t('toast:tooManyJobsDesc'),
            variant: 'destructive',
        });
        setIsRateLimited(true);
        setTimeout(() => setIsRateLimited(false), 10000);
        return;
    }

    setIsBusy(true);
    try {
      const fullFormData: CreationFormValues = {
        ...formData,
        type: type, // Ensure type is correctly set
        presentationStyle: type === 'book' ? 'book' : formData.presentationStyle || 'card',
      };
      const jobId = await createLibraryItem(type, fullFormData);
      setActiveId(jobId);
      sessionStorage.setItem(`activeJobId_${user.uid}`, jobId);
      
      toast({ title: t('toast:generationStarted'), description: t('toast:generationStartedDesc') });
    } catch (error: any) {
      toast({ title: t('toast:error'), description: error.message, variant: 'destructive' });
      setIsBusy(false);
    }
  }, [user, validationMessage, formData, t, toast, processingJobsCount, isRateLimited, isPromptDefault, type]);

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
    formData, isPromptDefault, promptError, isBusy, activeId, jobData, finalizedId, creditCost,
    validationMessage, canGenerate, minChaptersForCurrentLength, maxChapters, availableLanguages, isProUser,
    handleInputChange, handleValueChange, handleFileChange, handleChapterCountBlur, handlePromptFocus,
    handlePresentationStyleChange, handleAspectRatioChange, handleSubmit, handleViewResult, reset,
    isRateLimited, 
  };
}
