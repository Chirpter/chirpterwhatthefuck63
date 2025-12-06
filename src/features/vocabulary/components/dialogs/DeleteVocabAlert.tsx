
"use client";

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUser } from '@/contexts/user-context';
import { useToast } from '@/hooks/useToast';
import * as vocabService from "@/services/vocabulary-service";
import type { VocabularyItem } from '@/lib/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Icon } from '@/components/ui/icons';

interface DeleteVocabAlertProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  item: VocabularyItem | null;
  onSuccess: () => void;
}

const DeleteVocabAlert: React.FC<DeleteVocabAlertProps> = ({ isOpen, onOpenChange, item, onSuccess }) => {
  const { user } = useUser();
  const { t } = useTranslation(['common', 'vocabularyPage', 'toast']);
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  // Early return nếu item null
  if (!item) {
    return null;
  }

  const handleDelete = async () => {
    if (!user || !item) {
      toast({ 
        title: t("common:error"), 
        description: "Cannot delete: Missing user or item", 
        variant: "destructive" 
      });
      return;
    }
    
    setIsDeleting(true);
    try {
      await vocabService.deleteVocabularyItem(user, item.id);
      toast({ 
        title: t("toast:deleteSuccessTitle"), 
        description: t("toast:deleteSuccessDesc", { title: item.term }) 
      });
      onSuccess();
    } catch (error) {
      console.error("Failed to delete vocab item:", error);
      toast({ 
        title: t("common:error"), 
        description: t("toast:deleteErrorDesc"), 
        variant: "destructive" 
      });
    } finally {
      setIsDeleting(false);
      onOpenChange(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="font-body">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-headline">
            {t("common:alertDialog.areYouSure")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('vocabularyPage:deleteVocabAlert.description', { term: item.term })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel 
            onClick={() => onOpenChange(false)} 
            disabled={isDeleting}
          >
            {t('common:cancel')}
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleDelete} 
            disabled={isDeleting} 
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            {isDeleting && <Icon name="Wand2" className="animate-pulse mr-2 h-4 w-4" />}
            {t('common:alertDialog.delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteVocabAlert;
