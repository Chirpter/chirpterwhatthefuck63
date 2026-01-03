
"use client";

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useUser } from '@/contexts/user-context';
import { useToast } from '@/hooks/useToast';
import type { VocabularyItem, VocabContext, User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { LANGUAGES } from '@/lib/constants';
import { useVocabForm } from '../../hooks/useVocabForm';
import { FOLDER_CONSTANTS } from '../../constants';
import { isVocabularyError } from '../../utils/error-handler';

interface AddVocabDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSuccess: (itemData: Omit<VocabularyItem, 'id' | 'userId' | 'createdAt' | 'srsState' | 'memoryStrength' | 'streak' | 'attempts' | 'lastReviewed' | 'dueDate'>) => void;
  allFolders: string[];
  initialFolder?: string;
  context?: VocabContext;
}

const AddVocabDialog: React.FC<AddVocabDialogProps> = ({ 
  isOpen, 
  onOpenChange, 
  onSuccess, 
  allFolders, 
  initialFolder,
  context = 'manual'
}) => {
  const { user } = useUser();
  const { t } = useTranslation(['vocabularyPage', 'common', 'toast']);
  const { toast } = useToast();
  
  const [newVocabItem, setNewVocabItem] = useState({ 
    term: '', 
    meaning: '', 
    example: '', 
    folder: initialFolder || FOLDER_CONSTANTS.UNORGANIZED, 
    termLanguage: user?.secondaryLanguage && user.secondaryLanguage !== 'none' ? user.secondaryLanguage : 'en',
    meaningLanguage: user?.primaryLanguage || 'vi',
  });

  const {
    isCreatingNewFolder,
    newFolderName,
    isSubmitting,
    error,
    setNewFolderName,
    getVocabValidation,
    folderValidation,
    handleFolderChange,
    handleSubmit,
    resetForm,
  } = useVocabForm({
    allFolders,
    onSubmitSuccess: () => {
      onOpenChange(false);
    },
    onSubmitError: (error: any) => {
      toast({
        title: "Error",
        description: isVocabularyError(error) ? error.message : "Failed to add vocabulary item",
        variant: "destructive"
      });
    },
  });

  const vocabValidation = useMemo(() => 
    getVocabValidation(newVocabItem)
  , [newVocabItem, getVocabValidation]);

  useEffect(() => {
    if (isOpen) {
      setNewVocabItem({ 
        term: '', 
        meaning: '', 
        example: '', 
        folder: initialFolder || FOLDER_CONSTANTS.UNORGANIZED, 
        termLanguage: user?.secondaryLanguage && user.secondaryLanguage !== 'none' ? user.secondaryLanguage : 'en',
        meaningLanguage: user?.primaryLanguage || 'vi',
      });
      resetForm();
    }
  }, [isOpen, user, initialFolder, resetForm]);

  const handleAddNewVocabItem = useCallback(async () => {
    if (!user) {
      toast({ title: t('toast:authErrorTitle'), description: t('toast:authErrorDesc'), variant: "destructive" });
      return;
    }
    
    await handleSubmit({ ...newVocabItem }, (data) => {
        onSuccess({ ...data, context });
        return Promise.resolve();
    });

  }, [user, newVocabItem, context, handleSubmit, onSuccess, toast, t]);

  const handleDialogClose = useCallback((open: boolean) => {
    if (!isSubmitting) {
      onOpenChange(open);
    }
  }, [isSubmitting, onOpenChange]);

  const handleFolderSelectChange = useCallback((value: string) => {
    handleFolderChange(value);
    if (value !== 'new') {
      setNewVocabItem(prev => ({ ...prev, folder: value }));
    }
  }, [handleFolderChange]);
  
  return (
    <Dialog open={isOpen} onOpenChange={handleDialogClose}>
      <DialogContent className="font-body sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-headline">{t('addVocabDialog.title')}</DialogTitle>
          <DialogDescription>{t('addVocabDialog.description')}</DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-4 items-center gap-4 py-4">
          <Label htmlFor="add-term" className="text-right">
            {t('addVocabDialog.termLabel')}
          </Label>
          <Input 
            id="add-term" 
            value={newVocabItem.term} 
            onChange={(e) => setNewVocabItem(prev => ({ ...prev, term: e.target.value }))} 
            className="col-span-3 font-body"
            disabled={isSubmitting}
          />
          
          <Label htmlFor="add-term-lang" className="text-right">
            {t('addVocabDialog.termLangLabel')}
          </Label>
          <Select 
            value={newVocabItem.termLanguage} 
            onValueChange={(value) => setNewVocabItem(p => ({...p, termLanguage: value}))}
            disabled={isSubmitting}
          >
            <SelectTrigger className="col-span-3">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map(l => (
                <SelectItem key={l.value} value={l.value}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Label htmlFor="add-meaning" className="text-right">
            {t('addVocabDialog.meaningLabel')}
          </Label>
          <Input 
            id="add-meaning" 
            value={newVocabItem.meaning} 
            onChange={(e) => setNewVocabItem(prev => ({ ...prev, meaning: e.target.value }))} 
            className="col-span-3 font-body"
            disabled={isSubmitting}
          />
          
          <Label htmlFor="add-meaning-lang" className="text-right">
            {t('addVocabDialog.meaningLangLabel')}
          </Label>
          <Select 
            value={newVocabItem.meaningLanguage} 
            onValueChange={(value) => setNewVocabItem(p => ({...p, meaningLanguage: value}))}
            disabled={isSubmitting}
          >
            <SelectTrigger className="col-span-3">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map(l => (
                <SelectItem key={l.value} value={l.value}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Label htmlFor="add-example" className="text-right">
            {t('addVocabDialog.exampleLabel')}
          </Label>
          <Input 
            id="add-example" 
            value={newVocabItem.example} 
            onChange={(e) => setNewVocabItem(prev => ({ ...prev, example: e.target.value }))} 
            className="col-span-3 font-body"
            disabled={isSubmitting}
          />
          
          <Label htmlFor="add-folder" className="text-right">
            {t('addVocabDialog.folderLabel')}
          </Label>
          <div className="col-span-3">
            <Select 
              value={isCreatingNewFolder ? 'new' : newVocabItem.folder} 
              onValueChange={handleFolderSelectChange}
              disabled={isSubmitting}
            >
              <SelectTrigger id="add-folder">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FOLDER_CONSTANTS.UNORGANIZED}>
                  {t('common:unorganized')}
                </SelectItem>
                {Array.isArray(allFolders) && allFolders.map(folder => (
                  <SelectItem key={folder} value={folder}>{folder}</SelectItem>
                ))}
                <SelectItem value="new">{t('addVocabDialog.createFolderOption')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isCreatingNewFolder && (
            <>
              <Label htmlFor="new-folder-name-add" className="text-right">
                {t('addVocabDialog.newFolderLabel')}
              </Label>
              <Input 
                id="new-folder-name-add" 
                value={newFolderName} 
                onChange={(e) => setNewFolderName(e.target.value)} 
                className="col-span-3"
                disabled={isSubmitting}
              />
              {folderValidation.error && (
                <div className="col-span-4 text-sm text-destructive text-right">
                  {folderValidation.error}
                </div>
              )}
            </>
          )}

          {vocabValidation.error && (
            <div className="col-span-4 text-sm text-destructive text-right">
              {vocabValidation.error}
            </div>
          )}
          
          {error && !vocabValidation.error && !folderValidation.error && (
            <div className="col-span-4 text-center text-sm text-destructive bg-destructive/10 p-2 rounded">
              {error}
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)} 
            disabled={isSubmitting}
          >
            {t('common:cancel')}
          </Button>
          <Button 
            onClick={handleAddNewVocabItem} 
            disabled={!vocabValidation.isValid || (isCreatingNewFolder && !folderValidation.isValid) || isSubmitting} 
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {isSubmitting ? t('common:adding') : t('addVocabDialog.saveButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddVocabDialog;
