// src/features/user/components/LevelUpDialog.tsx

"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { motion } from 'framer-motion';
import type { LevelUpInfo } from '@/contexts/user-context';

interface LevelUpDialogProps {
  isOpen: boolean;
  onClose: () => void;
  levelUpInfo: LevelUpInfo | null;
}

const LevelUpDialog: React.FC<LevelUpDialogProps> = ({ isOpen, onClose, levelUpInfo }) => {
  if (!levelUpInfo) return null;
  
  const { newLevel, oldLevel } = levelUpInfo;
  const isNewUser = oldLevel === 0 && newLevel === 1;

  let title: string;
  let description: string;
  let iconName: 'Sparkles' | 'Calendar' | 'Trophy' = 'Sparkles';

  if (isNewUser) {
    title = `Welcome! You've reached Level 1!`;
    description = `As a welcome gift, you've received 10 credits to start your journey.`;
    iconName = 'Trophy';
  } else {
    title = `Level Up! You've reached Level ${newLevel}!`;
    description = `Your login streak is paying off. You've earned 10 credits!`;
    iconName = 'Sparkles';
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="font-body sm:max-w-md p-0 overflow-hidden">
        <div className="relative p-6 pt-12 flex flex-col items-center text-center bg-gradient-to-br from-background via-background to-accent/10">
            <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{
                    type: "spring",
                    stiffness: 260,
                    damping: 20,
                    delay: 0.2
                }}
            >
                <Icon name={iconName} className="h-20 w-20 text-accent mb-4" />
            </motion.div>
            <DialogHeader>
                <DialogTitle className="font-headline text-3xl">
                    {title}
                </DialogTitle>
                <DialogDescription className="text-lg">
                    {description}
                </DialogDescription>
            </DialogHeader>
            <div className="mt-4 text-muted-foreground">
                <p>Your current level is <span className="font-bold text-primary">{newLevel}</span>!</p>
                <p className="text-sm mt-1">Keep it up to unlock more rewards.</p>
            </div>
        </div>
        <DialogFooter className="p-4 bg-muted/50 border-t">
          <Button onClick={onClose} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LevelUpDialog;
