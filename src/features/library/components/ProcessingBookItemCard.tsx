

"use client";

import React, { useContext } from 'react';
import type { Book, LibraryItem } from "@/lib/types";
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import CoverImage from './CoverImage';
import { useLibrary } from '../hooks/useLibrary';

interface ProcessingBookItemCardProps {
    book: Book;
    onDelete?: (item: LibraryItem) => void;
}

export function ProcessingBookItemCard({ book, onDelete }: ProcessingBookItemCardProps) {
  const { t } = useTranslation('bookCard');
  const isContentFailed = book.contentState === 'error';
  const isCoverFailed = book.coverState === 'error';
  const title = book.title?.primary || t('untitled');

  return (
    <div className="w-full flex flex-col break-inside-avoid">
        <div className="relative block w-full aspect-[3/4] rounded-lg overflow-hidden shadow-lg z-10">
            <CoverImage 
                title={title}
                coverStatus={book.coverState}
                className="w-full h-full"
                isRetrying={false}
            />
        </div>
        <div className="w-[95%] self-end -mt-4">
            <Card className="bg-card shadow-lg rounded-lg relative">
                <CardContent className="p-3 pt-6 pb-4 flex flex-col justify-center">
                    <div className="flex justify-between items-start">
                        <div className="min-w-0">
                            <CardTitle className="text-body-lg leading-snug truncate" title={title}>
                                {title}
                            </CardTitle>
                            <CardDescription className="text-body-sm">
                                {isContentFailed && isCoverFailed ? t('processingFailedBoth') :
                                 isContentFailed ? t('processingFailedContent') :
                                 isCoverFailed ? t('processingFailedCover') : t('processing')}
                            </CardDescription>
                        </div>
                        {onDelete && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button size="icon" variant="ghost" className="rounded-full h-7 w-7 text-muted-foreground flex-shrink-0">
                                        <Icon name="MoreVertical" className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="font-body">
                                    <DropdownMenuItem className="text-destructive focus:text-destructive-foreground" onClick={() => onDelete(book)}>
                                        <Icon name="Trash2" className="mr-2 h-4 w-4" />
                                        {t('deleteBook')}
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
