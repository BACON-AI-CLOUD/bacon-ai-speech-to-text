import { useState, useCallback, useEffect, useRef } from 'react';
import type { ActivationMode, RecordingState } from '../types/index.ts';

interface UseActivationOptions {
  mode: ActivationMode;
  hotkey: string;
  onStart: () => void;
  onStop: () => void;
  onBeforeStart?: () => Promise<void>;
}

interface UseActivationReturn {
  recordingState: RecordingState;
  setRecordingState: (state: RecordingState) => void;
  triggerStart: () => void;
  triggerStop: () => void;
}

export function useActivation({
  mode,
  hotkey,
  onStart,
  onStop,
  onBeforeStart,
}: UseActivationOptions): UseActivationReturn {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const isActiveRef = useRef(false);
  const onBeforeStartRef = useRef(onBeforeStart);
  useEffect(() => { onBeforeStartRef.current = onBeforeStart; }, [onBeforeStart]);

  // Reset state when mode changes
  useEffect(() => {
    setRecordingState('idle');
    isActiveRef.current = false;
  }, [mode]);

  const triggerStart = useCallback(() => {
    if (recordingState === 'recording') return;
    isActiveRef.current = true;
    setRecordingState('recording');
    onStart();
  }, [recordingState, onStart]);

  const triggerStop = useCallback(() => {
    if (recordingState !== 'recording') return;
    isActiveRef.current = false;
    setRecordingState('processing');
    onStop();
    // No setTimeout fallback: processing->idle transition is driven by
    // setRecordingState('idle') called from App.tsx when a result arrives
  }, [recordingState, onStop]);

  // Push-to-talk: key held = recording, key released = stop
  useEffect(() => {
    if (mode !== 'push-to-talk') return;

    const targetKey = hotkey.toLowerCase();

    const handleKeyDown = async (e: KeyboardEvent) => {
      // Ignore repeated keydown events (key held)
      if (e.repeat) return;
      // Ignore if typing in an input field
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.code.toLowerCase() === targetKey || e.key.toLowerCase() === targetKey) {
        e.preventDefault();
        if (onBeforeStartRef.current) await onBeforeStartRef.current();
        triggerStart();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.code.toLowerCase() === targetKey || e.key.toLowerCase() === targetKey) {
        e.preventDefault();
        if (isActiveRef.current) {
          triggerStop();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [mode, hotkey, triggerStart, triggerStop]);

  // Toggle mode: Space or click toggles recording on/off
  useEffect(() => {
    if (mode !== 'toggle') return;

    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.repeat) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (isActiveRef.current) {
          triggerStop();
        } else {
          if (onBeforeStartRef.current) await onBeforeStartRef.current();
          triggerStart();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mode, triggerStart, triggerStop]);

  // VAD mode: triggerStart/triggerStop are called externally by useVAD via App.tsx
  // No keyboard listeners needed for VAD mode.

  return {
    recordingState,
    setRecordingState,
    triggerStart,
    triggerStop,
  };
}
