// src/features/diary/components/PlantObject.tsx

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import type { DiaryObject, PlantObjectData, GrowthStage } from '@/features/diary/types';

interface PlantObjectProps {
  object: DiaryObject;
  onUpdate: (id: string, updates: Partial<DiaryObject>) => void;
  isInteractive: boolean;
}

const WATERING_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// SVG components for different plant stages
const Seed: React.FC = () => (
    <motion.svg width="100%" height="100%" viewBox="0 0 100 100" initial={{ scale: 0, y: 20 }} animate={{ scale: 1, y: 0 }} transition={{ duration: 0.5, type: 'spring' }}>
        <path d="M50 85 C 40 75, 40 65, 50 60 S 60 75, 50 85 Z" fill="#8B5A2B" />
        <motion.path d="M50 60 C 50 50, 55 45, 52 40" stroke="#65A30D" strokeWidth="4" fill="none" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.5, duration: 0.8 }} />
    </motion.svg>
);

const Sapling: React.FC = () => (
    <motion.svg width="100%" height="100%" viewBox="0 0 100 100" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <path d="M50 85 C 45 75, 45 65, 50 60 S 55 75, 50 85 Z" fill="#8B5A2B" />
        <motion.path d="M50 60 C 45 40, 60 20, 50 10" stroke="#65A30D" strokeWidth="5" fill="none" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1 }} />
        <motion.circle cx="38" cy="35" r="8" fill="#84CC16" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.8, duration: 0.5 }} />
        <motion.circle cx="62" cy="25" r="10" fill="#84CC16" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1, duration: 0.5 }} />
    </motion.svg>
);

const Mature: React.FC = () => (
    <motion.svg width="100%" height="100%" viewBox="0 0 100 100" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <motion.path d="M50 90 L 50 50" stroke="#8B5A2B" strokeWidth="8" strokeLinecap="round" initial={{ scaleY: 0, originY: 'bottom' }} animate={{ scaleY: 1 }} transition={{ duration: 0.8 }} />
        <motion.g initial="hidden" animate="visible" transition={{ staggerChildren: 0.3, delayChildren: 0.5 }}>
            <motion.path d="M50 70 C 30 70, 30 50, 40 45" stroke="#8B5A2B" strokeWidth="5" fill="none" variants={{ hidden: { pathLength: 0 }, visible: { pathLength: 1 } }} />
            <motion.path d="M50 60 C 70 60, 70 40, 60 35" stroke="#8B5A2B" strokeWidth="5" fill="none" variants={{ hidden: { pathLength: 0 }, visible: { pathLength: 1 } }} />
        </motion.g>
        <motion.g initial="hidden" animate="visible" transition={{ staggerChildren: 0.2, delayChildren: 1 }}>
            <motion.circle cx="30" cy="25" r="15" fill="#4D7C0F" variants={{ hidden: { scale: 0 }, visible: { scale: 1 } }} />
            <motion.circle cx="70" cy="20" r="20" fill="#65A30D" variants={{ hidden: { scale: 0 }, visible: { scale: 1 } }} />
            <motion.circle cx="50" cy="35" r="18" fill="#84CC16" variants={{ hidden: { scale: 0 }, visible: { scale: 1 } }} />
        </motion.g>
    </motion.svg>
);

const Withered: React.FC = () => (
    <motion.svg width="100%" height="100%" viewBox="0 0 100 100" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <path d="M50 90 L 50 50" stroke="#A16207" strokeWidth="6" strokeLinecap="round" />
        <path d="M50 70 C 30 70, 30 50, 40 45" stroke="#A16207" strokeWidth="4" fill="none" />
        <path d="M50 60 C 70 60, 70 40, 60 35" stroke="#A16207" strokeWidth="4" fill="none" />
        <circle cx="30" cy="25" r="12" fill="#FACC15" opacity="0.6" />
        <circle cx="70" cy="20" r="15" fill="#FDE047" opacity="0.6" />
        <circle cx="50" cy="35" r="14" fill="#FEF08A" opacity="0.6" />
    </motion.svg>
);

export const PlantObject: React.FC<PlantObjectProps> = ({ object, onUpdate, isInteractive }) => {
    const [plantData, setPlantData] = useState<PlantObjectData>(
        object.content as PlantObjectData || { growthStage: 'seed', lastWatered: Date.now() }
    );
    const [isThirsty, setIsThirsty] = useState(false);

    useEffect(() => {
        const checkThirst = () => {
            if (plantData.growthStage === 'mature') {
                setIsThirsty(false);
                return;
            }
            const timeSinceWatered = Date.now() - plantData.lastWatered;
            if (timeSinceWatered > WATERING_INTERVAL) {
                // If it's been thirsty for another interval, it withers
                if (timeSinceWatered > WATERING_INTERVAL * 2) {
                     setPlantData(prev => ({ ...prev, growthStage: 'withered' }));
                } else {
                    setIsThirsty(true);
                }
            } else {
                setIsThirsty(false);
            }
        };

        const interval = setInterval(checkThirst, 60000); // Check every minute
        checkThirst(); // Initial check
        return () => clearInterval(interval);
    }, [plantData.lastWatered, plantData.growthStage]);

    const handleWaterPlant = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isInteractive) return;

        let nextStage: GrowthStage = plantData.growthStage;
        if (plantData.growthStage === 'seed') nextStage = 'sapling';
        else if (plantData.growthStage === 'sapling') nextStage = 'mature';
        else if (plantData.growthStage === 'withered') nextStage = 'sapling'; // Revives to sapling

        const updatedData: PlantObjectData = {
            growthStage: nextStage,
            lastWatered: Date.now(),
        };
        
        setPlantData(updatedData);
        onUpdate(object.id, { content: updatedData });

    }, [plantData, object.id, onUpdate, isInteractive]);

    const renderPlantStage = () => {
        switch (plantData.growthStage) {
            case 'seed': return <Seed />;
            case 'sapling': return <Sapling />;
            case 'mature': return <Mature />;
            case 'withered': return <Withered />;
            default: return <Seed />;
        }
    };

    return (
        <div 
            className="w-full h-full flex items-center justify-center relative group/plant"
            onClick={handleWaterPlant}
        >
            {renderPlantStage()}

            {isThirsty && plantData.growthStage !== 'mature' && (
                <motion.div 
                    className="absolute -top-1 -right-1 z-10"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                >
                    <Icon name="Snowflake" className="h-5 w-5 text-blue-400 animate-pulse" />
                </motion.div>
            )}

            {isInteractive && plantData.growthStage !== 'mature' && (
                <div className="absolute inset-0 bg-black/20 rounded-full opacity-0 group-hover/plant:opacity-100 transition-opacity flex items-center justify-center">
                    <Icon name="Plus" className="h-8 w-8 text-white" />
                </div>
            )}
        </div>
    );
};
