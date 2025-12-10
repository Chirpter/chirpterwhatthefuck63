'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';

const PerformanceMonitor = () => {
  const [fps, setFps] = useState(0);
  const [mem, setMem] = useState({ used: 0, total: 0 });
  const [isOpen, setIsOpen] = useState(false);
  const { i18n } = useTranslation();

  const frames = React.useRef(0);
  const lastTime = React.useRef(performance.now());

  const updatePerformance = useCallback(() => {
    const now = performance.now();
    frames.current++;
    if (now > lastTime.current + 1000) {
      const currentFps = Math.round((frames.current * 1000) / (now - lastTime.current));
      setFps(currentFps);
      frames.current = 0;
      lastTime.current = now;

      if ('memory' in performance) {
        const memory = (performance as any).memory;
        setMem({
          used: Math.round(memory.usedJSHeapSize / 1024 / 1024),
          total: Math.round(memory.totalJSHeapSize / 1024 / 1024),
        });
      }
    }
    requestAnimationFrame(updatePerformance);
  }, []);

  useEffect(() => {
    const animationFrameId = requestAnimationFrame(updatePerformance);
    return () => cancelAnimationFrame(animationFrameId);
  }, [updatePerformance]);

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="icon"
        className="fixed bottom-2 left-2 z-[100] h-10 w-10 bg-background/80 backdrop-blur-sm"
        onClick={() => setIsOpen(true)}
      >
        <Icon name="Gauge" className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <div className="fixed bottom-2 left-2 z-[100] w-48 rounded-lg border bg-background/80 p-2 text-xs shadow-lg backdrop-blur-sm">
      <div className="flex justify-between items-center">
        <p className="font-bold">Dev Monitor</p>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setIsOpen(false)}
        >
          <Icon name="X" className="h-4 w-4" />
        </Button>
      </div>
      <div className="mt-2 space-y-1">
        <p>
          <span className="font-semibold">FPS:</span> {fps}
        </p>
        <p>
          <span className="font-semibold">MEM:</span> {mem.used}MB / {mem.total}MB
        </p>
        <p>
          <span className="font-semibold">LANG:</span> {i18n.language}
        </p>
      </div>
    </div>
  );
};

export { PerformanceMonitor };
