// src/features/learning/hooks/useShadowingSettings.ts

import { useState, useEffect, useCallback } from 'react';

interface ShadowingSettings {
  hideMode: 'block' | 'blur' | 'hidden';
  checkMode: 'strict' | 'gentle';
}

const SETTINGS_KEY = 'shadowing-settings';

const DEFAULT_SETTINGS: ShadowingSettings = {
  hideMode: 'block',
  checkMode: 'gentle',
};

/**
 * ✅ OPTIMIZED: Unified settings management
 * - Single localStorage key
 * - Single useEffect
 * - Type-safe
 */
export const useShadowingSettings = () => {
  const [settings, setSettings] = useState<ShadowingSettings>(() => {
    // Initialize from localStorage
    if (typeof window === 'undefined') return DEFAULT_SETTINGS;
    
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error('Failed to load settings', e);
    }
    
    return DEFAULT_SETTINGS;
  });

  // Auto-persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings', e);
    }
  }, [settings]);

  // Update individual setting
  const updateSetting = useCallback(<K extends keyof ShadowingSettings>(
    key: K,
    value: ShadowingSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  // Reset to defaults
  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return {
    settings,
    updateSetting,
    resetSettings,
    hideMode: settings.hideMode,
    checkMode: settings.checkMode,
    setHideMode: (mode: 'block' | 'blur' | 'hidden') => updateSetting('hideMode', mode),
    setCheckMode: (mode: 'strict' | 'gentle') => updateSetting('checkMode', mode),
  };
};