

"use client";

import { Icon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface VocabularyFolderCardProps {
  folderName: string;
  itemCount: number;
  onClick?: () => void;
  onDirectPlay?: () => void;
  onPlaylistAdd?: () => void;
  isSelected: boolean;
  isPlaying?: boolean; // New prop
  isUncategorized?: boolean;
  className?: string; // Add className prop
}

export const VocabularyFolderCard: React.FC<VocabularyFolderCardProps> = ({
  folderName,
  itemCount,
  onClick,
  onDirectPlay,
  onPlaylistAdd,
  isSelected,
  isPlaying = false, // Default to false
  isUncategorized = false,
  className,
}) => {
  const { t } = useTranslation(['vocabularyPage', 'playlist', 'common']);
  
  const getIcon = () => {
    const iconContainerClasses = "relative h-7 w-7 text-primary/80 group-hover:text-primary transition-colors";
    const iconClasses = "h-full w-full"; 
    const numberClasses = "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[12px] font-bold text-primary/80 group-hover:text-primary transition-colors";

    if (isUncategorized) {
      return <Icon name="Inbox" className={cn(iconClasses, "text-primary/80 group-hover:text-primary transition-colors")} />;
    }

    return (
        <div className={iconContainerClasses}>
            <Icon name="Folder" className={iconClasses} />
            <span className={numberClasses}>{itemCount}</span>
        </div>
    );
  }

  const handleDirectPlayClick = (e: React.MouseEvent) => {
    if (onDirectPlay) {
        e.stopPropagation();
        onDirectPlay();
    }
  };

  const handlePlaylistClick = (e: React.MouseEvent) => {
    if (onPlaylistAdd) {
        e.stopPropagation();
        onPlaylistAdd();
    }
  };

  const displayName = isUncategorized ? t('common:unorganized') : folderName;
  
  const playButtonIcon = isPlaying ? 'Pause' : 'Play';
  const playButtonTooltip = isPlaying ? t('common:pause') : t('playAll');

  const PlayButton = () => (
    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDirectPlayClick}>
        <Icon name={playButtonIcon} className={cn("h-4 w-4", isPlaying && "text-primary")} />
    </Button>
  );

  const AddToPlaylistButton = () => (
    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePlaylistClick}>
        <Icon name="ListMusic" className="h-4 w-4" />
    </Button>
  );

  return (
    <TooltipProvider>
      <div
        onClick={onClick}
        className={cn(
          "h-14 w-52 flex-shrink-0 cursor-pointer group shadow-sm transition-all duration-300 relative font-semibold text-sm rounded-lg border flex items-center justify-between pl-2 pr-3",
          isSelected
            ? "bg-primary/10 border-primary ring-1 ring-primary"
            : "bg-card hover:bg-muted",
          className
        )}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          {getIcon()}
          <div className="flex flex-col text-left">
            <span className="truncate font-bold">{displayName}</span>
          </div>
        </div>
        
        <div className={cn(
          "absolute right-1 top-1/2 -translate-y-1/2 flex items-center bg-inherit rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200",
          isPlaying && "opacity-100"
        )}>
          <Tooltip>
            <TooltipTrigger asChild><PlayButton /></TooltipTrigger>
            <TooltipContent><p>{playButtonTooltip}</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild><AddToPlaylistButton /></TooltipTrigger>
            <TooltipContent><p>{t('playlist:addToPlaylist')}</p></TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
};
