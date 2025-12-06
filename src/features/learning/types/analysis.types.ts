
// analysis.types.ts - CHỈ CHO AI ANALYSIS
export interface AnalyzeShadowingOutput {
    insight: string;
    encouragement?: string;
    suggestions?: string[];
  }
  
  export interface AnalyzeShadowingInput {
    originalText: string;
    userTranscript: string;
    errorTypes: string[];
    playCount: number;
    editCount: number;
  }
