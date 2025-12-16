// src/components/debug/CreationDebugPanel.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';

interface DebugData {
  submittedAt: string;
  formDataSent: any;
  creditCost: number;
  processingJobsCount: number;
  ai?: {
    systemPrompt: string;
    userPrompt: string;
    rawResponse: string;
  };
}

export function CreationDebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [debugData, setDebugData] = useState<DebugData | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || process.env.NODE_ENV !== 'development') {
      return;
    }

    const interval = setInterval(() => {
      try {
        const creationDataRaw = sessionStorage.getItem('creation_debug_data');
        const aiDataRaw = sessionStorage.getItem('ai_debug_data');

        if (creationDataRaw) {
          const creationData = JSON.parse(creationDataRaw);
          const aiData = aiDataRaw ? JSON.parse(aiDataRaw) : null;
          
          const combinedData = { ...creationData, ai: aiData };

          if (JSON.stringify(combinedData) !== JSON.stringify(debugData)) {
            setDebugData(combinedData);
          }
        }
      } catch (e) {
        console.error("Failed to parse debug data from sessionStorage", e);
      }
    }, 1000); // Check every second

    return () => clearInterval(interval);
  }, [debugData]);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const handleCopy = (content: any) => {
    const contentString = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    navigator.clipboard.writeText(contentString);
    alert('Copied to clipboard!');
  };

  const renderPanelContent = () => {
    if (!debugData) {
      return (
        <div className="text-center text-gray-400 py-8">
          <p>No creation data captured yet.</p>
          <p className="text-xs mt-2">Generate a book or piece to see debug info.</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="text-gray-400 text-xs">Last submission: {new Date(debugData.submittedAt).toLocaleTimeString()}</div>
        
        <Section title="Submission State">
          <Info label="Credit Cost" value={debugData.creditCost} />
          <Info label="Concurrent Jobs" value={debugData.processingJobsCount} />
          <Info label="Form Data Sent" value={debugData.formDataSent} mono />
          <Button size="sm" variant="ghost" onClick={() => handleCopy(debugData.formDataSent)} className="mt-2 text-xs">Copy Form Data</Button>
        </Section>

        {debugData.ai && (
          <>
            <Section title="AI System Prompt">
              <pre className="whitespace-pre-wrap break-words">{debugData.ai.systemPrompt}</pre>
              <Button size="sm" variant="ghost" onClick={() => handleCopy(debugData.ai.systemPrompt)} className="mt-2 text-xs">Copy</Button>
            </Section>

            <Section title="AI User Prompt">
              <p className="whitespace-pre-wrap break-words">{debugData.ai.userPrompt}</p>
              <Button size="sm" variant="ghost" onClick={() => handleCopy(debugData.ai.userPrompt)} className="mt-2 text-xs">Copy</Button>
            </Section>
            
            <Section title="Raw AI Response (Markdown)">
              <pre className="whitespace-pre-wrap break-words">{debugData.ai.rawResponse}</pre>
              <Button size="sm" variant="ghost" onClick={() => handleCopy(debugData.ai.rawResponse)} className="mt-2 text-xs">Copy</Button>
            </Section>
          </>
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
    <div className="fixed bottom-4 left-4 z-50 w-[calc(100vw-2rem)] md:w-96 max-h-[80vh] overflow-auto bg-black text-white p-4 rounded-lg shadow-xl font-mono text-xs">
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

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="border-t border-gray-700 pt-2">
    <div className="font-bold text-blue-400 mb-1">{title}</div>
    <div className="space-y-1 pl-2">{children}</div>
  </div>
);

const Info = ({ label, value, mono = false }: { label: string; value: any; mono?: boolean }) => {
    const valueStr = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
    
    return (
      <div className="flex flex-col">
        <span className="text-gray-400">{label}:</span>
        {mono ? (
             <pre className="whitespace-pre-wrap break-all text-xs">{valueStr}</pre>
        ) : (
            <span className="whitespace-pre-wrap break-all">{valueStr}</span>
        )}
      </div>
    );
  };
