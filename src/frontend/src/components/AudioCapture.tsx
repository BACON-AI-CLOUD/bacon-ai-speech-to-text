import type { RecordingState, ActivationMode } from '../types/index.ts';
import { formatKeyName } from '../utils/keys.ts';
import './AudioCapture.css';

interface AudioCaptureProps {
  recordingState: RecordingState;
  activationMode: ActivationMode;
  onToggle: () => void;
  permissionState: string;
  hotkey?: string;
  audioLevel?: number;
}

function stateLabel(state: RecordingState, mode: ActivationMode): string {
  switch (state) {
    case 'idle':
      return mode === 'vad' ? 'Listening...' : 'Ready';
    case 'recording':
      return 'Recording...';
    case 'processing':
      return 'Processing...';
  }
}

function modeHint(mode: ActivationMode, hotkey: string): string {
  switch (mode) {
    case 'toggle':
      return 'Click or press Space to start/stop';
    case 'push-to-talk':
      return `Hold ${formatKeyName(hotkey)} to record`;
    case 'vad':
      return 'Automatic voice detection active';
  }
}

export function AudioCapture({
  recordingState,
  activationMode,
  onToggle,
  permissionState,
  hotkey = 'Space',
  audioLevel = 0,
}: AudioCaptureProps) {
  const isRecording = recordingState === 'recording';
  const isProcessing = recordingState === 'processing';
  const isVAD = activationMode === 'vad';

  // Clamp audio level for visual display (0-100%)
  const levelPercent = Math.min(100, Math.round(audioLevel * 500));

  return (
    <div className="audio-capture">
      <div className="mic-button-container">
        <button
          className={`mic-button mic-button--${recordingState} ${isVAD ? 'mic-button--vad' : ''}`}
          onClick={onToggle}
          disabled={isProcessing || permissionState === 'denied' || isVAD}
          aria-label={isRecording ? 'Stop recording' : 'Start recording'}
        >
          {isProcessing ? (
            <div className="processing-spinner" aria-label="Processing" />
          ) : (
            <svg
              className="mic-icon"
              viewBox="0 0 24 24"
              width="48"
              height="48"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          )}
        </button>

        {isVAD && (
          <div
            className="vad-level-ring"
            style={{
              opacity: levelPercent > 5 ? 1 : 0.3,
              transform: `scale(${1 + levelPercent / 200})`,
            }}
          />
        )}
      </div>

      <div className={`recording-state recording-state--${recordingState}`}>
        {stateLabel(recordingState, activationMode)}
      </div>

      {isVAD && (
        <div className="vad-level-bar-container">
          <div className="vad-level-bar" style={{ width: `${levelPercent}%` }} />
          <span className="vad-level-label">Level</span>
        </div>
      )}

      <div className="mode-hint">{modeHint(activationMode, hotkey)}</div>

      {permissionState === 'denied' && (
        <div className="permission-warning">
          Microphone access denied. Please enable it in browser settings.
        </div>
      )}
    </div>
  );
}
