// src/features/learning/services/smart-error-tracker.ts

export interface ErrorInstance {
    lineIndex: number;
    confidence: number;
    timestamp: number;
    context?: string;
  }
  
  export interface ErrorBreakdown {
    count: number;
    avgConfidence: number;
    instances: ErrorInstance[];
  }
  
  export interface BehaviorData {
    replayCount: number;
    wasRevealed: boolean;
    timeSpent: number;
  }
  
  export interface WordTracking {
    word: string;
    totalOccurrences: number;
    errorInstances: ErrorInstance[];
    errorBreakdown: Record<string, ErrorBreakdown>;
    totalReplays: number;
    totalReveals: number;
    totalTimeSpent: number;
    difficultyScore: number;
    needsAttention: boolean;
    dismissedByUser: boolean;
    confirmedByUser: boolean;
    firstSeen: number;
    lastSeen: number;
  }
  
  export interface DetectedError {
    word: string;
    type: string;
    confidence: number;
    lineIndex: number;
    context?: string;
  }
  
  // ✅ RELAXED: More forgiving thresholds
  const ERROR_CONFIGS = {
    omission: {
      minOccurrences: 3,
      confidenceThreshold: 0.7, // Was 0.8
      requiresContext: true,
    },
    substitution: {
      minOccurrences: 2,
      confidenceThreshold: 0.5, // Was 0.6
      requiresContext: false,
    },
    insertion: {
      minOccurrences: 4,
      confidenceThreshold: 0.5,
      requiresContext: false,
    },
    morphology: {
      minOccurrences: 2,
      confidenceThreshold: 0.6, // Was 0.7
      requiresContext: false,
    },
    spelling: {
      minOccurrences: 2, // Was 3
      confidenceThreshold: 0.6,
      similarityRange: [0.7, 0.85],
    },
  } as const;
  
  const ERROR_SEVERITY = {
    omission: 1.5,
    substitution: 1.2,
    insertion: 0.8,
    morphology: 1.0,
    spelling: 1.0,
  } as const;
  
  export class SmartErrorTracker {
    private wordTracking: Map<string, WordTracking> = new Map();
    private videoId: string;
    private saveTimeout: NodeJS.Timeout | null = null;
  
    constructor(videoId: string) {
      this.videoId = videoId;
      this.load();
    }
  
    trackSubmission(errors: DetectedError[], behaviors: BehaviorData): void {
      const now = Date.now();
  
      errors.forEach(error => {
        const word = error.word.toLowerCase().trim();
        if (!word || word.match(/\s+/)) return;
  
        let tracking = this.wordTracking.get(word);
        
        if (!tracking) {
          tracking = {
            word,
            totalOccurrences: 0,
            errorInstances: [],
            errorBreakdown: {},
            totalReplays: 0,
            totalReveals: 0,
            totalTimeSpent: 0,
            difficultyScore: 0,
            needsAttention: false,
            dismissedByUser: false,
            confirmedByUser: false,
            firstSeen: now,
            lastSeen: now,
          };
          this.wordTracking.set(word, tracking);
        }
  
        tracking.totalOccurrences++;
        tracking.lastSeen = now;
  
        const instance: ErrorInstance = {
          lineIndex: error.lineIndex,
          confidence: error.confidence,
          timestamp: now,
          context: error.context,
        };
        tracking.errorInstances.push(instance);
  
        if (!tracking.errorBreakdown[error.type]) {
          tracking.errorBreakdown[error.type] = {
            count: 0,
            avgConfidence: 0,
            instances: [],
          };
        }
        
        const breakdown = tracking.errorBreakdown[error.type];
        breakdown.instances.push(instance);
        breakdown.count = breakdown.instances.length;
        breakdown.avgConfidence = 
          breakdown.instances.reduce((sum, i) => sum + i.confidence, 0) / breakdown.count;
  
        tracking.totalReplays += behaviors.replayCount;
        tracking.totalReveals += behaviors.wasRevealed ? 1 : 0;
        tracking.totalTimeSpent += behaviors.timeSpent;
  
        this.updateDifficultyScore(tracking);
        this.updateNeedsAttention(tracking);
      });
  
      this.scheduleSave();
    }
  
    // ✅ FIXED: Balanced difficulty formula
    private updateDifficultyScore(tracking: WordTracking): void {
      const occurrences = Math.max(tracking.totalOccurrences, 1);
      
      // 1. Error Score (0-40 points) - Diminishing returns
      let errorScore = 0;
      Object.entries(tracking.errorBreakdown).forEach(([type, breakdown]) => {
        const severity = ERROR_SEVERITY[type as keyof typeof ERROR_SEVERITY] || 1.0;
        errorScore += Math.sqrt(breakdown.count) * severity * 8;
      });
      errorScore = Math.min(errorScore, 40);
  
      // 2. Behavior Score (0-40 points)
      const avgReplays = tracking.totalReplays / occurrences;
      const avgReveals = tracking.totalReveals / occurrences;
      const avgTimeSpent = tracking.totalTimeSpent / occurrences;
      
      const behaviorScore = Math.min(
        (avgReplays * 10) +
        (avgReveals * 15) +
        Math.min(avgTimeSpent, 10),
        40
      );
  
      // 3. Confidence Score (0-20 points)
      const totalErrors = tracking.errorInstances.length;
      const avgConfidence = totalErrors > 0
        ? tracking.errorInstances.reduce((sum, e) => sum + e.confidence, 0) / totalErrors
        : 0;
      const confidenceScore = avgConfidence * 20;
  
      const totalScore = errorScore + behaviorScore + confidenceScore;
      tracking.difficultyScore = Math.min(Math.round(totalScore), 100);
    }
  
    // ✅ IMPROVED: More lenient attention logic
    private updateNeedsAttention(tracking: WordTracking): void {
      if (tracking.dismissedByUser) {
        tracking.needsAttention = false;
        return;
      }
  
      if (tracking.confirmedByUser) {
        tracking.needsAttention = true;
        return;
      }
  
      let needsAttention = false;
      let totalWeightedErrors = 0;
  
      for (const [errorType, breakdown] of Object.entries(tracking.errorBreakdown)) {
        const config = ERROR_CONFIGS[errorType as keyof typeof ERROR_CONFIGS];
        if (!config) continue;
  
        // Individual type check (80% of threshold)
        if (breakdown.count >= config.minOccurrences && 
            breakdown.avgConfidence >= config.confidenceThreshold * 0.8) {
          needsAttention = true;
          break;
        }
  
        // Aggregate weighted score
        const severity = ERROR_SEVERITY[errorType as keyof typeof ERROR_SEVERITY] || 1.0;
        totalWeightedErrors += breakdown.count * severity * breakdown.avgConfidence;
      }
  
      // Alternative: aggregate threshold
      if (!needsAttention && totalWeightedErrors >= 3.5) {
        needsAttention = true;
      }
  
      // Also consider difficulty score
      if (!needsAttention && tracking.difficultyScore >= 50) {
        needsAttention = true;
      }
  
      tracking.needsAttention = needsAttention;
    }
  
    getWordsNeedingAttention(): WordTracking[] {
      return Array.from(this.wordTracking.values())
        .filter(w => w.needsAttention && !w.dismissedByUser)
        .sort((a, b) => b.difficultyScore - a.difficultyScore);
    }
  
    getAllStats(): WordTracking[] {
      return Array.from(this.wordTracking.values());
    }
  
    dismissWord(word: string): void {
      const tracking = this.wordTracking.get(word.toLowerCase());
      if (tracking) {
        tracking.dismissedByUser = true;
        tracking.needsAttention = false;
        this.scheduleSave();
      }
    }
  
    confirmWord(word: string): void {
      const tracking = this.wordTracking.get(word.toLowerCase());
      if (tracking) {
        tracking.confirmedByUser = true;
        tracking.needsAttention = true;
        this.scheduleSave();
      }
    }
  
    restoreWord(word: string): void {
      const tracking = this.wordTracking.get(word.toLowerCase());
      if (tracking) {
        tracking.dismissedByUser = false;
        this.updateNeedsAttention(tracking);
        this.scheduleSave();
      }
    }
  
    // ✅ OPTIMIZED: Debounced save
    private scheduleSave(): void {
      if (this.saveTimeout) {
        clearTimeout(this.saveTimeout);
      }
      
      this.saveTimeout = setTimeout(() => {
        this.save();
        this.saveTimeout = null;
      }, 1000);
    }
  
    private save(): void {
      try {
        const data = Array.from(this.wordTracking.entries());
        localStorage.setItem(
          `error-tracking-${this.videoId}`,
          JSON.stringify(data)
        );
      } catch (e) {
        console.error('Failed to save error tracking:', e);
      }
    }
  
    private load(): void {
      try {
        const saved = localStorage.getItem(`error-tracking-${this.videoId}`);
        if (!saved) return;
  
        const data = JSON.parse(saved) as [string, WordTracking][];
        this.wordTracking = new Map(data);
      } catch (e) {
        console.error('Failed to load error tracking:', e);
        this.wordTracking = new Map();
      }
    }
  
    // ✅ NEW: Force save before unmount
    destroy(): void {
      if (this.saveTimeout) {
        clearTimeout(this.saveTimeout);
        this.save();
      }
    }
  
    clear(): void {
      this.wordTracking.clear();
      localStorage.removeItem(`error-tracking-${this.videoId}`);
    }
  }