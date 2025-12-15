

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { UserPlan, SrsState, VocabularyItem, LibraryItem } from "./types";
import { LEARNING_THRESHOLD_DAYS, MASTERED_THRESHOLD_DAYS, POINT_THRESHOLDS, DAILY_DECAY_POINTS } from "./constants";
import { Timestamp } from "firebase/firestore";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getBcp47LangCode(shortCode: string | undefined): string | undefined {
  if (!shortCode) return undefined;
  if (shortCode.includes('-')) return shortCode;
  
  switch (shortCode.toLowerCase()) {
    case 'vi': return 'vi-VN';
    default: return shortCode;
  }
}

/**
 * Generates a unique client-side ID.
 * Uses the modern `crypto.randomUUID()` if available, otherwise falls back to a combination
 * of timestamp and random numbers for broader compatibility.
 * @returns A unique string identifier.
 */
export const generateLocalUniqueId = (): string => {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  // Fallback for older browsers or non-secure contexts
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 9);
  return `${timestamp}-${randomPart}`;
};


// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const removeUndefinedProps = (obj: any): any => {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(removeUndefinedProps).filter(v => v !== undefined);
  }

  const newObj: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined) {
      const value = removeUndefinedProps(obj[key]);
      if (value !== undefined) {
        newObj[key] = value;
      }
    }
  }
  return newObj;
};

export function capitalizeFirstLetter(string: string): string {
  if (!string) return string;
  return string.charAt(0).toUpperCase() + string.slice(1);
}

export const getFavoritesKey = (context: 'book' | 'piece'): string => `chirpter_favorites_${context}`;

export type LevelTier = 'silver' | 'green' | 'blue' | 'purple' | 'pink' | 'gold';

interface LevelStyles {
  frameClasses: string;
  badgeClasses: string;
  tier: LevelTier;
}

export function getLevelStyles(level: number, plan: UserPlan, overrideTier?: LevelTier): LevelStyles {
  let tier: LevelTier;

  if (overrideTier) {
      tier = overrideTier;
  } else if (level >= 121) tier = 'pink';
  else if (level >= 61) tier = 'purple';
  else if (level >= 31) tier = 'blue';
  else if (level >= 8) tier = 'green';
  else tier = 'silver';
  
  const commonFrameClasses = "p-0.5";
  const commonBadgeClasses = "border text-white";

  if (plan === 'pro') {
    return {
      tier,
      frameClasses: `${commonFrameClasses} bg-gradient-pro-${tier}`,
      badgeClasses: `${commonBadgeClasses} bg-gradient-pro-${tier} border-white/50`,
    };
  }

  return {
    tier,
    frameClasses: `${commonFrameClasses} bg-level-${tier}`,
    badgeClasses: `${commonBadgeClasses} bg-level-${tier} border-white/50`,
  };
}

export const calculateSrsProgress = (memStrength: number = 0, srsState: SrsState = 'new'): number => {
  let lowerBound = 0;
  let upperBound = 0;

  switch (srsState) {
    case 'new':
      lowerBound = POINT_THRESHOLDS.NEW;
      upperBound = POINT_THRESHOLDS.LEARNING;
      break;
    case 'learning':
      lowerBound = POINT_THRESHOLDS.LEARNING;
      upperBound = POINT_THRESHOLDS.SHORT_TERM;
      break;
    case 'short-term':
      lowerBound = POINT_THRESHOLDS.SHORT_TERM;
      upperBound = POINT_THRESHOLDS.LONG_TERM;
      break;
    case 'long-term':
      return 100;
  }
  
  const totalRange = upperBound - lowerBound;
  const progressInRange = memStrength - lowerBound;
  
  if (totalRange <= 0) return 0;

  const percentage = (progressInRange / totalRange) * 100;

  return Math.max(0, Math.min(percentage, 100));
};

export const getSrsColor = (state: SrsState | undefined) => {
  switch (state) {
    case 'learning':
      return 'bg-rose-500';
    case 'short-term':
      return 'bg-amber-500';
    case 'long-term':
      return 'bg-sky-500';
    case 'new':
    default:
      return 'bg-slate-400';
  }
};

export const calculateVirtualMS = (item: VocabularyItem, currentDate: Date): number => {
    let currentPoints = item.memoryStrength || 100;
    
    // No decay for mastered or new words
    if (item.srsState === 'long-term' || item.srsState === 'new' || !item.lastReviewed) {
        return currentPoints;
    }

    const today = new Date(currentDate);
    today.setUTCHours(0, 0, 0, 0);

    const lastReviewDate = new Date((item.lastReviewed as any).seconds ? 
        (item.lastReviewed as any).seconds * 1000 : item.lastReviewed);
    lastReviewDate.setUTCHours(0, 0, 0, 0);

    const elapsedDays = (today.getTime() - lastReviewDate.getTime()) / (1000 * 3600 * 24);
    
    // Start decay from the second day
    if (elapsedDays > 1) {
        // Calculate the number of full days that have passed since the day after the last review
        const decayDays = Math.floor(elapsedDays - 1);
        const totalDecay = decayDays * Math.abs(DAILY_DECAY_POINTS);
        currentPoints = Math.max(100, currentPoints - totalDecay);
    }
    
    return currentPoints;
};

/**
 * Deeply converts any Firestore Timestamp or Date objects in an object or array to ISO strings.
 * This is crucial for passing data from Server Components to Client Components.
 * @param obj - The object or array to process.
 * @returns A new object or array with all timestamps converted to strings.
 */
export function convertTimestamps<T>(obj: T): T {
    if (!obj || typeof obj !== 'object') {
        return obj;
    }

    if (obj instanceof Timestamp || obj instanceof Date) {
        return (obj as any).toDate().toISOString();
    }

    if (Array.isArray(obj)) {
        return obj.map(item => convertTimestamps(item)) as any;
    }

    const newObj: { [key: string]: any } = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            newObj[key] = convertTimestamps(obj[key]);
        }
    }
    
    return newObj as T;
}

export function getFormattedDate(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${'${year}'}-${'${month}'}-${'${day}'}`;
}
