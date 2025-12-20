

"use client";

import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icons';
import { Skeleton } from '@/components/ui/skeleton';
import type { IconName } from '@/components/ui/icons';

export const StatCard = ({ icon, label, value, isLoading }: { icon: IconName, label: string, value: number, isLoading: boolean }) => {
    // Value is now guaranteed to be a number from the ProfileView component
    return (
        <Card className="flex flex-col items-center justify-center p-4 text-center bg-muted/50">
            <Icon name={icon} className="h-8 w-8 text-primary mb-2" />
            {isLoading ? <Skeleton className="h-8 w-12 my-1" /> : <p className="text-headline-2">{value}</p>}
            <p className="text-body-sm">{label}</p>
        </Card>
    );
};
