

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { UserPlan, SrsState, VocabularyItem, LibraryItem } from "./types";
import { LEARNING_THRESHOLD_DAYS, MASTERED_THRESHOLD_DAYS } from "./constants";
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

let idCounter = 0;

export const generateLocalUniqueId = (): string => {
  idCounter = (idCounter + 1) % Number.MAX_SAFE_INTEGER;
  return Date.now().toString(36) + idCounter.toString(36) + Math.random().toString(36).substring(2, 7);
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

export const getFavoritesKey = (context: 'book' | 'piece'): string => `chirpter_favorites_${'${context}'}`;

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
      frameClasses: `${'${commonFrameClasses}'} bg-gradient-pro-${'${tier}'}`,
      badgeClasses: `${'${commonBadgeClasses}'} bg-gradient-pro-${'${tier}'} border-white/50`,
    };
  }

  return {
    tier,
    frameClasses: `${'${commonFrameClasses}'} bg-level-${'${tier}'}`,
    badgeClasses: `${'${commonBadgeClasses}'} bg-level-${'${tier}'} border-white/50`,
  };
}

export const calculateSrsProgress = (memStrength: number = 0, srsState: SrsState = 'new'): number => {
  let lowerBound = 0;
  let upperBound = 0;

  switch (srsState) {
    case 'new':
      return 0;
    case 'learning':
      lowerBound = 0;
      upperBound = LEARNING_THRESHOLD_DAYS;
      break;
    case 'short-term':
      lowerBound = LEARNING_THRESHOLD_DAYS;
      upperBound = MASTERED_THRESHOLD_DAYS;
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

/**
 * Returns the current memory strength (now points) for an item.
 * For the new point-based system, there's no decay, so we just return the stored value.
 */
export const calculateVirtualMS = (item: VocabularyItem, currentDate: Date): number => {
    return item.memoryStrength || 0;
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


// REMOVED: retryOperation is temporarily disabled to make auth errors more direct.
/*
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      if (attempt === maxRetries) throw error;
      
      if (error.code?.includes('unavailable') || 
          error.code?.includes('deadline-exceeded') ||
          error.code?.includes('resource-exhausted') ||
          error.code?.includes('network-request-failed')) {
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Retry operation failed after all attempts.");
}
*/

export function getFormattedDate(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${'${year}'}-${'${month}'}-${'${day}'}`;
}
