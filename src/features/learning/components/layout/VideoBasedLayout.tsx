// src/features/learning/components/layout/VideoBasedLayout.tsx
"use client";

import React from 'react';
import { useMobile } from '@/hooks/useMobile';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

interface VideoBasedLayoutProps {
  pageTitle: React.ReactNode;
  searchAndVideoPanel: React.ReactNode;
  activityPanel: React.ReactNode;
  contentPanel: React.ReactNode;
  rightColumnPanel: React.ReactNode;
}

/**
 * A reusable layout component for video-based learning tools (Shadowing, VocabVideos, etc.).
 * It defines a consistent 3-column structure on desktop and a stacked layout on mobile.
 */
export const VideoBasedLayout: React.FC<VideoBasedLayoutProps> = ({
  pageTitle,
  searchAndVideoPanel,
  activityPanel,
  contentPanel,
  rightColumnPanel,
}) => {
  const isMobile = useMobile();

  // Mobile Layout: A single scrollable column
  if (isMobile) {
    return (
      <div className="space-y-4 pb-6">
        <div className="px-4">{pageTitle}</div>
        <div className="px-4">{searchAndVideoPanel}</div>
        <div className="px-4">{contentPanel}</div>
        <div className="px-4">{activityPanel}</div>
        <div className="px-4">{rightColumnPanel}</div>
      </div>
    );
  }

  // Desktop Layout: 3-column grid
  return (
    <div className="space-y-6">
      {pageTitle}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="md:col-span-1 flex flex-col gap-6">
          {searchAndVideoPanel}
          {activityPanel}
        </div>

        {/* Middle Column */}
        <div className="md:col-span-1 flex flex-col h-[calc(100vh-12rem)] min-h-[500px] max-h-[800px]">
          {contentPanel}
        </div>

        {/* Right Column */}
        <div className="md:col-span-1 flex flex-col h-[calc(100vh-12rem)] min-h-[500px] max-h-[800px]">
          {rightColumnPanel}
        </div>
      </div>
    </div>
  );
};
