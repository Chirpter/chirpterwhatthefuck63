// src/features/learning/utils/quotes.ts

/**
 * Utility functions to trigger Piggy Bank quotes from anywhere in the app
 * 
 * ⚠️ IMPORTANT: Piggy quotes are ONLY for discipline-related events!
 * Do NOT trigger from unrelated features like Whack-a-Mole or Focus Hatching.
 */

export enum PiggyQuoteTrigger {
    BET_SUCCESS = 'chirpter:bet-success',
    STREAK_COMPLETE = 'chirpter:streak-complete',
  }
  
  /**
   * Trigger Piggy quotes by dispatching a custom event
   * 
   * @param trigger - The event type to trigger
   * 
   * @example
   * // In DisciplineBetting.tsx after placing bet:
   * triggerPiggyQuotes(PiggyQuoteTrigger.BET_SUCCESS);
   * 
   * @example
   * // In DisciplineBetting.tsx after completing streak:
   * triggerPiggyQuotes(PiggyQuoteTrigger.STREAK_COMPLETE);
   */
  export const triggerPiggyQuotes = (trigger: PiggyQuoteTrigger) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(trigger));
    }
  };
  
  /**
   * Check if enough time has passed since last quote
   * 
   * @param cooldownMs - Cooldown period in milliseconds (default: 5 minutes)
   * @returns true if enough time has passed
   */
  export const canShowPiggyQuotes = (cooldownMs: number = 5 * 60 * 1000): boolean => {
    try {
      const lastQuoteTime = localStorage.getItem('chirpter_piggy_last_quote_time');
      if (!lastQuoteTime) return true;
      
      const now = Date.now();
      return now - parseInt(lastQuoteTime, 10) > cooldownMs;
    } catch {
      return true;
    }
  };