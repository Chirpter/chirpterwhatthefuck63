// src/components/debug/CreationDebugPanel.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import type { Book, Piece } from '@/lib/types';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useUser } from '@/contexts/user-context';


// Simplified state interfaces for debugging
interface PreSubmitState {
  hasActiveJob: boolean;
  activeJobId: string | null;
  hasFinalizedJob: boolean;
  finalizedJobId: string | null;
}

interface SubmissionState {
  submittedAt: string;
  formDataSent: any;
  creditCost: number;
  processingJobsCount: number;
  submissionStatus: 'pending_to_server' | 'success' | 'failed';
}

interface FirestoreJobState {
    id: string;
    status: 'processing' | 'draft' | 'published' | 'archived';
    contentState: 'pending' | 'processing' | 'ready' | 'error' | 'ignored';
    coverState: 'pending' | 'processing' | 'ready' | 'error' | 'ignored';
    contentError?: string;
    coverError?: string;
    debug?: any; // To store the debug data from server
}

const Section = ({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-gray-700 pt-2">
      <button onClick={() => setIsOpen(!isOpen)} className="font-bold text-blue-400 mb-1 w-full text-left flex items-center justify-between">
        {title}
        <Icon name={isOpen ? 'ChevronUp' : 'ChevronDown'} className="h-4 w-4" />
      </button>
      {isOpen && <div className="space-y-1 pl-2 mt-2">{children}</div>}
    </div>
  );
};

const Info = ({ label, value, mono = false, statusColor }: { label: string; value: any; mono?: boolean; statusColor?: string }) => {
    const valueStr = (value === undefined || value === null) ? 'N/A' : (typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value));
    
    return (
      <div className="flex flex-col">
        <span className="text-gray-400">{label}:</span>
        {mono ? (
             <pre className="whitespace-pre-wrap break-all text-xs">{valueStr}</pre>
        ) : (
            <span className={cn("whitespace-pre-wrap break-all", statusColor)}>{valueStr}</span>
        )}
      </div>
    );
};

const getStatusColor = (status: string | undefined | null): string => {
  if (!status) return 'text-gray-500';
  switch (status.toLowerCase()) {
    case 'success':
    case 'ready':
    case 'published':
      return 'text-green-400';
    case 'error':
    case 'failed':
      return 'text-red-400';
    case 'processing':
    case 'pending':
    case 'pending_to_server':
      return 'text-yellow-400';
    default:
      return 'text-gray-400';
  }
};

export function CreationDebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useUser();
  
  // State from sessionStorage (Client-side)
  const [preSubmitState, setPreSubmitState] = useState<PreSubmitState | null>(null);
  const [submissionState, setSubmissionState] = useState<SubmissionState | null>(null);
  
  // State from Firestore (Server-side)
  const [firestoreJobState, setFirestoreJobState] = useState<FirestoreJobState | null>(null);

  const fetchFinalizedJob = useCallback(async (jobId: string) => {
    if (!user) return;
    const docRef = doc(db, `users/${user.uid}/libraryItems`, jobId);
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
        const data = snapshot.data() as (Book | Piece);
        setFirestoreJobState({
            id: data.id,
            status: data.status,
            contentState: data.contentState,
            coverState: (data as Book).coverState || 'ignored',
            contentError: data.contentError,
            coverError: (data as Book).coverError,
            debug: (data as any).debug, // Make sure to get the debug field
        });
    }
  }, [user]);

  useEffect(() => {
    if (typeof window === 'undefined' || process.env.NODE_ENV !== 'development') {
      return;
    }

    const clientInterval = setInterval(() => {
      try {
        const preSubmitRaw = sessionStorage.getItem('creation_debug_presubmit');
        const submissionRaw = sessionStorage.getItem('creation_debug_data');
        
        if (preSubmitRaw) {
            const parsedPreSubmit = JSON.parse(preSubmitRaw);
            setPreSubmitState(parsedPreSubmit);
            // If there's a finalized job, fetch its final state.
            if (parsedPreSubmit.finalizedJobId && firestoreJobState?.id !== parsedPreSubmit.finalizedJobId) {
                fetchFinalizedJob(parsedPreSubmit.finalizedJobId);
            }
        }
        if (submissionRaw) setSubmissionState(JSON.parse(submissionRaw));

      } catch (e) {
        console.error("Failed to parse client debug data from sessionStorage", e);
      }
    }, 1000);
    
    return () => clearInterval(clientInterval);
  }, [firestoreJobState, fetchFinalizedJob]);

  // Effect to listen to Firestore for server-side updates
  useEffect(() => {
    if (!user || !preSubmitState?.activeJobId) {
        // Don't clear state if we have a finalized job to display
        if (!preSubmitState?.finalizedJobId) {
            setFirestoreJobState(null);
        }
        return;
    }

    const docRef = doc(db, `users/${user.uid}/libraryItems`, preSubmitState.activeJobId);
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.data() as (Book | Piece);
            setFirestoreJobState({
                id: data.id,
                status: data.status,
                contentState: data.contentState,
                coverState: (data as Book).coverState || 'ignored',
                contentError: data.contentError,
                coverError: (data as Book).coverError,
                debug: (data as any).debug,
            });
        } else {
             if (!preSubmitState?.finalizedJobId) {
                setFirestoreJobState(null);
            }
        }
    });

    return () => unsubscribe();
  }, [user, preSubmitState]);


  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const handleCopy = (content: any) => {
    const contentString = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    navigator.clipboard.writeText(contentString);
  };
  
  const renderPanelContent = () => {
    const hasAnyData = preSubmitState || submissionState || firestoreJobState;

    return (
      <div className="space-y-4">
        {!hasAnyData && (
             <div className="text-center text-gray-400 py-8">
                <p>No creation data captured yet.</p>
                <p className="text-xs mt-2">Generate content to see debug info.</p>
            </div>
        )}

        {preSubmitState && (
          <Section title="1. Pre-Submission State" defaultOpen={true}>
            <Info label="Active Job Running?" value={preSubmitState.activeJobId ? 'Yes' : 'No'} statusColor={preSubmitState.activeJobId ? 'text-yellow-400' : 'text-green-400'} />
            <Info label="Active Job ID" value={preSubmitState.activeJobId || 'None'} mono />
            <Info label="Finalized Job ID" value={preSubmitState.finalizedJobId || 'None'} mono />
          </Section>
        )}
        
        {submissionState && (
            <Section title="2. Client Submission" defaultOpen={true}>
                <Info label="Submitted At" value={new Date(submissionState.submittedAt).toLocaleTimeString()} />
                <Info label="Status" value={submissionState.submissionStatus} statusColor={getStatusColor(submissionState.submissionStatus)} />
                <Info label="Credit Cost" value={submissionState.creditCost} />
                <Info label="Concurrent Jobs" value={submissionState.processingJobsCount} />
                <details className="mt-2 text-xs">
                    <summary className="cursor-pointer text-gray-400">View Form Data</summary>
                    <pre className="whitespace-pre-wrap break-all">{JSON.stringify(submissionState.formDataSent, null, 2)}</pre>
                    <Button size="sm" variant="ghost" onClick={() => handleCopy(submissionState.formDataSent)} className="mt-2 text-xs h-6">Copy</Button>
                </details>
            </Section>
        )}
        
        {firestoreJobState?.debug && (
          <Section title="3. AI / Server Pipeline" defaultOpen={true}>
            <details className="mt-2 text-xs">
                <summary className="cursor-pointer text-gray-400">View Final AI Prompt</summary>
                <pre className="whitespace-pre-wrap break-all">{firestoreJobState.debug.finalPrompt}</pre>
                <Button size="sm" variant="ghost" onClick={() => handleCopy(firestoreJobState.debug.finalPrompt)} className="mt-2 text-xs h-6">Copy</Button>
            </details>
             <details className="mt-2 text-xs">
                <summary className="cursor-pointer text-gray-400">View Raw AI Response</summary>
                <pre className="whitespace-pre-wrap break-all">{firestoreJobState.debug.rawResponse}</pre>
                <Button size="sm" variant="ghost" onClick={() => handleCopy(firestoreJobState.debug.rawResponse)} className="mt-2 text-xs h-6">Copy</Button>
            </details>
             {firestoreJobState.contentError && <Info label="Content Error" value={firestoreJobState.contentError} statusColor="text-red-400" mono />}
             {firestoreJobState.coverError && <Info label="Cover Error" value={firestoreJobState.coverError} statusColor="text-red-400" mono />}
          </Section>
        )}
        
        {firestoreJobState && (
            <Section title="4. Final Data State" defaultOpen={true}>
                <Info label="Overall Status" value={firestoreJobState.status} statusColor={getStatusColor(firestoreJobState.status)} />
                <Info label="Content Gen Status" value={firestoreJobState.contentState} statusColor={getStatusColor(firestoreJobState.contentState)} />
                <Info label="Cover Gen Status" value={firestoreJobState.coverState} statusColor={getStatusColor(firestoreJobState.coverState)} />
                 {firestoreJobState.debug?.parsedData && (
                    <details className="mt-2 text-xs">
                        <summary className="cursor-pointer text-gray-400">View Parsed JSON Data</summary>
                        <pre className="whitespace-pre-wrap break-all">{JSON.stringify(firestoreJobState.debug.parsedData, null, 2)}</pre>
                        <Button size="sm" variant="ghost" onClick={() => handleCopy(firestoreJobState.debug.parsedData)} className="mt-2 text-xs h-6">Copy</Button>
                    </details>
                 )}
            </Section>
        )}

      </div>
    );
  };

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 left-4 z-50 bg-blue-500 text-white"
      >
        <Icon name="BrainCircuit" className="mr-2 h-4 w-4" />
        Creation Debug
      </Button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 w-[calc(100vw-2rem)] md:w-96 max-h-[80vh] overflow-y-auto bg-black text-white p-4 rounded-lg shadow-xl font-mono text-xs">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-sm">Creation Flow Debug</h3>
        <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)} className="text-white">
          <Icon name="X" className="h-4 w-4" />
        </Button>
      </div>
      {renderPanelContent()}
    </div>
  );
}