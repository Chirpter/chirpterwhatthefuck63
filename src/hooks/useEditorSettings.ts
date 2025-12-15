
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { EditorSettings } from '@/lib/types';

const LOCALSTORAGE_KEY = 'chirpter_editor_settings_v1';

const defaultEditorSettings: EditorSettings = {
  textAlign: 'text-justify',
  verticalAlign: 'justify-start',
  background: 'bg-background/95',
  fontSize: 'base',
};

// Helper function to get all settings from localStorage
const getAllStoredSettings = (): Record<string, EditorSettings> => {
    try {
        const storedValue = localStorage.getItem(LOCALSTORAGE_KEY);
        return storedValue ? JSON.parse(storedValue) : {};
    } catch (error) {
        console.error("Failed to parse editor settings from localStorage", error);
        return {};
    }
};

// Helper function to save all settings to localStorage
const saveAllStoredSettings = (allSettings: Record<string, EditorSettings>) => {
    try {
        localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(allSettings));
    } catch (error) {
        console.error("Failed to save editor settings to localStorage", error);
    }
};

export const useEditorSettings = (itemId: string | null): [EditorSettings, (updates: Partial<EditorSettings>) => void] => {
    const [settings, setSettings] = useState<EditorSettings>(defaultEditorSettings);

    useEffect(() => {
        if (itemId) {
            const allSettings = getAllStoredSettings();
            setSettings(allSettings[itemId] || defaultEditorSettings);
        } else {
            // When no item is selected (like in the creation preview), use defaults.
            setSettings(defaultEditorSettings);
        }
    }, [itemId]);

    const updateSettings = useCallback((updates: Partial<EditorSettings>) => {
        if (itemId) {
            // Use a function form of setSettings to ensure we have the latest state
            setSettings(currentSettings => {
                const newSettings = { ...currentSettings, ...updates };
                const allSettings = getAllStoredSettings();
                allSettings[itemId] = newSettings;
                saveAllStoredSettings(allSettings);
                return newSettings;
            });
        }
    }, [itemId]);

    return [settings, updateSettings];
};
