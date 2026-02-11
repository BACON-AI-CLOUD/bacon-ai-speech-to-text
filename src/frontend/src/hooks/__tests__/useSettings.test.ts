import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSettings } from '../useSettings.ts';
import { DEFAULT_SETTINGS } from '../../types/index.ts';

const STORAGE_KEY = 'bacon-voice-settings';

describe('useSettings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads default settings when no localStorage data exists', () => {
    const { result } = renderHook(() => useSettings());
    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('loads saved settings from localStorage', () => {
    const customSettings = {
      ...DEFAULT_SETTINGS,
      activationMode: 'push-to-talk' as const,
      selectedModel: 'large-v3',
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customSettings));

    const { result } = renderHook(() => useSettings());
    expect(result.current.settings.activationMode).toBe('push-to-talk');
    expect(result.current.settings.selectedModel).toBe('large-v3');
  });

  it('saves settings to localStorage on update', () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.updateSettings({ selectedModel: 'small' });
    });

    expect(result.current.settings.selectedModel).toBe('small');

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(stored.selectedModel).toBe('small');
  });

  it('merges partial updates without losing other settings', () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.updateSettings({ hotkey: 'KeyF' });
    });

    expect(result.current.settings.hotkey).toBe('KeyF');
    expect(result.current.settings.activationMode).toBe(DEFAULT_SETTINGS.activationMode);
    expect(result.current.settings.backendUrl).toBe(DEFAULT_SETTINGS.backendUrl);
  });

  it('resets to defaults', () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.updateSettings({ selectedModel: 'large-v3', hotkey: 'KeyR' });
    });

    act(() => {
      result.current.resetSettings();
    });

    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('handles corrupted localStorage data gracefully', () => {
    localStorage.setItem(STORAGE_KEY, 'not valid json{{{');

    const { result } = renderHook(() => useSettings());
    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
  });
});
