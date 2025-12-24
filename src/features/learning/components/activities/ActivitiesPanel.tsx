// src/features/learning/components/activities/ActivitiesPanel.tsx
"use client";

import React, { useState, Suspense, lazy, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icons';
import { AnimatePresence, motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { PiggyBankIcon } from './discipline/PiggyBankIcon';
import { Egg } from './focus/EggDesign';
import { MoleGameIcon } from './break/WhackAMoleGame';

interface Activity {
  id: 'focus' | 'discipline' | 'break';
  icon: IconName | React.FC<any>;
  titleKey: string;
}

const activities: Activity[] = [
  { id: 'focus', icon: Egg, titleKey: 'focusTitle' },
  { id: 'discipline', icon: PiggyBankIcon, titleKey: 'disciplineTitle' },
  { id: 'break', icon: MoleGameIcon, titleKey: 'breakTitle' },
];

const LazyDisciplineBetting = lazy(() => import('./discipline/DisciplineBetting'));
const LazyFocusHatching = lazy(() => import('./focus/FocusHatching'));
const LazyWhackAMoleGame = lazy(() => import('./break/WhackAMoleGame'));

// 🎯 PIGGY BANK QUOTES SYSTEM - Auto promotional quotes
const PIGGY_QUOTES = [
  "Chúng ta không cược tiền với thời gian, chúng ta cược cả đời mình",
  "Chỉ những người dám theo tới cuối mới vào",
  "Đây không phải là động lực, đây là luật chơi",
  "The winner takes it all",
  "Dám cược không?",
  "Beat yourself — or lose to yourself.",
];

const QUOTE_SESSION_KEY = 'chirpter_piggy_session';
const QUOTE_INTERVAL = 2 * 60 * 1000; // 2 minutes between quotes
const MAX_QUOTES_PER_SESSION = 3; // Max 3 quotes per session
const SESSION_DURATION = 4 * 60 * 60 * 1000; // 4 hours session

interface PiggyQuotesBubbleProps {
  quote: string;
  onComplete: () => void;
}

// 🎯 SIMPLIFIED PIGGY QUOTES BUBBLE - Easy to debug
const PiggyQuotesBubble: React.FC<PiggyQuotesBubbleProps> = ({ quote, onComplete }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Show for 5 seconds then hide
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => {
        onComplete();
      }, 300); // Wait for exit animation to finish
    }, 5000); // Extended to 5 seconds for easier testing

    return () => {
      clearTimeout(timer);
    };
  }, [quote, onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.9 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="absolute -top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
        >
          {/* Simple speech bubble */}
          <div className="relative bg-primary text-primary-foreground rounded-lg px-3 py-2 shadow-lg max-w-[200px]">
            <p className="text-xs font-medium text-center leading-tight">
              {quote}
            </p>
            {/* Triangle pointer */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-primary" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const ActivityCard = ({ 
  icon: IconComponent, 
  title, 
  onClick, 
  currentQuote, 
  onQuoteComplete 
}: { 
  icon: IconName | React.FC<any>; 
  title: string; 
  onClick: () => void;
  currentQuote: string | null;
  onQuoteComplete: () => void;
}) => (
  <div className="relative">
    {currentQuote && <PiggyQuotesBubble quote={currentQuote} onComplete={onQuoteComplete} />}
    
    <Button 
      variant="ghost" 
      className="flex flex-col items-center justify-center h-24 w-24 p-0 hover:scale-110 transition-transform" 
      onClick={onClick}
    >
      <div className="h-16 w-16 flex items-center justify-center">
        {typeof IconComponent === 'string' ? (
          <Icon name={IconComponent as IconName} className="h-14 w-14 text-primary" />
        ) : (
          <IconComponent className="h-14 w-14 text-primary" />
        )}
      </div>
      <p className="text-xs font-semibold text-muted-foreground">{title}</p>
    </Button>
  </div>
);

const FeatureLoader = () => (
    <div className="w-full grid grid-cols-3 items-center justify-items-center gap-4 min-h-[140px]">
        <div className="w-full space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-1/2" />
        </div>
        <Skeleton className="h-20 w-20 rounded-full" />
        <div className="w-full space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
        </div>
    </div>
);

const ErrorFallback = ({ error, resetError }: { error: Error; resetError: () => void }) => (
  <div className="w-full p-4 text-center">
    <p className="text-sm text-destructive mb-2">Something went wrong</p>
    <Button variant="outline" size="sm" onClick={resetError}>Try again</Button>
  </div>
);

class FeatureErrorBoundary extends React.Component<
  { children: React.ReactNode; onReset: () => void },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Activity feature error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          error={this.state.error!}
          resetError={() => {
            this.setState({ hasError: false, error: null });
            this.props.onReset();
          }}
        />
      );
    }

    return this.props.children;
  }
}

export const ActivitiesPanel: React.FC = () => {
  const { t } = useTranslation('learningPage');
  const [focusedActivity, setFocusedActivity] = useState<Activity | null>(null);
  const [currentQuote, setCurrentQuote] = useState<string | null>(null);

  const getRandomQuote = useCallback(() => {
    try {
      const sessionData = localStorage.getItem(QUOTE_SESSION_KEY);
      const now = Date.now();
      
      let session: { 
        startTime: number; 
        shownQuotes: number[]; 
        count: number;
        lastShownTime: number;
      };
      
      if (sessionData) {
        session = JSON.parse(sessionData);
        if (now - session.startTime > SESSION_DURATION) {
          session = { startTime: now, shownQuotes: [], count: 0, lastShownTime: 0 };
        }
      } else {
        session = { startTime: now, shownQuotes: [], count: 0, lastShownTime: 0 };
      }
      
      if (session.count >= MAX_QUOTES_PER_SESSION) return null;
      if (session.count > 0 && now - session.lastShownTime < QUOTE_INTERVAL) return null;
      
      const availableIndices = PIGGY_QUOTES
        .map((_, i) => i)
        .filter(i => !session.shownQuotes.includes(i));
      
      const pool = availableIndices.length > 0 ? availableIndices : PIGGY_QUOTES.map((_, i) => i);
      if (pool.length === 0) return null;

      const randomIndex = pool[Math.floor(Math.random() * pool.length)];
      
      session.shownQuotes.push(randomIndex);
      if (session.shownQuotes.length >= PIGGY_QUOTES.length) {
        session.shownQuotes = []; // Reset if all shown
      }
      session.count++;
      session.lastShownTime = now;
      localStorage.setItem(QUOTE_SESSION_KEY, JSON.stringify(session));
      
      return PIGGY_QUOTES[randomIndex];
    } catch (error) {
      console.error('Failed to get quote:', error);
      return null;
    }
  }, []);

  const triggerQuote = useCallback(() => {
    const quote = getRandomQuote();
    if (quote) {
      setCurrentQuote(quote);
    }
  }, [getRandomQuote]);

  // ✅ REFACTORED: This effect runs when the component mounts in the learning views.
  useEffect(() => {
    // Initial welcome quote
    const welcomeTimeout = setTimeout(() => {
      triggerQuote();
    }, 1000); // Show a quote 1 second after the component is visible.
    
    // Set up a recurring quote interval
    const quoteInterval = setInterval(() => {
      triggerQuote();
    }, QUOTE_INTERVAL); // Try to show a quote every 2 minutes.
    
    // Cleanup function to prevent memory leaks when the user navigates away
    return () => {
      clearTimeout(welcomeTimeout);
      clearInterval(quoteInterval);
    };
  }, [triggerQuote]);

  const handleFocus = (activity: Activity) => {
    setFocusedActivity(activity);
  };

  const handleBack = () => {
    setFocusedActivity(null);
  };
  
  let title = focusedActivity ? t(focusedActivity.titleKey) : t('vocabVideos.activitiesTitle');
  if (focusedActivity?.id === 'discipline') title = t('betTitle');
  if (focusedActivity?.id === 'focus') title = t('focus.title');
  if (focusedActivity?.id === 'break') title = t('break.title');

  const renderFocusedContent = () => {
    if (!focusedActivity) return null;
    
    switch (focusedActivity.id) {
        case 'discipline':
            return <LazyDisciplineBetting />;
        case 'focus':
            return <LazyFocusHatching />;
        case 'break':
            return <LazyWhackAMoleGame />;
        default:
            return null;
    }
  };

  return (
    <Card className="relative overflow-hidden after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-1/2 after:bg-gradient-to-t after:from-green-500/10 after:to-transparent dark:after:from-green-500/5">
      <div className="relative z-10">
          <CardHeader className="p-3 pb-0">
            <div className="flex items-center gap-2">
              {focusedActivity && (
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleBack}>
                  <Icon name="ChevronLeft" />
                </Button>
              )}
              <CardTitle className="font-headline text-lg">{title}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-3 flex items-center justify-around min-h-[140px]">
            <AnimatePresence mode="wait">
              {focusedActivity ? (
                <motion.div
                  key={focusedActivity.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="w-full"
                >
                  <FeatureErrorBoundary onReset={handleBack}>
                    <Suspense fallback={<FeatureLoader />}>
                      {renderFocusedContent()}
                    </Suspense>
                  </FeatureErrorBoundary>
                </motion.div>
              ) : (
                <motion.div
                  key="list"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex items-center justify-around w-full"
                >
                  {activities.map(act => (
                    <ActivityCard 
                        key={act.id} 
                        icon={act.icon} 
                        title={t(act.titleKey)} 
                        onClick={() => handleFocus(act)}
                        currentQuote={act.id === 'discipline' ? currentQuote : null}
                        onQuoteComplete={() => setCurrentQuote(null)}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
      </div>
    </Card>
  );
};
