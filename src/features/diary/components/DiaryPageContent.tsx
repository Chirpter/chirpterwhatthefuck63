// src/features/diary/components/DiaryPageContent.tsx

'use client';

import React from 'react';
import type { DiaryEntry } from '../types';
import type { FoundationContainer } from '../foundation/foundation-container';
import { ObjectRenderer } from './ObjectRenderer';

interface DiaryPageContentProps {
  entry?: DiaryEntry | null; // Made optional as it will be cloned
  pageSize: { width: number, height: number };
  foundation: FoundationContainer;
  selectedObjectIds?: string[];
  isCover?: boolean;
}

export const DiaryPageContent: React.FC<DiaryPageContentProps> = React.memo(({
  entry,
  pageSize,
  foundation,
  selectedObjectIds = [],
  isCover = false,
}) => {
  if (isCover || !entry) {
    return null; 
  }
  
  const objects = entry.objects || [];

  return (
    <div className="w-full h-full relative">
      {objects.map((object) => (
        <ObjectRenderer
          key={object.id}
          object={object}
          pageId={entry.id!.toString()} // Pass pageId down
          pageSize={pageSize}
          foundation={foundation}
          isSelected={selectedObjectIds.includes(object.id)}
        />
      ))}
    </div>
  );
});

DiaryPageContent.displayName = 'DiaryPageContent';
