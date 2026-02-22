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
  notificationsEnabled: boolean;
  autoCopy: boolean;
  typeToKeyboard: boolean;
  typingAutoFocus: boolean;
  countdownBeeps: number;         // Number of countdown beeps (0 = no countdown)
  countdownIntervalMs: number;    // Delay between beeps in ms
  beepFreqStart: number;          // First beep frequency (Hz)
  beepFreqEnd: number;            // Last beep frequency (Hz)
  beepDuration: number;           // Each beep duration in seconds
  beepVolume: number;             // Beep volume 0.0 - 1.0
  micOffBeepFreq: number;         // Mic-off beep frequency (Hz)
  targetWindow: string;           // Fixed window title to focus for typing (empty = Alt+Tab)
  typingFocusDelay: number;       // ms to wait after focusing window before typing
  typingFlashWindow: boolean;     // Flash the target window title bar as visual confirmation
  cursorPositionMode: boolean;
  refiner: RefinerConfig;
  discussMode: boolean;
  discussVoice: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  activationMode: 'toggle',
  hotkey: 'Space',
  vadThreshold: 0.02,
  silenceTimeout: 1500,
  selectedModel: 'base',
  integrationBackend: 'claude-api',
  backendUrl: `ws://localhost:${8700 + (__APP_VERSION__ ?? 0)}`,
  notificationsEnabled: false,
  autoCopy: false,
  typeToKeyboard: false,
  typingAutoFocus: true,
  countdownBeeps: 3,
  countdownIntervalMs: 700,
  beepFreqStart: 520,
  beepFreqEnd: 780,
  beepDuration: 0.18,
  beepVolume: 0.4,
  micOffBeepFreq: 440,
  targetWindow: '',
  typingFocusDelay: 500,
  typingFlashWindow: true,
  cursorPositionMode: false,
  refiner: {
    enabled: false,
    provider: 'ollama',
    model: '',
    promptTemplate: 'cleanup',
    customPrompt: '',
  },
  discussMode: false,
  discussVoice: 'en-GB-SoniaNeural',
};

export type BuiltinPromptTemplate = 'cleanup' | 'nudge' | 'governance' | 'professional' | 'email' | 'whatsapp' | 'technical' | 'personal' | 'sheets-tsv' | 'sheets-script' | 'custom';
export type PromptTemplate = BuiltinPromptTemplate | string;  // string allows user-saved templates

export interface UserPromptTemplate {
  label: string;
  description: string;
  prompt: string;
}

export interface RefinerConfig {
  enabled: boolean;
  provider: 'claude-cli' | 'anthropic' | 'openai' | 'groq' | 'ollama' | 'gemini';
  model: string;           // selected model ID (empty = provider default)
  promptTemplate: PromptTemplate;  // selected prompt template
  customPrompt: string;    // active prompt content (template or user-edited)
  // NOTE: API keys stored backend-side in .env file only
}

export interface ProviderInfo {
  id: string;
  name: string;
  requires_api_key: boolean;
  configured: boolean;
}

export interface ModelInfo {
  id: string;
  name: string;
}

export interface RefinerResult {
  raw_text: string;
  refined_text: string;
  provider: string;
  model: string;
  processing_time_ms: number;
  tokens_used: number;
  warning?: string;
}

export interface DiscussResult {
  question: string;
  answer: string;
  audio_url: string;
  provider: string;
  model: string;
  latency_ms: number;
}

export type ErrorCategory = 'connection' | 'permission' | 'transcription' | 'unknown';

export interface ModelDownloadProgress {
  modelName: string;
  percentage: number;
  downloading: boolean;
}

export interface WebSocketMessage {
  type: 'status' | 'result' | 'error' | 'control';
  payload: unknown;
}

export interface ControlMessage {
  action: 'start' | 'stop' | 'cancel';
  model?: string;
  language?: string;
}
