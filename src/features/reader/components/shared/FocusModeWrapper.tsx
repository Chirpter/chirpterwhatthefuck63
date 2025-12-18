// src/features/reader/components/shared/FocusModeWrapper.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';

interface FocusModeWrapperProps {
  isActive: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  isMobile: boolean;
  toolbar?: React.ReactNode;
}

export function FocusModeWrapper({
  isActive,
  onToggle,
  children,
  isMobile,
  toolbar
}: FocusModeWrapperProps) {
  const [showToolbar, setShowToolbar] = useState(false);
  const tapCount = useRef(0);
  const tapTimer = useRef<NodeJS.Timeout>();
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset toolbar visibility when focus mode changes
  useEffect(() => {
    if (!isActive) {
      setShowToolbar(false);
    }
  }, [isActive]);

  // Double-tap detection for mobile
  const handleTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isMobile || !isActive) return;

    // Only detect taps on the paper area (not on text or interactive elements)
    const target = e.target as HTMLElement;
    
    // Ignore taps on segments (text content)
    if (target.closest('[data-segment-id]')) return;
    
    // Ignore taps on buttons and interactive elements
    if (target.closest('button, a, input, select')) return;

    tapCount.current++;

    if (tapTimer.current) {
      clearTimeout(tapTimer.current);
    }

    tapTimer.current = setTimeout(() => {
      if (tapCount.current === 2) {
        setShowToolbar(prev => !prev);
      }
      tapCount.current = 0;
    }, 300);
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (tapTimer.current) {
        clearTimeout(tapTimer.current);
      }
    };
  }, []);

  if (!isActive) {
    return <>{children}</>;
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'fixed inset-0 z-50',
        isMobile ? 'bg-background' : 'bg-black/70 backdrop-blur-sm'
      )}
      onClick={handleTap}
    >
      {/* Desktop: centered with max dimensions */}
      {!isMobile && (
        <div className="absolute inset-0 flex items-center justify-center p-8">
          <div className="relative w-full h-full max-w-5xl group/focus">
            {/* CQI scaling wrapper */}
            <div
              className="w-full h-full"
              style={{
                containerType: 'size',
              }}
            >
              <div
                className="w-full h-full"
                style={{
                  fontSize: '1.5cqi', // Scale text proportionally with container
                }}
              >
                {children}
              </div>
            </div>

            {/* Desktop toolbar - show on hover */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 opacity-0 group-hover/focus:opacity-100 transition-opacity duration-200">
              <div className="flex items-center gap-2">
                {toolbar}
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 bg-background/70 backdrop-blur-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle();
                  }}
                >
                  <Icon name="Minimize2" className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile: full screen */}
      {isMobile && (
        <div className="w-full h-full">
          {/* CQI scaling wrapper */}
          <div
            className="w-full h-full"
            style={{
              containerType: 'size',
            }}
          >
            <div
              className="w-full h-full"
              style={{
                fontSize: '1.5cqi',
              }}
            >
              {children}
            </div>
          </div>

          {/* Mobile toolbar - toggle with double-tap */}
          <div
            className={cn(
              'absolute top-4 left-1/2 -translate-x-1/2 z-10 transition-opacity duration-200',
              showToolbar ? 'opacity-100' : 'opacity-0 pointer-events-none'
            )}
          >
            <div className="flex items-center gap-2">
              {toolbar}
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 bg-background/70 backdrop-blur-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle();
                }}
              >
                <Icon name="Minimize2" className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}