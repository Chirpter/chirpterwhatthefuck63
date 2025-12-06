
"use client";

import { useState, useEffect, useCallback } from 'react';

// This hook encapsulates the logic for managing the dark/light theme.
export const useTheme = () => {
    const [isDarkMode, setIsDarkMode] = useState(false);

    // On initial client-side mount, read the theme from the `html` element.
    // This avoids hydration mismatch errors.
    useEffect(() => {
        const isDark = document.documentElement.classList.contains('dark');
        setIsDarkMode(isDark);
    }, []);

    // Function to toggle the theme
    const toggleDarkMode = useCallback((checked: boolean) => {
        setIsDarkMode(checked);
        if (checked) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, []);

    return { isDarkMode, toggleDarkMode };
};
