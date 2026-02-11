# Phase B: Activation Modes - Implementation Plan

**Phase:** 9 (TDD Build)
**Features:** FEAT-003 (Push-to-talk), FEAT-004 (VAD), FEAT-005 (Toggle)
**Branch:** feature/FEAT-003-push-to-talk, feature/FEAT-004-vad, feature/FEAT-005-toggle
**Status:** planned
**Depends on:** Phase A complete

---

## Objective
Implement all three recording activation modes in the frontend, each with distinct UX patterns.

---

## FEAT-003: Push-to-Talk

### Design
- User holds configurable key (default: Space when focused on record area)
- keydown -> start recording
- keyup -> stop recording, begin transcription
- Visual: button pressed state, pulsing record indicator

### Sub-tasks
1. Keyboard event listener with configurable hotkey
2. State machine: IDLE -> RECORDING -> PROCESSING -> DISPLAY
3. Integration with useAudioCapture hook
4. Visual feedback component
5. FUT: Push-to-talk keyboard interaction test

---

## FEAT-004: Voice Activation (VAD)

### Design
- System listens to audio level via Web Audio API AnalyserNode
- When RMS exceeds threshold -> start recording
- When silence detected for configurable timeout -> stop recording
- Configurable: silence threshold, silence timeout

### Sub-tasks
1. Audio level monitoring via AnalyserNode
2. Silence detection with configurable threshold (default: 0.02 RMS)
3. Silence timeout (default: 1.5 seconds)
4. State machine: LISTENING -> RECORDING -> PROCESSING -> DISPLAY
5. Visual: always-on level meter, recording indicator
6. FUT: VAD detection test with simulated audio levels

---

## FEAT-005: Toggle Button

### Design
- Click button once -> start recording
- Click again -> stop recording, begin transcription
- Simplest activation mode

### Sub-tasks
1. Toggle button component with click handler
2. State machine: IDLE -> RECORDING -> PROCESSING -> DISPLAY
3. Keyboard shortcut (configurable, default: 'R')
4. Visual: clear idle/recording/processing states
5. FUT: Toggle button state transitions

---

## Integration

### useActivation Hook
Central hook managing all three modes:
```typescript
type ActivationMode = 'push-to-talk' | 'vad' | 'toggle';
interface UseActivationOptions {
  mode: ActivationMode;
  hotkey?: string;         // PTT key
  vadThreshold?: number;   // VAD sensitivity
  silenceTimeout?: number; // VAD silence ms
}
```

### Mode Selector Component
Dropdown/tabs to switch between modes in settings panel.

---

## Gate: Phase B Complete

- [ ] All three activation modes functional
- [ ] Each mode transitions correctly through state machine
- [ ] FUT screenshots for each mode
- [ ] Mode switching works without restart
