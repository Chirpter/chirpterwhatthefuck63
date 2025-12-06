
"use client";

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Icon } from '@/components/ui/icons';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { MAX_PROMPT_LENGTH } from '@/lib/constants';

interface RegenerateCoverPromptDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onConfirm: (prompt: string) => void;
  isSubmitting: boolean;
}

const RegenerateCoverPromptDialog: React.FC<RegenerateCoverPromptDialogProps> = ({
  isOpen,
  onOpenChange,
  onConfirm,
  isSubmitting,
}) => {
  const { t } = useTranslation(['bookCard', 'common']);
  const [newPrompt, setNewPrompt] = useState('');

  const handleConfirm = () => {
    onConfirm(newPrompt);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="font-body sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-headline">{t('generateNewCover')}</DialogTitle>
        </DialogHeader>
        <div className="py-2">
            <Textarea
                id="new-cover-prompt"
                value={newPrompt}
                onChange={(e) => setNewPrompt(e.target.value)}
                placeholder={t('coverPromptPlaceholder')}
                rows={3}
                maxLength={MAX_PROMPT_LENGTH}
                className="text-base"
                autoFocus
            />
        </div>
        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            {t('common:cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={isSubmitting || !newPrompt.trim() || newPrompt.length > MAX_PROMPT_LENGTH}>
            {isSubmitting && <Icon name="Wand2" className="mr-2 h-4 w-4 animate-pulse" />}
            {t('common:generate')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RegenerateCoverPromptDialog;
