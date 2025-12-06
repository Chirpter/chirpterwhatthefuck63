
'use client';
import { useRef, useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import type { DiaryEntry, DiaryObject } from '@/features/diary/types';
import { diaryEventManager } from '../foundation/event-manager';
import * as diaryService from '@/services/diary-service';
import { FoundationContainer } from '../foundation/foundation-container';

const createRequestsInProgress = new Set<string>();

/**
 * Create a stable-ish request id for deduplication.
 * - Guard against missing coords
 * - Do NOT include Date.now() so identical requests within TTL dedupe properly
 */
const generateRequestId = (detail: any): string => {
  const { tool, coords, pageId, data } = detail || {};
  const cx = coords && typeof coords.x === 'number' ? coords.x.toFixed(3) : 'na';
  const cy = coords && typeof coords.y === 'number' ? coords.y.toFixed(3) : 'na';
  const dataSample = typeof data === 'string' ? data.substring(0, 10) : '';
  return `${tool || 'unk'}-${pageId || 'nopage'}-${cx}-${cy}-${dataSample}`;
};

export const useDiaryFoundation = (services: FoundationContainer | null) => {
  const { user } = useAuth();

  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState({ width: 500, height: 700 });
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastInteractedPageId, setLastInteractedPageId] = useState<string | null>(null);

  const [entries, setEntries] = useState<(DiaryEntry | null)[] | undefined>(undefined);
  const [isLoadingEntries, setIsLoadingEntries] = useState(true);

  // Refs to hold latest handler implementations so stable wrappers can call newest logic
  const handleCreateRequestRef = useRef<(detail: any) => Promise<void> | void>(() => {});
  const handleObjectUpdateRef = useRef<(id: string, updates: Partial<DiaryObject>) => void>(() => {});
  const handleObjectDeleteRef = useRef<(id: string, updates?: Partial<DiaryObject>) => void>(() => {});


  // Local updater ref so stable handlers can update React state without stale closures
  const updateLocalEntriesRef = useRef<(updater: (prevEntries: (DiaryEntry | null)[] | undefined) => (DiaryEntry | null)[] | undefined) => void>();
  const updateLocalEntries = useCallback((updater: (prevEntries: (DiaryEntry | null)[] | undefined) => (DiaryEntry | null)[] | undefined) => {
    setEntries(prev => updater(prev));
  }, []);
  useEffect(() => { updateLocalEntriesRef.current = updateLocalEntries; }, [updateLocalEntries]);

  // ---------- Handlers ----------
  const handleObjectUpdate = useCallback(async (objectId: string, updates: Partial<DiaryObject>): Promise<void> => {
    if (!user || !services?.isReady) return;

    const entryIdStr = services.objects.findPageIdForObject(objectId);
    if (!entryIdStr) {
      return;
    }

    const updatedObjectInMemory = services.objects.updateObject(entryIdStr, objectId, updates);

    if (updatedObjectInMemory) {
      setEntries(prevEntries => {
        if (!prevEntries) return prevEntries;
        const entryIndex = prevEntries.findIndex(entry => entry && entry.id === parseInt(entryIdStr));
        if (entryIndex === -1) return prevEntries;

        const newEntries = [...prevEntries];
        const targetEntry = newEntries[entryIndex]!;

        const objectIndex = targetEntry.objects.findIndex(obj => obj.id === objectId);
        if (objectIndex === -1) return prevEntries;

        const newObjects = [...targetEntry.objects];
        newObjects[objectIndex] = updatedObjectInMemory;

        newEntries[entryIndex] = { ...targetEntry, objects: newObjects };
        return newEntries;
      });

      try {
        await diaryService.updateDiaryObject(user.uid, parseInt(entryIdStr), objectId, updates);
      } catch (err) {
      }
    }
  }, [user, services]);

  const handleObjectDelete = useCallback(async (objectId: string, updates?: Partial<DiaryObject>): Promise<void> => {
    if (!user || !services?.isReady || !services.stateMachine.getCapabilities?.()?.canDeleteObjects) return;

    const entryIdStr = services.objects.findPageIdForObject(objectId);
    if (!entryIdStr) return;

    try {
      services.objects.removeObject(entryIdStr, objectId);

      setEntries(prevEntries => {
        if (!prevEntries) return prevEntries;
        return prevEntries.map(entry => {
          if (entry && entry.id === parseInt(entryIdStr)) {
            return { ...entry, objects: entry.objects.filter(obj => obj.id !== objectId) };
          }
          return entry;
        });
      });

      services.stateMachine.selectObjects([]);

      await diaryService.deleteDiaryObject(user.uid, parseInt(entryIdStr), objectId);
    } catch (err) {
    }
  }, [user, services]);

  const handleCreateRequest = useCallback(async (detail: any) => {
    if (!services || !user) return;

    const requestId = generateRequestId(detail);
    if (createRequestsInProgress.has(requestId)) {
        return;
    }

    createRequestsInProgress.add(requestId);
    setTimeout(() => createRequestsInProgress.delete(requestId), 1000);

    const { tool, coords, pageId, data } = detail || {};
    if (!services.viewport || !pageId || String(pageId).startsWith('cover')) return;

    try {
        const newObject = await services.toolManager.createObject(tool, coords, pageId, services.viewport, data);
        if (!newObject) return;
        
        // --- Special handling for Date Marker ---
        if (tool === 'dateMarker' && newObject.type === 'text') {
            try {
                const contentJson = JSON.parse(newObject.content);
                const dateStr = new Date(contentJson.date).toISOString().split('T')[0];
                const mood = contentJson.mood || '😐';
                
                await diaryService.updateDiaryEntry(user.uid, parseInt(pageId), { date: dateStr, mood: mood });

                updateLocalEntriesRef.current?.(prevEntries => {
                  if (!prevEntries) return prevEntries;
                  return prevEntries.map(e => (e && e.id === parseInt(pageId)) ? { ...e, date: dateStr, mood: mood } : e);
                });

            } catch (e) {
                console.warn("Could not parse date marker content on creation:", e);
            }
        }
        
        // Persist the new object to the database
        await diaryService.addObjectsToDiary(user.uid, parseInt(pageId), [newObject]);
        
        // Add the new object to the local state
        updateLocalEntriesRef.current?.(prevEntries => {
            if (!prevEntries) return prevEntries;
            return prevEntries.map(entry => {
                if (entry && entry.id === parseInt(pageId)) {
                    // Make sure object doesn't already exist from a race condition
                    if (!entry.objects.some(o => o.id === newObject.id)) {
                        return { ...entry, objects: [...entry.objects, newObject] };
                    }
                }
                return entry;
            });
        });
        
        // Select the new object
        services.stateMachine.selectObjects([newObject.id]);

    } catch (err) {
        console.error("Error during object creation request:", err);
    }
}, [user, services]);


  // keep refs up-to-date with latest implementations
  useEffect(() => { handleObjectUpdateRef.current = handleObjectUpdate; }, [handleObjectUpdate]);
  useEffect(() => { handleObjectDeleteRef.current = handleObjectDelete; }, [handleObjectDelete]);
  useEffect(() => { handleCreateRequestRef.current = handleCreateRequest; }, [handleCreateRequest]);

  // inform services about handler refs (so foundation can call stable wrappers if it needs)
  useEffect(() => {
    if (services) {
      services.updateHandlers({
        handleObjectUpdate: (id, updates) => handleObjectUpdateRef.current(id, updates),
        handleObjectDelete: (id, updates) => handleObjectDeleteRef.current(id, updates),
      });
    }
    // rely on services identity stability from parent — if parent recreates services too often, fix parent
  }, [services]);

  // ---------- Load entries (optimized) ----------
  useEffect(() => {
    if (!user) {
      setIsLoadingEntries(false);
      setEntries(undefined);
      return;
    }

    let isMounted = true;

    const loadEntriesOptimized = async () => {
      setIsLoadingEntries(true);
      try {
        const entriesPromise = diaryService.getDiaryEntries(user.uid);
        // kick off cleanup in background and log any error, but do NOT block UI
        diaryService.cleanupEmptyTrailingPages(user.uid).catch(err => {
        });

        const persistedEntries = await entriesPromise;
        if (isMounted) {
          setEntries([null, ...persistedEntries]);
        }
      } catch (err) {
        if (isMounted) setError('Failed to load diary entries');
      } finally {
        if (isMounted) setIsLoadingEntries(false);
      }
    };

    loadEntriesOptimized();

    return () => { isMounted = false; };
  }, [user]);

  // create initial entries if none exist
  useEffect(() => {
    if (!user || isLoadingEntries || (entries && entries.length > 1)) return;

    diaryService.createInitialDiaryEntries(user.uid)
      .then(async () => {
        const persistedEntries = await diaryService.getDiaryEntries(user.uid);
        setEntries([null, ...persistedEntries]);
      })
      .catch(err => {
        setError('Failed to create first entry');
      });
  }, [user, entries, isLoadingEntries]);

  // load objects into foundation when entries change
  useEffect(() => {
    if (!services?.isReady || !entries) return;

    try {
      services.objects.reset();
      entries.forEach(entry => {
        if (entry?.objects && entry.id !== undefined) {
          services.objects.registerBulkObjects(entry.id.toString(), entry.objects);
        }
      });
      if (entries !== undefined) setIsInitializing(false);
    } catch (err) {
      setError('Failed to load objects');
    }
  }, [entries, services]);

  // stable subscription to diary:createObject using the ref
  useEffect(() => {
    if (!user) return;

    const stableHandler = (detail: any) => handleCreateRequestRef.current(detail);

    const unsubscribe = diaryEventManager.addEventListener('diary:createObject', stableHandler);

    return () => {
      unsubscribe();
    };
  }, [user]);

  const visiblePageIds = useMemo(() => {
    if (!entries || entries.length === 0) return [];

    const ids = new Set<string>();
    const leftPageIndex = currentPage * 2;
    const rightPageIndex = currentPage * 2 + 1;

    if (leftPageIndex < entries.length && entries[leftPageIndex]?.id) {
      ids.add(entries[leftPageIndex]!.id!.toString());
    }
    if (rightPageIndex < entries.length && entries[rightPageIndex]?.id) {
      ids.add(entries[rightPageIndex]!.id!.toString());
    }

    return Array.from(ids);
  }, [currentPage, entries]);

  const handleAddPage = useCallback(async () => {
    if (!user) return;
    await diaryService.addNewPageSpread(user.uid);
    const persistedEntries = await diaryService.getDiaryEntries(user.uid);
    setEntries([null, ...persistedEntries]);
  }, [user]);

  const handlePageFlip = useCallback((spreadIndex: number): void => {
    if (services?.stateMachine.getCapabilities().canFlipPages) {
      setCurrentPage(spreadIndex);
      setLastInteractedPageId(null);
    }
  }, [services]);

  return {
    entries,
    pageSize,
    setPageSize,
    currentPage,
    visiblePageIds,
    handlePageFlip,
    handleObjectUpdate,
    handleObjectDelete,
    isInitializing: isInitializing || isLoadingEntries,
    error,
    handleAddPage,
    lastInteractedPageId,
    setLastInteractedPageId,
  };
};
