// src/features/diary/components/Page.tsx

'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import type { DiaryEntry } from '../types';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/contexts/auth-context';
import * as diaryService from '@/services/diary-service';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PageProps {
  children?: React.ReactNode;
  number: number;
  isCover?: boolean;
  coverType?: 'inside-cover-front' | 'inside-cover-back';
  isViewMode?: boolean;
  onAddPage?: () => void;
  isActiveForEditing?: boolean;
  'data-page-id'?: string;
  // New props for the navigation cover
  allEntries?: (DiaryEntry | null)[];
  onNavigateToDate?: (date: Date) => void;
}

const MOOD_OPTIONS = ['😊', '😄', '😔', '😠', '🥰', '🤔', '😐'];

const DiaryCoverMenu: React.FC<{ entries: (DiaryEntry | null)[]; onNavigate: (date: Date) => void }> = ({ entries, onNavigate }) => {
    const [date, setDate] = React.useState<Date | undefined>(new Date());
    const { user } = useUser();

    const daysWithEntries = React.useMemo(() => {
        return entries
            .filter((entry): entry is DiaryEntry => !!entry && !!entry.date)
            .map(entry => new Date(entry.date + 'T00:00:00')); // Ensure parsing as local date
    }, [entries]);

    const recentEntries = React.useMemo(() => {
        return entries
            .filter((entry): entry is DiaryEntry => !!entry && !!entry.date && entry.objects.some(obj => obj.type !== 'dateMarker'))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 5);
    }, [entries]);

    const handleMoodChange = async (entryId: number, newMood: string) => {
        if (!user) return;
        await diaryService.updateDiaryEntry(user.uid, entryId, { mood: newMood });
    };

    return (
        <div className="w-full h-full scrapbook-cover-bg p-3 md:p-4 flex flex-col overflow-hidden">
             {/* Decorative Elements */}
            <div className="absolute top-4 right-4 w-16 h-16 bg-amber-800/20 dark:bg-amber-200/20 rounded-full blur-2xl" />
            <div className="absolute bottom-10 left-10 w-20 h-20 bg-primary/20 dark:bg-primary/20 rounded-full blur-3xl" />
            <div 
                className="absolute top-0 right-5 h-20 w-8" 
                style={{
                    backgroundColor: '#d4c4a8',
                    maskImage: `url('data:image/svg+xml;charset=UTF-8,<svg width="32" height="80" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="80" fill="black" rx="4"/></svg>')`,
                    WebkitMaskImage: `url('data:image/svg+xml;charset=UTF-8,<svg width="32" height="80" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="80" fill="black" rx="4"/></svg>')`,
                }}
            />

            {/* Main Content */}
            <div className="relative z-10 flex flex-col flex-grow">
                 <h2 className="text-2xl md:text-3xl font-headline font-bold mb-2 text-center text-amber-900/80 dark:text-amber-200/80" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.1)'}}>
                    Navigator
                </h2>

                <div className="calendar-paper p-2 md:p-3 rounded-lg relative mb-3">
                    <div className="absolute -top-1 -left-1 h-8 w-8 bg-contain bg-no-repeat" style={{ backgroundImage: `url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50,10 C20,10 10,40 10,60 S30,90 50,90 90,80 90,60 80,10 50,10 Z" fill="%23eaddc7"/></svg>')`}} />
                     <Calendar
                        mode="single"
                        selected={date}
                        onSelect={setDate}
                        onDayClick={(day) => daysWithEntries.some(d => d.toDateString() === day.toDateString()) && onNavigate(day)}
                        className="p-0 [&_button]:text-amber-900/90 dark:[&_button]:text-amber-100/90"
                        classNames={{
                            caption_label: "font-headline text-amber-900 dark:text-amber-100",
                            head_cell: "text-amber-800/70 dark:text-amber-200/70",
                            day_selected: "bg-primary text-primary-foreground",
                            day_today: "bg-accent/80 text-accent-foreground",
                        }}
                        modifiers={{ entry: daysWithEntries }}
                        modifiersClassNames={{ entry: 'rdp-day_entry' }}
                    />
                </div>
                
                <div className="flex-grow flex flex-col min-h-0">
                    <h3 className="font-headline font-semibold mb-2 text-amber-900/80 dark:text-amber-200/80">Recent Entries</h3>
                    <ScrollArea className="flex-grow">
                        <div className="space-y-1 pr-2">
                        {recentEntries.length > 0 ? (
                            recentEntries.map(entry => (
                                <div key={entry.id} className="washi-tape-entry flex items-center p-1.5 transition-transform hover:-translate-y-0.5 hover:rotate-[-1deg]">
                                     <Popover>
                                        <PopoverTrigger asChild>
                                            <button className="text-lg md:text-xl cursor-pointer transition-transform hover:scale-110 mr-2 text-amber-900/80 dark:text-amber-100/80">
                                                {entry.mood || ''}
                                            </button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-1">
                                            <div className="flex gap-1">
                                                {MOOD_OPTIONS.map(option => (
                                                    <Button key={option} variant="ghost" size="icon" className="text-xl rounded-full" onClick={() => handleMoodChange(entry.id!, option)}>
                                                        {option}
                                                    </Button>
                                                ))}
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                    <Button 
                                        variant="ghost" 
                                        className="w-full justify-start h-auto py-0 px-2 text-left text-xs md:text-sm text-amber-900/90 dark:text-amber-100/90 font-semibold"
                                        onClick={() => onNavigate(new Date(entry.date + 'T00:00:00'))}
                                    >
                                        <span className="flex-1">
                                            {new Date(entry.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
                                        </span>
                                    </Button>
                                </div>
                            ))
                        ) : (
                            <p className="text-xs text-center text-amber-800/60 dark:text-amber-200/60 p-4">No entries yet.</p>
                        )}
                        </div>
                    </ScrollArea>
                </div>
            </div>
        </div>
    );
};


const AddPageButton = ({ onClick }: { onClick?: () => void }) => (
    <div className="w-full h-full flex items-center justify-center scrapbook-cover-bg">
        <Button
            variant="ghost"
            className="w-40 h-40 rounded-full border-2 border-dashed border-amber-800/50 text-amber-800/70 hover:border-amber-800 hover:text-amber-800 hover:bg-amber-800/10 flex flex-col gap-2"
            onClick={onClick}
        >
            <Icon name="Plus" className="h-10 w-10"/>
            <span className="font-semibold">Add Page</span>
        </Button>
    </div>
);


export const Page = React.forwardRef<HTMLDivElement, PageProps>(
  ({ children, number, isCover = false, coverType, isViewMode = true, onAddPage, isActiveForEditing, allEntries = [], onNavigateToDate = () => {}, ...props }, ref) => {
    
    const renderContent = () => {
        if (coverType === 'inside-cover-front') return <DiaryCoverMenu entries={allEntries} onNavigate={onNavigateToDate} />;
        if (coverType === 'inside-cover-back') return <AddPageButton onClick={onAddPage} />;
        return children;
    };
    
    return (
      <div
        ref={ref}
        className={cn(
          "overflow-hidden",
           isCover ? "page--cover" : "page--page",
          isActiveForEditing && !isCover && "ring-1 ring-inset ring-primary/50"
        )}
        data-density={isCover ? 'hard' : 'soft'} 
        {...props}
      >
        {renderContent()}
        
        {!isCover && number > 0 && (
          <div className={cn(
              "absolute bottom-2 text-xs text-muted-foreground/50",
              number % 2 === 0 ? "left-2" : "right-2"
            )}>
              {number}
          </div>
        )}
      </div>
    );
  }
);

Page.displayName = "Page";
