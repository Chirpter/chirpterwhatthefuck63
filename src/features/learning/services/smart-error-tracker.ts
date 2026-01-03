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
  
  // Error detection thresholds
  const ERROR_CONFIGS = {
    omission: {
      minOccurrences: 3,
      confidenceThreshold: 0.8,
      requiresContext: true,
    },
    substitution: {
      minOccurrences: 2,
      confidenceThreshold: 0.6,
      requiresContext: false,
    },
    insertion: {
      minOccurrences: 4,
      confidenceThreshold: 0.5,
      requiresContext: false,
    },
    morphology: {
      minOccurrences: 2,
      confidenceThreshold: 0.7,
      requiresContext: false,
    },
    spelling: {
      minOccurrences: 3,
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
  
  /**
   * SmartErrorTracker - Video-scoped error tracking with intelligent filtering
   * 
   * Design principles:
   * - Video-scoped (not session-based)
   * - Threshold-based filtering to reduce noise
   * - User feedback loop (dismiss/confirm)
   * - Behavior-aware difficulty scoring
   */
  export class SmartErrorTracker {
    private wordTracking: Map<string, WordTracking> = new Map();
    private videoId: string;
  
    constructor(videoId: string) {
      this.videoId = videoId;
      this.load();
    }
  
    /**
     * Main entry point: Track a submission with detected errors and behaviors
     */
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
  
        // Update occurrence count
        tracking.totalOccurrences++;
        tracking.lastSeen = now;
  
        // Add error instance
        const instance: ErrorInstance = {
          lineIndex: error.lineIndex,
          confidence: error.confidence,
          timestamp: now,
          context: error.context,
        };
        tracking.errorInstances.push(instance);
  
        // Update error breakdown
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
  
        // Accumulate behaviors
        tracking.totalReplays += behaviors.replayCount;
        tracking.totalReveals += behaviors.wasRevealed ? 1 : 0;
        tracking.totalTimeSpent += behaviors.timeSpent;
  
        // Recalculate difficulty score
        this.updateDifficultyScore(tracking);
        
        // Check if needs attention (based on thresholds)
        this.updateNeedsAttention(tracking);
      });
  
      this.save();
    }
  
    /**
     * Calculate difficulty score based on errors + behaviors
     * Formula: Σ(errorCount × severity × 10) + (avgReplays × 5) + (avgReveals × 10) + (avgTimeSpent × 2)
     * Capped at 100
     */
    private updateDifficultyScore(tracking: WordTracking): void {
      let score = 0;
  
      // Error contribution
      Object.entries(tracking.errorBreakdown).forEach(([type, breakdown]) => {
        const severity = ERROR_SEVERITY[type as keyof typeof ERROR_SEVERITY] || 1.0;
        score += breakdown.count * severity * 10;
      });
  
      // Behavior contribution (normalized by occurrences)
      const occurrences = Math.max(tracking.totalOccurrences, 1);
      const avgReplays = tracking.totalReplays / occurrences;
      const avgReveals = tracking.totalReveals / occurrences;
      const avgTimeSpent = tracking.totalTimeSpent / occurrences;
  
      score += avgReplays * 5;
      score += avgReveals * 10;
      score += avgTimeSpent * 2;
  
      tracking.difficultyScore = Math.min(Math.round(score), 100);
    }
  
    /**
     * Check if word needs attention based on error type thresholds
     */
    private updateNeedsAttention(tracking: WordTracking): void {
      if (tracking.dismissedByUser) {
        tracking.needsAttention = false;
        return;
      }
  
      if (tracking.confirmedByUser) {
        tracking.needsAttention = true;
        return;
      }
  
      // Check each error type against its threshold
      let needsAttention = false;
  
      for (const [errorType, breakdown] of Object.entries(tracking.errorBreakdown)) {
        const config = ERROR_CONFIGS[errorType as keyof typeof ERROR_CONFIGS];
        if (!config) continue;
  
        // Check minimum occurrences
        if (breakdown.count < config.minOccurrences) continue;
  
        // Check confidence threshold
        if (breakdown.avgConfidence < config.confidenceThreshold) continue;
  
        // Special case: omission requires context
        if (errorType === 'omission') {
          const omissionConfig = config as typeof ERROR_CONFIGS.omission;
          if (omissionConfig.requiresContext) {
            const hasContext = breakdown.instances.some(i => i.context);
            if (!hasContext) continue;
          }
        }
  
        // Special case: spelling similarity check
        if (errorType === 'spelling') {
          // Spelling detection is already handled by pattern-detection-helper
          // Trust the detection if it passes confidence threshold
        }
  
        needsAttention = true;
        break;
      }
  
      tracking.needsAttention = needsAttention;
    }
  
    /**
     * Get all words that need attention (for bubble panel)
     */
    getWordsNeedingAttention(): WordTracking[] {
      return Array.from(this.wordTracking.values())
        .filter(w => w.needsAttention && !w.dismissedByUser)
        .sort((a, b) => b.difficultyScore - a.difficultyScore);
    }
  
    /**
     * Get all tracked words (for statistics)
     */
    getAllStats(): WordTracking[] {
      return Array.from(this.wordTracking.values());
    }
  
    /**
     * User feedback: Dismiss word (false positive)
     */
    dismissWord(word: string): void {
      const tracking = this.wordTracking.get(word.toLowerCase());
      if (tracking) {
        tracking.dismissedByUser = true;
        tracking.needsAttention = false;
        this.save();
      }
    }
  
    /**
     * User feedback: Confirm word is difficult
     */
    confirmWord(word: string): void {
      const tracking = this.wordTracking.get(word.toLowerCase());
      if (tracking) {
        tracking.confirmedByUser = true;
        tracking.needsAttention = true;
        this.save();
      }
    }
  
    /**
     * Restore dismissed word
     */
    restoreWord(word: string): void {
      const tracking = this.wordTracking.get(word.toLowerCase());
      if (tracking) {
        tracking.dismissedByUser = false;
        this.updateNeedsAttention(tracking);
        this.save();
      }
    }
  
    /**
     * Persist to localStorage
     */
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
  
    /**
     * Load from localStorage
     */
    private load(): void {
      try {
        const saved = localStorage.getItem(`error-tracking-${this.videoId}`);
        if (!saved) return;
  
        const data = JSON.parse(saved) as [string, Omit<WordTracking, 'errorBreakdown'> & { errorBreakdown: any }][];
        
        // Reconstruct Map
        this.wordTracking = new Map(
          data.map(([word, tracking]) => [
            word,
            {
              ...tracking,
              // Ensure errorBreakdown is properly structured
              errorBreakdown: Object.fromEntries(
                Object.entries(tracking.errorBreakdown).map(([type, breakdown]: [string, any]) => [
                  type,
                  {
                    count: breakdown.count || 0,
                    avgConfidence: breakdown.avgConfidence || 0,
                    instances: breakdown.instances || [],
                  }
                ])
              ),
            }
          ])
        );
      } catch (e) {
        console.error('Failed to load error tracking:', e);
        this.wordTracking = new Map();
      }
    }
  
    /**
     * Clear all data for this video
     */
    clear(): void {
      this.wordTracking.clear();
      localStorage.removeItem(`error-tracking-${this.videoId}`);
    }
  }