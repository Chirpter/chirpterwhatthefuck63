
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useUser } from '@/contexts/user-context';
import { useToast } from '@/hooks/useToast';
import { updateVocabularyItem as serviceUpdateVocabularyItem } from '@/services/client/vocabulary-service';
import type { VocabularyItem } from '@/lib/types';
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
import { getBcp47LangCode } from '@/lib/utils';
import { useVocabForm } from '../../hooks/useVocabForm';
import { FOLDER_CONSTANTS } from '../../constants';

interface EditVocabDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  item: VocabularyItem | null;
  onSuccess: (updatedItem: VocabularyItem) => void;
  allFolders: string[];
}

interface EditedItemState {
    meaning: string;
    example: string;
    folder: string;
    termLanguage: string;
    meaningLanguage: string;
}

const EditVocabDialog: React.FC<EditVocabDialogProps> = ({ 
  isOpen, 
  onOpenChange, 
  item, 
  onSuccess, 
  allFolders 
}) => {
  const { user } = useUser();
  const { t, i18n } = useTranslation(['vocabularyPage', 'common', 'toast']);
  const { toast } = useToast();

  const [editedItem, setEditedItem] = useState<EditedItemState>({
    meaning: "",
    example: "",
    folder: FOLDER_CONSTANTS.UNORGANIZED,
    termLanguage: i18n.language,
    meaningLanguage: i18n.language,
  });

  const {
    isCreatingNewFolder,
    newFolderName,
    isSubmitting,
    error,
    setNewFolderName,
    setIsCreatingNewFolder,
    getVocabValidation,
    folderValidation,
    handleSubmit,
    resetForm,
  } = useVocabForm({
    allFolders,
    onSubmitSuccess: () => {
      onOpenChange(false);
    },
    onSubmitError: (error: any) => {
      console.error("Failed to update vocab item:", error);
    },
  });

  const vocabValidation = useMemo(() => {
    if (!item) return { isValid: false, error: null };
    return getVocabValidation({
      term: item.term,
      meaning: editedItem.meaning,
      example: editedItem.example,
    });
  }, [item, editedItem, getVocabValidation]);

  useEffect(() => {
    if (item && isOpen) {
      setEditedItem({
        meaning: item.meaning,
        example: item.example || '',
        folder: item.folder || FOLDER_CONSTANTS.UNORGANIZED,
        termLanguage: getBcp47LangCode(item.termLanguage) || i18n.language,
        meaningLanguage: getBcp47LangCode(item.meaningLanguage) || i18n.language,
      });
      resetForm();
    }
  }, [item, isOpen, i18n.language, resetForm]);

  const handleEditSave = useCallback(async () => {
    if (!user || !item) {
      toast({ title: t('toast:authError'), variant: 'destructive' });
      return;
    }

    await handleSubmit(
      {
        term: item.term,
        ...editedItem,
      },
      async (dataToSubmit: any) => {
        const { term, ...updates } = dataToSubmit;
        const updatedItem = await serviceUpdateVocabularyItem(user, item.id, updates);
        toast({ title: t('toast:vocabUpdatedTitle'), description: t('toast:vocabUpdatedDesc', { term: item.term }) });
        onSuccess(updatedItem);
      }
    );
  }, [user, item, editedItem, handleSubmit, toast, t, onSuccess]);

  const handleFolderSelectChange = useCallback((value: string) => {
    if (value === 'new') {
      setIsCreatingNewFolder(true);
    } else {
      setIsCreatingNewFolder(false);
      setEditedItem(prev => ({ ...prev, folder: value }));
    }
  }, [setIsCreatingNewFolder]);

  if (!item) return null;
  
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="font-body sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-headline">{t('editVocabDialog.title')}</DialogTitle>
          <DialogDescription>{t('editVocabDialog.description')}</DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">{t('addVocabDialog.termLabel')}</Label>
            <p className="col-span-3 font-semibold text-foreground p-2">{item.term}</p>
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-term-lang" className="text-right">
              {t('addVocabDialog.termLangLabel')}
            </Label>
            <Select 
              value={editedItem.termLanguage} 
              onValueChange={(value) => setEditedItem(prev => ({ ...prev, termLanguage: value }))}
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
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-meaning" className="text-right">
              {t('addVocabDialog.meaningLabel')}
            </Label>
            <Input 
              id="edit-meaning" 
              value={editedItem.meaning} 
              onChange={(e) => setEditedItem(prev => ({ ...prev, meaning: e.target.value }))} 
              className="col-span-3 font-body"
              disabled={isSubmitting}
            />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-meaning-lang" className="text-right">
              {t('addVocabDialog.meaningLangLabel')}
            </Label>
            <Select 
              value={editedItem.meaningLanguage} 
              onValueChange={(value) => setEditedItem(prev => ({ ...prev, meaningLanguage: value }))}
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
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-example" className="text-right">
              {t('addVocabDialog.exampleLabel')}
            </Label>
            <Input 
              id="edit-example" 
              value={editedItem.example} 
              onChange={(e) => setEditedItem(prev => ({ ...prev, example: e.target.value }))} 
              className="col-span-3 font-body"
              disabled={isSubmitting}
            />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-folder" className="text-right">
              {t('addVocabDialog.folderLabel')}
            </Label>
            <div className="col-span-3">
              <Select 
                value={isCreatingNewFolder ? 'new' : editedItem.folder} 
                onValueChange={handleFolderSelectChange}
                disabled={isSubmitting}
              >
                <SelectTrigger id="edit-folder">
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
          </div>
          
          {isCreatingNewFolder && (
            <>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="new-folder-name" className="text-right">
                  {t('addVocabDialog.newFolderLabel')}
                </Label>
                <Input 
                  id="new-folder-name" 
                  value={newFolderName} 
                  onChange={(e) => setNewFolderName(e.target.value)} 
                  className="col-span-3"
                  placeholder={t('addVocabDialog.newFolderPlaceholder')}
                  disabled={isSubmitting}
                />
              </div>
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
            onClick={handleEditSave} 
            disabled={!vocabValidation.isValid || (isCreatingNewFolder && !folderValidation.isValid) || isSubmitting} 
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {isSubmitting ? t('common:saving') : t('editVocabDialog.saveButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditVocabDialog;
