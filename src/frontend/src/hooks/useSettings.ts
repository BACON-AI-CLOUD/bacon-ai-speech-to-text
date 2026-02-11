import { useState, useCallback, useEffect } from 'react';
import type { AppSettings } from '../types/index.ts';
import { DEFAULT_SETTINGS } from '../types/index.ts';

const STORAGE_KEY = 'bacon-voice-settings';

function loadSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<AppSettings>;
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch {
    // Corrupted data - fall back to defaults
  }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage full or unavailable - silently fail
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings({ ...DEFAULT_SETTINGS });
  }, []);

  return { settings, updateSettings, resetSettings };
}
