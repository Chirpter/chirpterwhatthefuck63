// src/features/vocabulary/components/vocab/VocabularyTable.tsx

"use client";

import React, { useState } from 'react';
import type { VocabularyItem as VocabItemType } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { VideoSnippetPopover } from '@/features/learning/components/vocab-videos/VideoSnippetPopover';

interface VocabularyTableProps {
  items: VocabItemType[];
  onPronounce: (term: string, lang?: string) => void;
  onEdit: (item: VocabItemType) => void;
  onDelete: (item: VocabItemType) => void;
}

const TableRowItem: React.FC<{ item: VocabItemType } & Omit<VocabularyTableProps, 'items'>> = ({ item, onPronounce, onEdit, onDelete }) => {
    const { t } = useTranslation(['vocabularyPage', 'common']);
    
    const sourceLink = !item.sourceDeleted && item.sourceId && item.sourceType === 'book'
        ? (item.chapterId && item.segmentId 
            ? `/read/${item.sourceId}?chapterId=${item.chapterId}&segmentId=${item.segmentId}`
            : `/read/${item.sourceId}`)
        : '';
    
    return (
        <TableRow>
            <TableCell className="font-medium text-body-base">{item.term} {item.partOfSpeech && <span className="ml-1 text-caption italic">({item.partOfSpeech})</span>}</TableCell>
            <TableCell className="text-body-sm">{item.meaning}</TableCell>
            <TableCell className="max-w-xs truncate text-caption italic">
                {item.example}
            </TableCell>
            <TableCell>
                {item.folder ? <Badge variant="secondary" className="text-caption">{item.folder}</Badge> : <span className="text-muted-foreground">-</span>}
            </TableCell>
            <TableCell className="text-right w-[200px]">
                <VideoSnippetPopover term={item.term}>
                    <Button variant="ghost" size="icon" onClick={e => e.stopPropagation()} aria-label={t('table.videoAction')}>
                        <Icon name="Youtube" className="h-4 w-4" />
                    </Button>
                </VideoSnippetPopover>
                <Button variant="ghost" size="icon" onClick={() => onPronounce(item.term, item.termLanguage)} aria-label={t('table.pronounceAction')}>
                    <Icon name="Volume2" className="h-4 w-4" />
                </Button>
                {sourceLink && (
                    <Button variant="ghost" size="icon" asChild>
                        <Link href={sourceLink} aria-label={t('table.goToSourceAction')}>
                            <Icon name="BookOpen" className="h-4 w-4" />
                        </Link>
                    </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => onEdit(item)} aria-label={t('common:edit')}>
                    <Icon name="Edit" className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onDelete(item)} className="text-destructive" aria-label={t('common:delete')}>
                    <Icon name="Trash2" className="h-4 w-4" />
                </Button>
            </TableCell>
        </TableRow>
    );
};


const VocabularyTableComponent: React.FC<VocabularyTableProps> = ({ items, onPronounce, onEdit, onDelete }) => {
    const { t } = useTranslation(['vocabularyPage', 'common']);

    return (
        <div className="border rounded-lg">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[150px] text-body-sm">{t('table.term')}</TableHead>
                        <TableHead className="text-body-sm">{t('table.meaning')}</TableHead>
                        <TableHead className="text-body-sm">{t('table.example')}</TableHead>
                        <TableHead className="text-body-sm">{t('table.folder')}</TableHead>
                        <TableHead className="text-right w-[200px] text-body-sm">{t('table.actions')}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {items.map((item) => (
                        <TableRowItem
                            key={item.id}
                            item={item}
                            onPronounce={onPronounce}
                            onEdit={onEdit}
                            onDelete={onDelete}
                        />
                    ))}
                </TableBody>
            </Table>
        </div>
    );
};

export const VocabularyTable = React.memo(VocabularyTableComponent);
