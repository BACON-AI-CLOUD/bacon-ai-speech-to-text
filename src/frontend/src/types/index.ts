export type ActivationMode = 'push-to-talk' | 'vad' | 'toggle';
export type RecordingState = 'idle' | 'recording' | 'processing';
export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface TranscriptionResult {
  text: string;
  confidence: number;
  language: string;
  duration: number;
  segments: TranscriptionSegment[];
  timestamp: number;
}

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
}

export interface WhisperModel {
  name: string;
  size_mb: number;
  loaded: boolean;
  accuracy_est: string;
}

export interface ServerStatus {
  status: string;
  gpu: {
    available: boolean;
    name: string;
    vram_gb: number;
  };
  current_model: string;
}

export interface AppSettings {
  activationMode: ActivationMode;
  hotkey: string;
  vadThreshold: number;
  silenceTimeout: number;
  selectedModel: string;
  integrationBackend: string;
  backendUrl: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  activationMode: 'toggle',
  hotkey: 'Space',
  vadThreshold: 0.02,
  silenceTimeout: 1500,
  selectedModel: 'base',
  integrationBackend: 'claude-api',
  backendUrl: 'ws://localhost:8765',
};

export interface WebSocketMessage {
  type: 'status' | 'result' | 'error' | 'control';
  payload: unknown;
}

export interface ControlMessage {
  action: 'start' | 'stop' | 'cancel';
  model?: string;
  language?: string;
}
