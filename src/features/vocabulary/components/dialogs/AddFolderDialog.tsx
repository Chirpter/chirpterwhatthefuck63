"use client";

import React, { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/useToast';
import { validateFolderName } from '../../utils/validation.utils';

interface AddFolderDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSuccess: (newFolderName: string) => void; 
  allFolders: string[];
}

const AddFolderDialog: React.FC<AddFolderDialogProps> = ({ 
  isOpen, 
  onOpenChange, 
  onSuccess, 
  allFolders 
}) => {
  const { t } = useTranslation(['vocabularyPage']);
  const { toast } = useToast();
  const [folderName, setFolderName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Use shared validation utility
  const validation = useMemo(() => 
    folderName ? validateFolderName(folderName, allFolders) : { isValid: false, error: null }
  , [folderName, allFolders]);

  const handleSubmit = useCallback(async () => {
    if (!validation.isValid) return;

    setIsSubmitting(true);
    try {
      onSuccess(folderName.trim());
      setFolderName('');
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Failed to create folder", 
        variant: "destructive" 
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [folderName, validation.isValid, onSuccess, toast]);

  const handleClose = useCallback(() => {
    if (!isSubmitting) {
      setFolderName('');
      onOpenChange(false);
    }
  }, [isSubmitting, onOpenChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && validation.isValid && !isSubmitting) {
      e.preventDefault();
      handleSubmit();
    }
  }, [validation.isValid, isSubmitting, handleSubmit]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('addFolderDialog.title')}</DialogTitle>
          <DialogDescription>{t('addFolderDialog.description')}</DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="folder-name">{t('addFolderDialog.folderNameLabel')}</Label>
            <Input
              id="folder-name"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSubmitting}
              maxLength={50}
              autoFocus
              placeholder="Enter folder name..."
            />
            {validation.error && (
              <p className="text-sm text-destructive">{validation.error}</p>
            )}
          </div>
        </div>
        
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={handleClose} 
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!validation.isValid || isSubmitting}
          >
            {isSubmitting ? 'Creating...' : 'Create Folder'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddFolderDialog;