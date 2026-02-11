import { useState, useCallback, useEffect, useRef } from 'react';
import type { ActivationMode, RecordingState } from '../types/index.ts';

interface UseActivationOptions {
  mode: ActivationMode;
  hotkey: string;
  onStart: () => void;
  onStop: () => void;
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
}: UseActivationOptions): UseActivationReturn {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const isActiveRef = useRef(false);

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
    // Transition back to idle after a short delay
    // (the actual transition from processing->idle happens when result arrives)
    setTimeout(() => {
      setRecordingState((prev) => (prev === 'processing' ? 'idle' : prev));
    }, 3000);
  }, [recordingState, onStop]);

  // Push-to-talk: key held = recording, key released = stop
  useEffect(() => {
    if (mode !== 'push-to-talk') return;

    const targetKey = hotkey.toLowerCase();

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore repeated keydown events (key held)
      if (e.repeat) return;
      // Ignore if typing in an input field
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.code.toLowerCase() === targetKey || e.key.toLowerCase() === targetKey) {
        e.preventDefault();
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

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (isActiveRef.current) {
          triggerStop();
        } else {
          triggerStart();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mode, triggerStart, triggerStop]);

  // VAD mode: placeholder for Phase B integration
  // VAD activation will be handled by @ricky0123/vad-web in a future phase

  return {
    recordingState,
    setRecordingState,
    triggerStart,
    triggerStop,
  };
}
