
"use client";

import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';

const LOCALSTORAGE_SETTINGS_KEY = 'chirpter_user_settings_v1';

interface Settings {
  wordLookupEnabled: boolean;
  autoplayEnabled: boolean;
}

interface SettingsContextType extends Settings {
  setWordLookupEnabled: (enabled: boolean) => void;
  setAutoplayEnabled: (enabled: boolean) => void;
}

const defaultSettings: Settings = {
  wordLookupEnabled: true,
  autoplayEnabled: false, // Default to off
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load settings from localStorage on initial mount
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem(LOCALSTORAGE_SETTINGS_KEY);
      if (savedSettings) {
        // Merge saved settings with defaults to ensure all keys are present
        const parsedSettings = JSON.parse(savedSettings);
        setSettings(prev => ({ ...prev, ...parsedSettings }));
      }
    } catch (error) {
      console.error("Failed to load settings from localStorage:", error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(LOCALSTORAGE_SETTINGS_KEY, JSON.stringify(settings));
      } catch (error) {
        console.error("Failed to save settings to localStorage:", error);
      }
    }
  }, [settings, isLoaded]);

  const setWordLookupEnabled = useCallback((enabled: boolean) => {
    setSettings(s => ({ ...s, wordLookupEnabled: enabled }));
  }, []);
  
  const setAutoplayEnabled = useCallback((enabled: boolean) => {
    setSettings(s => ({ ...s, autoplayEnabled: enabled }));
  }, []);


  const value = {
    ...settings,
    setWordLookupEnabled,
    setAutoplayEnabled,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
