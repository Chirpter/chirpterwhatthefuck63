'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useMobile } from '@/hooks/useMobile';
import { Icon } from '@/components/ui/icons';
import { useDiaryFoundation } from '../hooks/useDiaryFoundation';
import { DiarySidebar } from './DiarySidebar';
import { DiaryCanvas } from './DiaryCanvas';
import { ContextualToolbar } from './ContextualToolbar';
import { motion, AnimatePresence } from 'framer-motion';
import { diaryEventManager } from '../foundation/event-manager';
import { FoundationContainer } from '../foundation/foundation-container';

/**
 * ErrorBoundary simple wrapper for Diary (client-side)
 * React's ErrorBoundary must be class; provide a small class here.
 */
class DiaryErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error?: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: undefined };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, info: any) {
    console.error('[DiaryErrorBoundary] Error caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-center">
          <Icon name="AlertCircle" className="h-12 w-12 mx-auto mb-2 text-destructive" />
          <h3 className="font-semibold">Something went wrong in Diary</h3>
          <pre className="mt-2 text-sm text-muted-foreground">{String(this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * DiaryView main component.
 * Responsibilities:
 *  - create FoundationContainer once and pass it to the hook
 *  - provide a container DOM element to the services.connectDom when ready
 *  - render sidebar, canvas, contextual toolbar, mobile layout
 */
export default function DiaryView() {
  const isMobile = useMobile();

  // initial page size (kept in parent because FoundationContainer needs it on construction)
  const [pageSize, setPageSize] = useState({ width: 500, height: 700 });

  // Create FoundationContainer once (memoized). Provide initial no-op handlers;
  // useDiaryFoundation will wire real handlers into services.updateHandlers.
  const services = useMemo(() => {
    try {
      return new FoundationContainer({
        pageSize,
        handleObjectUpdate: () => {},
        handleObjectDelete: () => {},
      });
    } catch (e) {
      console.error('[DiaryView] Failed to create FoundationContainer:', e);
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // create once on mount

  // Provide the services into the hook
  const {
    entries,
    currentPage,
    visiblePageIds,
    handlePageFlip,
    handleObjectUpdate,
    handleObjectDelete,
    setPageSize: hookSetPageSize,
    isInitializing,
    error,
    handleAddPage,
    lastInteractedPageId,
    setLastInteractedPageId,
  } = useDiaryFoundation(services);

  // Keep local pageSize in sync with hook's setter if needed
  useEffect(() => {
    // If hook requests pageSize changes, reflect to local parent state
    // (hook exposes setPageSize; here we just ensure the parent and hook stay consistent)
    if (hookSetPageSize) {
      hookSetPageSize(pageSize);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize]);

  // book container ref for DOM connection and for contextual toolbar placement
  const bookContainerRef = useRef<HTMLDivElement | null>(null);

  // Connect DOM to services once the container is ready.
  useEffect(() => {
    if (!services) return;
    const container = bookContainerRef.current;
    if (container && !services.viewport) {
      try {
        services.connectDom(container);
      } catch (err) {
        console.error('[DiaryView] services.connectDom failed:', err);
      }
    }
    // If pageSize changes we may want to notify viewport (if created)
    try {
      if (services.viewport) {
        // If ViewportEngine implements resize update, call it:
        // (Here we try best-effort call; guard for method presence)
        (services.viewport as any)?.setSize?.(pageSize);
      }
    } catch (e) {
      // ignore
    }
  }, [services, pageSize]);

  // Selection & toolbar state
  const [selectedObjects, setSelectedObjects] = useState<any[]>([]);
  const [toolbarPosition, setToolbarPosition] = useState({ x: 0, y: 0 });
  const [isViewModeLocal, setIsViewModeLocal] = useState<boolean>(() => services?.stateMachine.isViewMode() ?? true);

  // Subscribe to selection and stateChange events (local UI)
  useEffect(() => {
    if (!services) return;

    const handleSelectionChanged = (detail: { from: string[]; to: string[] }) => {
      const selectedIds = detail.to;
      if (selectedIds.length > 0) {
        const objects = services.getObjectsByIds(selectedIds, undefined);
        setSelectedObjects(objects);

        const lastSelectedId = selectedIds[selectedIds.length - 1];
        const element = document.querySelector(`[data-diary-object-id="${lastSelectedId}"]`) as HTMLElement | null;

        if (element) {
          const rect = element.getBoundingClientRect();
          const newPosition = {
            x: rect.left + rect.width / 2,
            y: rect.top - 10,
          };
          setToolbarPosition(newPosition);
        }
      } else {
        setSelectedObjects([]);
      }
    };

    const handleStateChange = (detail: any) => {
      setIsViewModeLocal(detail.to === 'view');
    };

    const unsubSel = diaryEventManager.addEventListener('selection:changed', handleSelectionChanged as any);
    const unsubState = diaryEventManager.addEventListener('diary:stateChange', handleStateChange as any);

    // initialize selection state from stateMachine context
    try {
      const currentSelection = services.stateMachine.getContext().selectedObjectIds;
      handleSelectionChanged({ from: [], to: currentSelection });
      setIsViewModeLocal(services.stateMachine.isViewMode());
    } catch (e) {
      // ignore initialization errors
    }

    return () => {
      unsubSel();
      unsubState();
    };
  }, [services]);

  // Toolbar visible if any selected and not in view mode
  const isToolbarVisible = selectedObjects.length > 0 && services && !services.stateMachine.isViewMode();

  // Sidebar content memoized
  const sidebarContent = useMemo(() => {
    if (!services || !entries) return null;
    return (
      <DiarySidebar
        foundation={services}
        lastInteractedPageId={lastInteractedPageId}
        visiblePageIds={visiblePageIds}
      />
    );
  }, [services, entries, lastInteractedPageId, visiblePageIds]);

  return (
    <DiaryErrorBoundary>
      <div className="flex flex-col md:flex-row h-screen bg-gradient-to-br from-yellow-100/50 to-background dark:from-yellow-900/10 dark:to-background overflow-hidden">
        {!isMobile && (
          <aside className="flex-shrink-0 p-4 overflow-y-auto w-72 bg-gray-800/50 text-white backdrop-blur-sm border-r border-white/10">
            {sidebarContent}
          </aside>
        )}

        <main
          ref={bookContainerRef}
          className="flex-1 flex items-center justify-center overflow-hidden"
        >
          {isInitializing || !services || !entries ? (
            <div className="flex h-full w-full items-center justify-center bg-background">
              <Icon name="BookOpen" className="h-12 w-12 animate-pulse text-primary" />
            </div>
          ) : error ? (
            <div className="text-center text-destructive p-4">
              <Icon name="AlertCircle" className="h-12 w-12 mx-auto mb-2" />
              <p className="font-semibold">An Error Occurred</p>
              <p className="text-sm">{error}</p>
            </div>
          ) : (
            <DiaryCanvas
              entries={entries}
              pageSize={pageSize}
              foundation={services}
              onPageFlip={handlePageFlip}
              setPageSize={(size) => {
                setPageSize(size);
                // also notify services viewport if present
                try { (services.viewport as any)?.setSize?.(size); } catch (_) {}
              }}
              currentPage={currentPage}
              onAddPage={handleAddPage}
              lastInteractedPageId={lastInteractedPageId}
              setLastInteractedPageId={setLastInteractedPageId}
              isViewMode={isViewModeLocal}
              visiblePageIds={visiblePageIds}
            />
          )}
        </main>

        {isMobile && (
          <div className="fixed bottom-0 left-0 right-0 bg-gray-900/80 backdrop-blur-sm border-t border-white/10 p-2 z-50" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
            {sidebarContent}
          </div>
        )}

        <AnimatePresence>
          {isToolbarVisible && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="absolute"
              style={{
                left: toolbarPosition.x,
                top: toolbarPosition.y,
                transform: 'translate(-50%, -100%)',
              }}
            >
              <ContextualToolbar
                selectedObjects={selectedObjects}
                onObjectUpdate={handleObjectUpdate}
                onObjectDelete={handleObjectDelete}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DiaryErrorBoundary>
  );
}
