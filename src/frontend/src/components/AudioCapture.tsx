import type { RecordingState, ActivationMode } from '../types/index.ts';
import './AudioCapture.css';

interface AudioCaptureProps {
  recordingState: RecordingState;
  activationMode: ActivationMode;
  onToggle: () => void;
  permissionState: string;
}

function stateLabel(state: RecordingState): string {
  switch (state) {
    case 'idle':
      return 'Ready';
    case 'recording':
      return 'Recording...';
    case 'processing':
      return 'Processing...';
  }
}

function modeHint(mode: ActivationMode): string {
  switch (mode) {
    case 'toggle':
      return 'Click or press Space to toggle';
    case 'push-to-talk':
      return 'Hold key to record';
    case 'vad':
      return 'Voice activity detection (Phase B)';
  }
}

export function AudioCapture({
  recordingState,
  activationMode,
  onToggle,
  permissionState,
}: AudioCaptureProps) {
  const isRecording = recordingState === 'recording';
  const isProcessing = recordingState === 'processing';

  return (
    <div className="audio-capture">
      <button
        className={`mic-button mic-button--${recordingState}`}
        onClick={onToggle}
        disabled={isProcessing || permissionState === 'denied'}
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
      >
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
      </button>

      <div className={`recording-state recording-state--${recordingState}`}>
        {stateLabel(recordingState)}
      </div>

      <div className="mode-hint">{modeHint(activationMode)}</div>

      {permissionState === 'denied' && (
        <div className="permission-warning">
          Microphone access denied. Please enable it in browser settings.
        </div>
      )}
    </div>
  );
}
