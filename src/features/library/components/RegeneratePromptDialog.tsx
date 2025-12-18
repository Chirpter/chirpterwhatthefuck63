

"use client";

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Icon } from '@/components/ui/icons';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import type { LibraryItem } from '@/lib/types';
import { useUser } from '@/contexts/user-context';
import { regenerateBookContent } from '@/services/server/book-creation-service';
import { useToast } from '@/hooks/useToast';
import { MAX_PROMPT_LENGTH } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface RegeneratePromptDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  item: LibraryItem | null; // Allow item to be null
}

const RegeneratePromptDialog: React.FC<RegeneratePromptDialogProps> = ({
  isOpen,
  onOpenChange,
  item,
}) => {
  const { t } = useTranslation(['bookCard', 'common', 'toast']);
  const { user } = useUser();
  const { toast } = useToast();
  const [newPrompt, setNewPrompt] = useState(item?.prompt || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && item) {
      setNewPrompt(item.prompt || '');
    }
  }, [isOpen, item]);

  if (!item) {
    return null; // Don't render if there's no item
  }

  const handleRegenerate = async () => {
    if (!user || !newPrompt.trim()) {
        toast({ title: t('toast:promptCannotBeEmpty'), variant: 'destructive'});
        return;
    }
    
    setIsSubmitting(true);
    try {
        // Currently only supports book regeneration. This can be expanded.
        if (item.type === 'book') {
            await regenerateBookContent(user.uid, item.id, newPrompt.trim());
            toast({ title: t('toast:regenContentTitle'), description: t('toast:regenDesc')});
            onOpenChange(false);
        } else {
            throw new Error("Content regeneration is not yet supported for this item type.");
        }
    } catch (error) {
        toast({ title: t('toast:regenErrorTitle'), description: (error as Error).message, variant: 'destructive' });
    } finally {
        setIsSubmitting(false);
    }
  };

  const title = (item.title as any)[Object.keys(item.title)[0]] || 'this item';

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="font-body sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="font-headline">{t('fixAndRetryContent')}</DialogTitle>
          <DialogDescription>
            {t('fixAndRetryDescription', { title })}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="regenerate-prompt">{t('originalPromptLabel')}</Label>
            <Textarea
              id="regenerate-prompt"
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
              className={cn("font-body", newPrompt.length > MAX_PROMPT_LENGTH && "border-destructive")}
              rows={6}
              maxLength={MAX_PROMPT_LENGTH}
            />
            <div className="text-right text-xs text-muted-foreground">
                {newPrompt.length} / {MAX_PROMPT_LENGTH}
            </div>
          </div>
           {item.type === 'book' && item.contentError && (
             <div className="text-xs text-destructive bg-destructive/10 p-2 rounded-md">
                <strong>{t('lastErrorLabel')}:</strong> {item.contentError}
            </div>
           )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            {t('common:cancel')}
          </Button>
          <Button onClick={handleRegenerate} disabled={isSubmitting || !newPrompt.trim() || newPrompt.length > MAX_PROMPT_LENGTH}>
            {isSubmitting && <Icon name="Wand2" className="mr-2 h-4 w-4 animate-pulse" />}
            {t('regenerateButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RegeneratePromptDialog;
