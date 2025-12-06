
"use client";

import React from 'react';
import { Icon, type IconName } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import type { SrsState } from '@/lib/types';
import { useTranslation } from 'react-i18next';

interface StageProps {
    icon: IconName;
    label: string;
    count: number;
    colorClasses: string;
    isSelected: boolean;
    onClick: () => void;
    iconClassName?: string;
}

const Stage: React.FC<StageProps> = ({ icon, label, count, colorClasses, isSelected, onClick, iconClassName }) => {
    const { t } = useTranslation('vocabularyPage');
    return (
        <button onClick={onClick} className="z-10 flex flex-col items-center text-center group w-24">
            <div className={cn(
                "h-20 w-20 rounded-full flex items-center justify-center bg-gradient-to-br text-white shadow-lg transition-all duration-300 group-hover:scale-110",
                colorClasses,
                isSelected && "ring-4 ring-offset-2 ring-primary ring-offset-background"
            )}>
                <Icon name={icon} className={cn("h-9 w-9", iconClassName)} />
            </div>
            <div className="mt-2 h-16 flex flex-col justify-start items-center">
                <p className="font-semibold font-headline leading-tight">{label}</p>
                <p className="text-sm text-muted-foreground">{t('folderCard.item', { count: count })}</p>
            </div>
        </button>
    );
};
interface SpacedRepetitionTrackerProps {
    counts: { [key in SrsState]: number };
    selectedState: SrsState;
    onStateSelect: (state: SrsState) => void;
}

export const SpacedRepetitionTracker: React.FC<SpacedRepetitionTrackerProps> = ({
    counts,
    selectedState,
    onStateSelect,
}) => {
    const { t } = useTranslation('vocabularyPage');
    const stages = [
        { state: 'new', icon: 'PackageOpen', labelKey: 'srsStates.new', color: "from-slate-400 to-slate-600 dark:from-slate-500 dark:to-slate-700" },
        { state: 'learning', icon: 'Clock', labelKey: 'srsStates.learning', color: "from-purple-500 to-indigo-600 dark:from-purple-600 dark:to-indigo-700" },
        { state: 'short-term', icon: 'BrainCircuit', labelKey: 'srsStates.shortTerm', color: "from-pink-500 to-rose-500 dark:from-pink-500 dark:to-rose-600" },
        { state: 'long-term', icon: 'BrainCircuit', labelKey: 'srsStates.longTerm', color: "from-orange-400 to-red-500 dark:from-orange-500 dark:to-red-600" }
    ] as const;

    return (
        <div>
            <h3 className="font-headline text-2xl mb-4">{t('learningProgress.title')}</h3>
            <div className="relative flex justify-between items-start">
                <div className="absolute top-10 left-0 w-full h-2 -translate-y-1/2 bg-gradient-to-r from-slate-300 via-purple-400 via-pink-400 to-orange-300 dark:from-slate-700 dark:via-purple-800 dark:via-pink-800 dark:to-orange-700 rounded-full" />
                
                {stages.map(stage => (
                    <Stage
                        key={stage.state}
                        icon={stage.icon}
                        label={t(stage.labelKey)}
                        count={counts[stage.state]}
                        colorClasses={stage.color}
                        isSelected={selectedState === stage.state}
                        onClick={() => onStateSelect(stage.state)}
                    />
                ))}
            </div>
        </div>
    );
};
