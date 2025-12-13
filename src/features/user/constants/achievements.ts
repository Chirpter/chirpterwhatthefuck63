
import type { IconName } from "@/components/ui/icons";

export interface AchievementTier {
  level: number;
  goal: number; // The value of a user stat required to unlock
  creditReward: number;
  levelBonus?: { // Optional bonus credits for DAILY tasks based on user's level tier
    silver: number;
    green: number;
    blue: number;
    purple: number;
    pink: number;
  };
  proBonus?: number; // Specific, additional bonus for Pro users on daily tasks
}

export interface Achievement {
  id: string;
  category: 'daily' | 'other';
  nameKey: string;
  tierNameKey: string; // New key for dynamic tier names
  descriptionKey: string;
  icon: IconName;
  imageUrl: string; 
  statToTrack: 'booksCreated' | 'piecesCreated' | 'vocabSaved' | 'flashcardsMastered' | 'coversGeneratedByAI' | 'bilingualBooksCreated' | 'level' | 'vocabAddedToPlaylist';
  tiers: AchievementTier[];
  isAutoClaimed?: boolean;
}


export const ACHIEVEMENTS: Achievement[] = [
  // --- Daily Tasks ---
  {
    id: 'daily_login',
    category: 'daily',
    nameKey: 'daily_login.name',
    tierNameKey: 'daily_login.tierName',
    descriptionKey: 'daily_login.description',
    icon: 'Sparkles',
    imageUrl: 'https://res.cloudinary.com/dew8m8mas/image/upload/v1759248911/t12_z9t8bz.webp',
    statToTrack: 'level', // The user's current level determines the reward tier
    isAutoClaimed: true,
    tiers: [
      { 
        level: 1, // Only one level for daily tasks, the reward is dynamic
        goal: 1, // Requires at least level 1
        creditReward: 10, // Base reward
        levelBonus: { silver: 0, green: 2, blue: 4, purple: 6, pink: 8 },
      },
    ]
  },
  // --- Milestone Achievements ---
  {
    id: 'login_streak',
    category: 'other',
    nameKey: 'consistent_creator.name',
    tierNameKey: 'consistent_creator.tierName',
    descriptionKey: 'consistent_creator.description',
    icon: 'Calendar',
    imageUrl: 'https://res.cloudinary.com/dew8m8mas/image/upload/v1759248951/t15_nxuq3r.webp',
    statToTrack: 'level', // The user's level directly represents their streak
    tiers: [
      { level: 1, goal: 7, creditReward: 7 },
      { level: 2, goal: 30, creditReward: 30 },
      { level: 3, goal: 90, creditReward: 90 },
    ]
  },
  {
    id: 'create_books',
    category: 'other',
    nameKey: 'ai_author.name',
    tierNameKey: 'ai_author.tierName',
    descriptionKey: 'ai_author.description',
    icon: 'Book',
    imageUrl: 'https://res.cloudinary.com/dew8m8mas/image/upload/v1757312233/t4_e7ipak.webp',
    statToTrack: 'booksCreated',
    tiers: [
        { level: 1, goal: 10, creditReward: 1 },
        { level: 2, goal: 50, creditReward: 5 },
        { level: 3, goal: 100, creditReward: 10 },
    ]
  },
  {
    id: 'create_pieces',
    category: 'other',
    nameKey: 'piece_by_piece.name',
    tierNameKey: 'piece_by_piece.tierName',
    descriptionKey: 'piece_by_piece.description',
    icon: 'FileText',
    imageUrl: 'https://res.cloudinary.com/dew8m8mas/image/upload/v1757320346/unnamed_22_1_dmys8q.webp',
    statToTrack: 'piecesCreated',
    tiers: [
      { level: 1, goal: 10, creditReward: 1 },
      { level: 2, goal: 50, creditReward: 5 },
      { level: 3, goal: 100, creditReward: 10 },
    ]
  },
  {
    id: 'learn_vocab',
    category: 'other',
    nameKey: 'word_collector.name',
    tierNameKey: 'word_collector.tierName',
    descriptionKey: 'word_collector.description',
    icon: 'ListChecks',
    imageUrl: 'https://res.cloudinary.com/dew8m8mas/image/upload/v1757312233/t2_xoxuui.webp',
    statToTrack: 'vocabSaved',
    tiers: [{ level: 1, goal: 10, creditReward: 3 }]
  },
  {
    id: 'master_flashcards',
    category: 'other',
    nameKey: 'memory_constructor.name',
    tierNameKey: 'memory_constructor.tierName',
    descriptionKey: 'memory_constructor.description',
    icon: 'Brain',
    imageUrl: 'https://res.cloudinary.com/dew8m8mas/image/upload/v1757320346/unnamed_13_1_igbipr.webp',
    statToTrack: 'flashcardsMastered',
    tiers: [
      { level: 1, goal: 10, creditReward: 1 },
      { level: 2, goal: 50, creditReward: 5 },
      { level: 3, goal: 100, creditReward: 10 },
    ]
  },
  {
    id: 'add_vocab_to_playlist',
    category: 'other',
    nameKey: 'audio_learner.name',
    tierNameKey: 'audio_learner.tierName',
    descriptionKey: 'audio_learner.description',
    icon: 'ListMusic',
    imageUrl: 'https://res.cloudinary.com/dew8m8mas/image/upload/v1759248930/t11_sq7hyx.webp',
    statToTrack: 'vocabAddedToPlaylist',
    tiers: [{ level: 1, goal: 1, creditReward: 1 }]
  },
  {
    id: 'change_cover_ai',
    category: 'other',
    nameKey: 'ai_painter.name',
    tierNameKey: 'ai_painter.tierName',
    descriptionKey: 'ai_painter.description',
    icon: 'Wand2',
    imageUrl: 'https://res.cloudinary.com/dew8m8mas/image/upload/v1757320346/unnamed_10_1_nui1zh.webp',
    statToTrack: 'coversGeneratedByAI',
    tiers: [{ level: 1, goal: 1, creditReward: 1 }]
  },
  {
    id: 'create_bilingual_creations',
    category: 'other',
    nameKey: 'language_bridge.name',
    tierNameKey: 'language_bridge.tierName',
    descriptionKey: 'language_bridge.description',
    icon: 'Languages',
    imageUrl: 'https://res.cloudinary.com/dew8m8mas/image/upload/v1757320346/unnamed_17_1_rcafdn.webp',
    statToTrack: 'bilingualBooksCreated',
    tiers: [
      { level: 1, goal: 10, creditReward: 1 },
      { level: 2, goal: 50, creditReward: 5 },
      { level: 3, goal: 100, creditReward: 10 },
    ]
  },
];
