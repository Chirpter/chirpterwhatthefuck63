
'use client';

import React, { useMemo } from 'react';
import { useAudioPlayer } from '@/contexts/audio-player-context';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icons';
import { motion } from "framer-motion";
import { CoverImage } from '@/features/library/components/CoverImage';
import type { Book, PlaylistItem as TPlaylistItem } from '@/lib/types';

export function CollapsedPlayer() {
    const { 
        currentPlayingItem, 
        playlist,
        isPlaying,
        isLoading,
        pauseAudio,
        resumeAudio,
        setPlayerState 
    } = useAudioPlayer();
    
    if (!currentPlayingItem) return null;

    const handlePlayPause = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent the main div's onClick from firing
        if (isPlaying) {
            pauseAudio();
        } else {
            resumeAudio();
        }
    };

    return (
        <motion.div
            className="fixed top-1/2 right-0 -translate-y-1/2 z-50 flex items-center group/lite"
            initial={{ x: 100 }}
            animate={{ x: 0 }}
            exit={{ x: 100 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            onClick={() => setPlayerState('expanded')}
        >
            <div 
                className="bg-card shadow-lg rounded-l-full h-10 pr-14 pl-4 flex items-center -mr-12 transition-all group-hover/lite:pr-16"
            >
                <p className="font-body font-semibold text-sm truncate max-w-[100px]">{currentPlayingItem.title}</p>
            </div>
            <div 
                className="relative h-16 w-16 rounded-full bg-card shadow-2xl border-4 border-card flex items-center justify-center transition-transform group-hover/lite:scale-105 cursor-pointer"
            >
                <div className="absolute inset-0 rounded-full overflow-hidden">
                    <CoverImage 
                        title={currentPlayingItem.title}
                        coverStatus={currentPlayingItem?.type === 'book' && currentPlayingItem.data ? (currentPlayingItem.data as Book).coverStatus : 'ready'}
                        cover={currentPlayingItem?.type === 'book' && currentPlayingItem.data ? (currentPlayingItem.data as Book).cover : undefined}
                        imageHint={currentPlayingItem?.type === 'book' && currentPlayingItem.data ? (currentPlayingItem.data as Book).imageHint : ''}
                        isRetrying={false}
                    />
                </div>
                <div className="absolute inset-0 bg-black/30 rounded-full opacity-0 group-hover/lite:opacity-100 transition-opacity flex items-center justify-center">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-10 w-10 text-white hover:bg-white/20"
                        onClick={handlePlayPause}
                    >
                        {isLoading ? (
                            <Icon name="Loader2" className="h-6 w-6 animate-spin" />
                        ) : isPlaying ? (
                            <Icon name="Pause" className="h-6 w-6" />
                        ) : (
                            <Icon name="Play" className="h-6 w-6" />
                        )}
                    </Button>
                </div>
            </div>
        </motion.div>
    );
}
