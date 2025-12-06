

"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Icon } from '@/components/ui/icons';
import { useTranslation } from 'react-i18next';

interface ProFeatureWrapperProps {
  children: React.ReactNode;
  isProUser: boolean;
}

/**
 * A wrapper component that checks if the user has a "pro" plan.
 * - If they are a Pro user, it renders the children as is.
 * - If they are not a Pro user, it renders the children in a disabled state
 *   and shows a "Pro" badge with a tooltip.
 */
export const ProFeatureWrapper: React.FC<ProFeatureWrapperProps> = ({ children, isProUser }) => {
  const { t } = useTranslation(['common']);

  if (isProUser) {
    return <>{children}</>;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative w-full cursor-not-allowed">
            {/* The actual content, but disabled */}
            <div className="pointer-events-none opacity-60">
              {children}
            </div>
            {/* The "PRO" badge overlay */}
            <div className="absolute top-2 right-2">
              <div className="flex items-center gap-1 rounded-full border border-purple-500/50 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 px-2 py-0.5 text-xs font-bold text-white shadow-lg">
                <Icon name="Trophy" className="h-3 w-3" />
                <span>PRO</span>
              </div>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t('proFeatureTooltip')}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
