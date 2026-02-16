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

/** Validate that an object has at least one valid AppSettings key */
function isValidSettingsPartial(obj: unknown): obj is Partial<AppSettings> {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return false;
  const validKeys = Object.keys(DEFAULT_SETTINGS);
  const objKeys = Object.keys(obj);
  return objKeys.some((key) => validKeys.includes(key));
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

  const exportSettings = useCallback(() => {
    const json = JSON.stringify(settings, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bacon-voice-settings.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [settings]);

  const importSettings = useCallback(async (file: File): Promise<boolean> => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!isValidSettingsPartial(parsed)) {
        return false;
      }
      setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      return true;
    } catch {
      return false;
    }
  }, []);

  return { settings, updateSettings, resetSettings, exportSettings, importSettings };
}
