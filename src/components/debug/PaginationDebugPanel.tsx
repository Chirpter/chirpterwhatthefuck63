
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import type { Book, Piece, Segment, Page } from '@/lib/types';

interface PaginationDebugPanelProps {
  item: Book | Piece;
  segments: Segment[];
  pages: Page[];
  currentPageIndex: number;
  isCalculating: boolean;
  containerRef: React.RefObject<HTMLDivElement>;
  displayLang1: string;
  displayLang2: string;
  unit: 'sentence' | 'phrase';
}

/**
 * Debug panel for pagination issues
 * Only renders in development mode
 */
export function PaginationDebugPanel({
  item,
  segments,
  pages,
  currentPageIndex,
  isCalculating,
  containerRef,
  displayLang1,
  displayLang2,
  unit,
}: PaginationDebugPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Only render in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }
  
  const containerDims = containerRef.current ? {
    width: containerRef.current.clientWidth,
    height: containerRef.current.clientHeight,
    isInDOM: document.contains(containerRef.current),
    offsetWidth: containerRef.current.offsetWidth,
    offsetHeight: containerRef.current.offsetHeight,
  } : null;
  
  const currentPage = pages[currentPageIndex];
  
  const diagnostics = {
    // Data checks
    hasItem: !!item,
    itemType: item?.type,
    hasSegments: segments.length > 0,
    segmentCount: segments.length,
    
    // Pagination checks
    hasPages: pages.length > 0,
    pageCount: pages.length,
    isCalculating,
    currentPageValid: !!currentPage,
    currentPageItemCount: currentPage?.items.length || 0,
    
    // Container checks
    hasContainerRef: !!containerRef.current,
    containerReady: !!containerDims && containerDims.width > 0 && containerDims.height > 0,
    containerDims,
    
    // Settings
    languages: { displayLang1, displayLang2 },
    unit,
    origin: item?.origin,
    
    // Sample segment
    firstSegment: segments[0],
    
    // Current page data
    currentPageSegmentIds: currentPage?.items.map(s => s.id.slice(0, 8)) || [],
  };
  
  const status = {
    overall: pages.length > 0 && currentPage ? '✅ OK' : '❌ FAILED',
    data: segments.length > 0 ? '✅' : '❌',
    container: containerDims && containerDims.width > 0 ? '✅' : '❌',
    pagination: pages.length > 0 ? '✅' : '❌',
    render: currentPage ? '✅' : '❌',
  };
  
  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50 bg-yellow-500 text-black"
      >
        <Icon name="Bug" className="mr-2 h-4 w-4" />
        Debug Pagination
      </Button>
    );
  }
  
  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 max-h-[80vh] overflow-auto bg-black text-white p-4 rounded-lg shadow-xl font-mono text-xs">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-sm">Pagination Debug</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(false)}
          className="text-white"
        >
          <Icon name="X" className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Status Summary */}
      <div className="mb-4 p-2 bg-gray-800 rounded">
        <div className="font-bold mb-2">Status: {status.overall}</div>
        <div className="grid grid-cols-2 gap-1">
          <div>Data: {status.data}</div>
          <div>Container: {status.container}</div>
          <div>Pagination: {status.pagination}</div>
          <div>Render: {status.render}</div>
        </div>
      </div>
      
      {/* Detailed Info */}
      <div className="space-y-3">
        <Section title="Item Info">
          <Info label="Type" value={diagnostics.itemType} />
          <Info label="Origin" value={diagnostics.origin} />
          <Info label="Unit" value={diagnostics.unit} />
        </Section>
        
        <Section title="Data">
          <Info label="Has Segments" value={diagnostics.hasSegments ? 'Yes' : 'No'} />
          <Info label="Segment Count" value={diagnostics.segmentCount} />
          <Info label="First Segment" value={JSON.stringify(diagnostics.firstSegment, null, 2)} mono />
        </Section>
        
        <Section title="Container">
          <Info label="Has Ref" value={diagnostics.hasContainerRef ? 'Yes' : 'No'} />
          <Info label="Is Ready" value={diagnostics.containerReady ? 'Yes' : 'No'} />
          {containerDims && (
            <>
              <Info label="Width" value={`${containerDims.width}px`} />
              <Info label="Height" value={`${containerDims.height}px`} />
              <Info label="In DOM" value={containerDims.isInDOM ? 'Yes' : 'No'} />
            </>
          )}
        </Section>
        
        <Section title="Pagination">
          <Info label="Is Calculating" value={diagnostics.isCalculating ? 'Yes' : 'No'} />
          <Info label="Page Count" value={diagnostics.pageCount} />
          <Info label="Current Page" value={currentPageIndex + 1} />
          <Info label="Current Page Valid" value={diagnostics.currentPageValid ? 'Yes' : 'No'} />
          <Info label="Items on Page" value={diagnostics.currentPageItemCount} />
        </Section>
        
        <Section title="Languages">
          <Info label="Primary" value={displayLang1} />
          <Info label="Secondary" value={displayLang2} />
          <Info label="Mode" value={
            displayLang2 === 'none' 
              ? 'Monolingual' 
              : unit === 'sentence' 
                ? 'Bilingual Sentence' 
                : 'Bilingual Phrase'
          } />
        </Section>
        
        {currentPage && (
          <Section title="Current Page">
            <Info label="Page Index" value={currentPage.pageIndex} />
            <Info label="Items" value={currentPage.items.length} />
            <Info label="Est. Height" value={`${Math.round(currentPage.estimatedHeight)}px`} />
            <Info 
              label="Segment IDs" 
              value={diagnostics.currentPageSegmentIds.join(', ')} 
              mono 
            />
          </Section>
        )}
      </div>
      
      {/* Actions */}
      <div className="mt-4 space-y-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            console.log('=== FULL DIAGNOSTICS ===');
            console.log('Item:', item);
            console.log('Segments:', segments);
            console.log('Pages:', pages);
            console.log('Diagnostics:', diagnostics);
          }}
          className="w-full"
        >
          Log Full State to Console
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const data = JSON.stringify(diagnostics, null, 2);
            navigator.clipboard.writeText(data);
            alert('Diagnostics copied to clipboard!');
          }}
          className="w-full"
        >
          Copy Diagnostics
        </Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-gray-700 pt-2">
      <div className="font-bold text-yellow-400 mb-1">{title}</div>
      <div className="space-y-1 pl-2">{children}</div>
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: any; mono?: boolean }) {
  const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
  
  return (
    <div className="flex flex-col">
      <span className="text-gray-400">{label}:</span>
      <span className={mono ? 'whitespace-pre-wrap break-all' : ''}>
        {valueStr}
      </span>
    </div>
  );
}
