// src/components/debug/AIDebugPanel.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';

interface AIDebugData {
  userPrompt: string;
  systemPrompt: string;
  rawResponse: string;
  timestamp: string;
}

export function AIDebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [debugData, setDebugData] = useState<AIDebugData | null>(null);

  useEffect(() => {
    // Only run this logic in the browser and in development mode
    if (typeof window === 'undefined' || process.env.NODE_ENV !== 'development') {
      return;
    }

    const interval = setInterval(() => {
      try {
        const storedData = sessionStorage.getItem('ai_debug_data');
        if (storedData) {
          const parsedData = JSON.parse(storedData) as AIDebugData;
          // Check if data is different to avoid unnecessary re-renders
          if (JSON.stringify(parsedData) !== JSON.stringify(debugData)) {
            setDebugData(parsedData);
          }
        }
      } catch (e) {
        console.error("Failed to parse AI debug data from sessionStorage", e);
      }
    }, 1000); // Check every second for new data

    return () => clearInterval(interval);
  }, [debugData]); // Re-run effect if debugData changes to avoid comparing to stale state

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    alert('Copied to clipboard!');
  };

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-44 z-50 bg-blue-500 text-white"
      >
        <Icon name="BrainCircuit" className="mr-2 h-4 w-4" />
        AI Debug
      </Button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 w-[calc(100vw-2rem)] md:w-96 max-h-[80vh] overflow-auto bg-black text-white p-4 rounded-lg shadow-xl font-mono text-xs">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-sm">AI Generation Debug</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(false)}
          className="text-white"
        >
          <Icon name="X" className="h-4 w-4" />
        </Button>
      </div>

      {!debugData ? (
        <div className="text-center text-gray-400 py-8">
          <p>No AI generation data captured yet.</p>
          <p className="text-xs mt-2">Generate a book or piece to see the debug info.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-gray-400 text-xs">Last updated: {new Date(debugData.timestamp).toLocaleTimeString()}</div>
          
          <Section title="System Prompt">
            <pre className="whitespace-pre-wrap break-words">{debugData.systemPrompt}</pre>
            <Button size="sm" variant="ghost" onClick={() => handleCopy(debugData.systemPrompt)} className="mt-2 text-xs">Copy</Button>
          </Section>

          <Section title="User Prompt">
            <p className="whitespace-pre-wrap break-words">{debugData.userPrompt}</p>
            <Button size="sm" variant="ghost" onClick={() => handleCopy(debugData.userPrompt)} className="mt-2 text-xs">Copy</Button>
          </Section>
          
          <Section title="Raw AI Response (Markdown)">
            <pre className="whitespace-pre-wrap break-words">{debugData.rawResponse}</pre>
            <Button size="sm" variant="ghost" onClick={() => handleCopy(debugData.rawResponse)} className="mt-2 text-xs">Copy</Button>
          </Section>
        </div>
      )}
    </div>
  );
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="border-t border-gray-700 pt-2">
    <div className="font-bold text-blue-400 mb-1">{title}</div>
    <div className="space-y-1 pl-2">{children}</div>
  </div>
);
