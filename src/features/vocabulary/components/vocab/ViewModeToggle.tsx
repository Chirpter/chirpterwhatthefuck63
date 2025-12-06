
"use client";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

interface ViewModeToggleProps {
  viewMode: 'card' | 'table';
  setViewMode: (mode: 'card' | 'table') => void;
}

export const ViewModeToggle: React.FC<ViewModeToggleProps> = ({ viewMode, setViewMode }) => {
  return (
    <div className="flex items-center space-x-1 rounded-lg bg-muted p-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setViewMode('card')}
        className={cn(
          "px-3 py-1.5",
          viewMode === 'card'
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:bg-background/50 hover:text-foreground/80"
        )}
        aria-label="Card View"
      >
        <Icon name="LayoutDashboard" className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setViewMode('table')}
        className={cn(
          "px-3 py-1.5",
          viewMode === 'table'
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:bg-background/50 hover:text-foreground/80"
        )}
        aria-label="Table View"
      >
        <Icon name="ListChecks" className="h-4 w-4" />
      </Button>
    </div>
  );
};
