import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useActivation } from '../useActivation.ts';
import type { ActivationMode } from '../../types/index.ts';

interface ActivationProps {
  mode: ActivationMode;
  hotkey: string;
  onStart: () => void;
  onStop: () => void;
}

function fireKeyDown(code: string, options: Partial<KeyboardEventInit> = {}) {
  const event = new KeyboardEvent('keydown', {
    code,
    key: code,
    bubbles: true,
    cancelable: true,
    ...options,
  });
  window.dispatchEvent(event);
  return event;
}

function fireKeyUp(code: string, options: Partial<KeyboardEventInit> = {}) {
  const event = new KeyboardEvent('keyup', {
    code,
    key: code,
    bubbles: true,
    cancelable: true,
    ...options,
  });
  window.dispatchEvent(event);
  return event;
}

describe('useActivation', () => {
  const defaultOptions = {
    mode: 'push-to-talk' as const,
    hotkey: 'Space',
    onStart: vi.fn(),
    onStop: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // TUT-F003: Push-to-Talk mode
  // =========================================================================
  describe('PTT mode (FEAT-003)', () => {
    it('starts in idle state', () => {
      const { result } = renderHook(() =>
        useActivation({ ...defaultOptions, mode: 'push-to-talk' }),
      );
      expect(result.current.recordingState).toBe('idle');
    });

    it('transitions to recording on keydown of configured hotkey', () => {
      const onStart = vi.fn();
      const { result } = renderHook(() =>
        useActivation({ ...defaultOptions, mode: 'push-to-talk', hotkey: 'Space', onStart }),
      );

      act(() => {
        fireKeyDown('Space');
      });

      expect(result.current.recordingState).toBe('recording');
      expect(onStart).toHaveBeenCalledTimes(1);
    });

    it('transitions to processing on keyup after recording', () => {
      const onStop = vi.fn();
      const { result } = renderHook(() =>
        useActivation({ ...defaultOptions, mode: 'push-to-talk', hotkey: 'Space', onStop }),
      );

      act(() => {
        fireKeyDown('Space');
      });
      expect(result.current.recordingState).toBe('recording');

      act(() => {
        fireKeyUp('Space');
      });
      expect(result.current.recordingState).toBe('processing');
      expect(onStop).toHaveBeenCalledTimes(1);
    });

    it('uses configurable hotkey (e.g., KeyF)', () => {
      const onStart = vi.fn();
      const { result } = renderHook(() =>
        useActivation({ ...defaultOptions, mode: 'push-to-talk', hotkey: 'KeyF', onStart }),
      );

      // Space should NOT trigger recording for KeyF hotkey
      act(() => {
        fireKeyDown('Space');
      });
      expect(result.current.recordingState).toBe('idle');
      expect(onStart).not.toHaveBeenCalled();

      // KeyF should trigger
      act(() => {
        fireKeyDown('KeyF');
      });
      expect(result.current.recordingState).toBe('recording');
      expect(onStart).toHaveBeenCalledTimes(1);
    });

    it('ignores repeated keydown events', () => {
      const onStart = vi.fn();
      renderHook(() =>
        useActivation({ ...defaultOptions, mode: 'push-to-talk', hotkey: 'Space', onStart }),
      );

      act(() => {
        fireKeyDown('Space');
      });
      act(() => {
        fireKeyDown('Space', { repeat: true });
      });
      act(() => {
        fireKeyDown('Space', { repeat: true });
      });

      expect(onStart).toHaveBeenCalledTimes(1);
    });

    it('ignores keydown events from input fields', () => {
      const onStart = vi.fn();
      renderHook(() =>
        useActivation({ ...defaultOptions, mode: 'push-to-talk', hotkey: 'Space', onStart }),
      );

      // Create an input element and dispatch from it
      const input = document.createElement('input');
      document.body.appendChild(input);

      const event = new KeyboardEvent('keydown', {
        code: 'Space',
        key: 'Space',
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, 'target', { value: input });
      window.dispatchEvent(event);

      expect(onStart).not.toHaveBeenCalled();
      document.body.removeChild(input);
    });

    it('transitions processing -> idle via setRecordingState (no setTimeout)', () => {
      const { result } = renderHook(() =>
        useActivation({ ...defaultOptions, mode: 'push-to-talk', hotkey: 'Space' }),
      );

      // Start recording
      act(() => {
        fireKeyDown('Space');
      });
      expect(result.current.recordingState).toBe('recording');

      // Stop recording -> processing
      act(() => {
        fireKeyUp('Space');
      });
      expect(result.current.recordingState).toBe('processing');

      // External call to set idle (simulates result received)
      act(() => {
        result.current.setRecordingState('idle');
      });
      expect(result.current.recordingState).toBe('idle');
    });
  });

  // =========================================================================
  // TUT-F004: Toggle mode
  // =========================================================================
  describe('Toggle mode (FEAT-004/005)', () => {
    it('starts in idle state', () => {
      const { result } = renderHook(() =>
        useActivation({ ...defaultOptions, mode: 'toggle' }),
      );
      expect(result.current.recordingState).toBe('idle');
    });

    it('toggles to recording on first Space press', () => {
      const onStart = vi.fn();
      const { result } = renderHook(() =>
        useActivation({ ...defaultOptions, mode: 'toggle', onStart }),
      );

      act(() => {
        fireKeyDown('Space');
      });

      expect(result.current.recordingState).toBe('recording');
      expect(onStart).toHaveBeenCalledTimes(1);
    });

    it('toggles to processing on second Space press', () => {
      const onStop = vi.fn();
      const { result } = renderHook(() =>
        useActivation({ ...defaultOptions, mode: 'toggle', onStop }),
      );

      act(() => {
        fireKeyDown('Space');
      });
      expect(result.current.recordingState).toBe('recording');

      act(() => {
        fireKeyDown('Space');
      });
      expect(result.current.recordingState).toBe('processing');
      expect(onStop).toHaveBeenCalledTimes(1);
    });

    it('toggles via triggerStart/triggerStop (simulates button click)', () => {
      const onStart = vi.fn();
      const onStop = vi.fn();
      const { result } = renderHook(() =>
        useActivation({ ...defaultOptions, mode: 'toggle', onStart, onStop }),
      );

      act(() => {
        result.current.triggerStart();
      });
      expect(result.current.recordingState).toBe('recording');
      expect(onStart).toHaveBeenCalledTimes(1);

      act(() => {
        result.current.triggerStop();
      });
      expect(result.current.recordingState).toBe('processing');
      expect(onStop).toHaveBeenCalledTimes(1);
    });

    it('ignores Space in input fields', () => {
      const onStart = vi.fn();
      renderHook(() =>
        useActivation({ ...defaultOptions, mode: 'toggle', onStart }),
      );

      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);

      const event = new KeyboardEvent('keydown', {
        code: 'Space',
        key: ' ',
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, 'target', { value: textarea });
      window.dispatchEvent(event);

      expect(onStart).not.toHaveBeenCalled();
      document.body.removeChild(textarea);
    });
  });

  // =========================================================================
  // TUT-F005: VAD mode - unit behavior
  // =========================================================================
  describe('VAD mode (FEAT-004)', () => {
    it('starts in idle state', () => {
      const { result } = renderHook(() =>
        useActivation({ ...defaultOptions, mode: 'vad' }),
      );
      expect(result.current.recordingState).toBe('idle');
    });

    it('does not register keyboard listeners in VAD mode', () => {
      const onStart = vi.fn();
      renderHook(() =>
        useActivation({ ...defaultOptions, mode: 'vad', hotkey: 'Space', onStart }),
      );

      act(() => {
        fireKeyDown('Space');
      });

      expect(onStart).not.toHaveBeenCalled();
    });

    it('can be triggered externally via triggerStart/triggerStop', () => {
      const onStart = vi.fn();
      const onStop = vi.fn();
      const { result } = renderHook(() =>
        useActivation({ ...defaultOptions, mode: 'vad', onStart, onStop }),
      );

      // Simulate VAD detecting speech
      act(() => {
        result.current.triggerStart();
      });
      expect(result.current.recordingState).toBe('recording');
      expect(onStart).toHaveBeenCalledTimes(1);

      // Simulate VAD detecting silence
      act(() => {
        result.current.triggerStop();
      });
      expect(result.current.recordingState).toBe('processing');
      expect(onStop).toHaveBeenCalledTimes(1);
    });

    it('transitions processing -> idle via setRecordingState', () => {
      const { result } = renderHook(() =>
        useActivation({ ...defaultOptions, mode: 'vad' }),
      );

      // Trigger full cycle
      act(() => {
        result.current.triggerStart();
      });
      act(() => {
        result.current.triggerStop();
      });
      expect(result.current.recordingState).toBe('processing');

      act(() => {
        result.current.setRecordingState('idle');
      });
      expect(result.current.recordingState).toBe('idle');
    });
  });

  // =========================================================================
  // Mode switching tests
  // =========================================================================
  describe('Mode switching', () => {
    it('resets to idle when mode changes', () => {
      const { result, rerender } = renderHook(
        (props: ActivationProps) => useActivation(props),
        { initialProps: { ...defaultOptions, mode: 'toggle' as ActivationMode } },
      );

      // Start recording in toggle mode
      act(() => {
        result.current.triggerStart();
      });
      expect(result.current.recordingState).toBe('recording');

      // Switch to PTT mode
      rerender({ ...defaultOptions, mode: 'push-to-talk' as ActivationMode });
      expect(result.current.recordingState).toBe('idle');
    });

    it('resets to idle when switching from PTT to VAD', () => {
      const { result, rerender } = renderHook(
        (props: ActivationProps) => useActivation(props),
        { initialProps: { ...defaultOptions, mode: 'push-to-talk' as ActivationMode } },
      );

      act(() => {
        fireKeyDown('Space');
      });
      expect(result.current.recordingState).toBe('recording');

      rerender({ ...defaultOptions, mode: 'vad' as ActivationMode });
      expect(result.current.recordingState).toBe('idle');
    });

    it('PTT keys do not trigger in toggle mode', () => {
      const onStart = vi.fn();
      const { rerender } = renderHook(
        (props: ActivationProps) => useActivation(props),
        { initialProps: { ...defaultOptions, mode: 'push-to-talk' as ActivationMode, hotkey: 'KeyF', onStart } },
      );

      // Switch to toggle mode
      rerender({ ...defaultOptions, mode: 'toggle' as ActivationMode, hotkey: 'KeyF', onStart });

      // KeyF should not trigger in toggle mode (only Space)
      act(() => {
        fireKeyDown('KeyF');
      });
      expect(onStart).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Edge cases
  // =========================================================================
  describe('Edge cases', () => {
    it('triggerStart is a no-op if already recording', () => {
      const onStart = vi.fn();
      const { result } = renderHook(() =>
        useActivation({ ...defaultOptions, mode: 'toggle', onStart }),
      );

      act(() => {
        result.current.triggerStart();
      });
      act(() => {
        result.current.triggerStart();
      });

      expect(onStart).toHaveBeenCalledTimes(1);
      expect(result.current.recordingState).toBe('recording');
    });

    it('triggerStop is a no-op if not recording', () => {
      const onStop = vi.fn();
      const { result } = renderHook(() =>
        useActivation({ ...defaultOptions, mode: 'toggle', onStop }),
      );

      act(() => {
        result.current.triggerStop();
      });

      expect(onStop).not.toHaveBeenCalled();
      expect(result.current.recordingState).toBe('idle');
    });
  });
});
