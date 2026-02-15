import { useCallback, useRef, useEffect, useState } from 'react';
import { useSettings } from './hooks/useSettings.ts';
import { useWebSocket } from './hooks/useWebSocket.ts';
import { useAudioCapture } from './hooks/useAudioCapture.ts';
import { useActivation } from './hooks/useActivation.ts';
import { useVAD } from './hooks/useVAD.ts';
import { StatusBar } from './components/StatusBar.tsx';
import { AudioCapture } from './components/AudioCapture.tsx';
import { WaveformVisualizer } from './components/WaveformVisualizer.tsx';
import { TranscriptionDisplay } from './components/TranscriptionDisplay.tsx';
import { SettingsPanel } from './components/SettingsPanel.tsx';
import { ErrorDisplay } from './components/ErrorDisplay.tsx';
import { ModelProgress } from './components/ModelProgress.tsx';
import { playCountdownBeeps, playBeep, warmUpAudio } from './utils/beep.ts';
import type { ModelDownloadProgress } from './types/index.ts';
import './App.css';

function App() {
  const { settings, updateSettings, resetSettings, exportSettings, importSettings } = useSettings();
  // Warm up AudioContext on first user interaction so beeps work from WebSocket events
  useEffect(() => {
    const handler = () => {
      warmUpAudio();
      window.removeEventListener('click', handler);
      window.removeEventListener('keydown', handler);
    };
    window.addEventListener('click', handler, { once: true });
    window.addEventListener('keydown', handler, { once: true });
    return () => {
      window.removeEventListener('click', handler);
      window.removeEventListener('keydown', handler);
    };
  }, []);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [remoteTriggered, setRemoteTriggered] = useState(false);
  const [countdown, setCountdown] = useState(0); // 3,2,1,0 - 0 = not counting
  const [miniMode, setMiniMode] = useState(false);

  const {
    connectionState,
    sendAudio,
    sendControl,
    lastResult,
    lastError,
    serverStatus,
    reconnectAttempt,
    connect,
  } = useWebSocket({
    url: settings.backendUrl,
    autoConnect: true,
    onRemoteToggle: () => handleRemoteToggleRef.current(),
  });

  // Ref to avoid circular dependency between useWebSocket and handleRemoteToggle
  const handleRemoteToggleRef = useRef<() => void>(() => {});

  // Model download progress state
  const [modelProgress, setModelProgress] = useState<ModelDownloadProgress | null>(null);
  const modelPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll for model download progress when model changes
  useEffect(() => {
    let aborted = false;
    const backendHttp = settings.backendUrl
      .replace('ws://', 'http://')
      .replace('wss://', 'https://');

    // Immediate check: if model is already loaded, don't show progress
    const checkAndLoad = async () => {
      try {
        const res = await fetch(`${backendHttp}/models`);
        if (!res.ok || aborted) return;
        const data = await res.json();
        const model = data?.models?.find(
          (m: { name: string; loaded: boolean }) => m.name === settings.selectedModel,
        );
        if (aborted) return;
        if (model?.loaded) {
          setModelProgress(null);
          return; // Already loaded, nothing to do
        }
      } catch {
        // Backend not reachable - fall through to polling
      }

      if (aborted) return;

      // Model not loaded yet - trigger load and start polling
      setModelProgress({
        modelName: settings.selectedModel,
        percentage: 0,
        downloading: true,
      });

      fetch(`${backendHttp}/models/${settings.selectedModel}/load`, { method: 'POST' })
        .catch(() => { /* polling below handles progress */ });

      let attempts = 0;
      modelPollRef.current = setInterval(async () => {
        if (aborted) {
          if (modelPollRef.current) clearInterval(modelPollRef.current);
          return;
        }
        attempts++;
        try {
          const res = await fetch(`${backendHttp}/models`);
          if (res.ok && !aborted) {
            const data = await res.json();
            const model = data?.models?.find(
              (m: { name: string; loaded: boolean }) => m.name === settings.selectedModel,
            );
            if (model?.loaded) {
              setModelProgress(null);
              if (modelPollRef.current) clearInterval(modelPollRef.current);
            } else {
              setModelProgress((prev) =>
                prev
                  ? { ...prev, percentage: Math.min(95, attempts * 10) }
                  : null,
              );
            }
          }
        } catch {
          if (attempts > 15) {
            setModelProgress(null);
            if (modelPollRef.current) clearInterval(modelPollRef.current);
          }
        }
      }, 2000);
    };

    checkAndLoad();

    return () => {
      aborted = true;
      if (modelPollRef.current) clearInterval(modelPollRef.current);
    };
  }, [settings.selectedModel, settings.backendUrl]);

  // Use refs so activation callbacks always have latest functions
  const startRecordingRef = useRef<() => Promise<void>>(async () => {});
  const stopRecordingRef = useRef<() => void>(() => {});

  const handleRecordingStart = useCallback(() => {
    startRecordingRef.current();
    sendControl({ action: 'start', model: settings.selectedModel });
  }, [sendControl, settings.selectedModel]);

  const handleRecordingStop = useCallback(() => {
    stopRecordingRef.current();
    sendControl({ action: 'stop' });
    playBeep(settings.micOffBeepFreq, settings.beepDuration, settings.beepVolume);
  }, [sendControl, settings.micOffBeepFreq, settings.beepDuration, settings.beepVolume]);

  const {
    recordingState,
    setRecordingState,
    triggerStart,
    triggerStop,
  } = useActivation({
    mode: settings.activationMode,
    hotkey: settings.hotkey,
    onStart: handleRecordingStart,
    onStop: handleRecordingStop,
  });

  const { startRecording, stopRecording, audioStream, permissionState } =
    useAudioCapture({
      onAudioData: sendAudio,
      chunkInterval: 250,
    });

  // VAD integration: monitor audio stream when in VAD mode or remote-triggered
  const { audioLevel } = useVAD({
    audioStream,
    vadThreshold: settings.vadThreshold,
    silenceTimeout: settings.silenceTimeout,
    enabled: settings.activationMode === 'vad' || remoteTriggered,
    assumeSpeaking: remoteTriggered,
    onSpeechStart: triggerStart,
    onSpeechEnd: triggerStop,
  });

  // Keep refs in sync
  useEffect(() => {
    startRecordingRef.current = startRecording;
  }, [startRecording]);

  useEffect(() => {
    stopRecordingRef.current = stopRecording;
  }, [stopRecording]);

  // Transition processing -> idle when a transcription result arrives
  useEffect(() => {
    if (lastResult && recordingState === 'processing') {
      setRecordingState('idle');
    }
  }, [lastResult, recordingState, setRecordingState]);

  // For VAD mode, we need the audio stream to be active for monitoring.
  // Start recording (mic stream) when VAD mode is selected,
  // stop when leaving VAD mode.
  useEffect(() => {
    if (settings.activationMode === 'vad') {
      startRecordingRef.current();
    }
    // Cleanup on mode change away from VAD is handled by useVAD cleanup
  }, [settings.activationMode]);

  const handleToggle = useCallback(() => {
    if (recordingState === 'recording') {
      triggerStop();
    } else if (recordingState === 'idle') {
      triggerStart();
    }
  }, [recordingState, triggerStart, triggerStop]);

  // Remote toggle: countdown beeps then start recording with VAD auto-stop
  const countdownInProgressRef = useRef(false);
  const handleRemoteToggle = useCallback(async () => {
    if (recordingState === 'recording') {
      setRemoteTriggered(false);
      triggerStop();
    } else if (recordingState === 'idle' && !countdownInProgressRef.current) {
      countdownInProgressRef.current = true;
      await playCountdownBeeps(
        {
          count: settings.countdownBeeps,
          intervalMs: settings.countdownIntervalMs,
          freqStart: settings.beepFreqStart,
          freqEnd: settings.beepFreqEnd,
          duration: settings.beepDuration,
          volume: settings.beepVolume,
        },
        (n) => setCountdown(n),
      );
      setRemoteTriggered(true);
      triggerStart();
      countdownInProgressRef.current = false;
    }
  }, [recordingState, triggerStart, triggerStop, settings.countdownBeeps, settings.countdownIntervalMs, settings.beepFreqStart, settings.beepFreqEnd, settings.beepDuration, settings.beepVolume]);

  // Keep ref in sync for remote toggle
  useEffect(() => {
    handleRemoteToggleRef.current = handleRemoteToggle;
  }, [handleRemoteToggle]);

  // Reset remoteTriggered when recording stops
  useEffect(() => {
    if (recordingState === 'idle') {
      setRemoteTriggered(false);
    }
  }, [recordingState]);

  // Retry handler for error display
  const handleRetry = useCallback(() => {
    connect();
  }, [connect]);

  // Mini mode: compact widget with logo + mic button + countdown
  if (miniMode) {
    return (
      <div className="app app--mini">
        {countdown > 0 && (
          <div className="mini-countdown">{countdown}</div>
        )}

        <img src="/bacon-ai-logo-black.png" alt="BACON-AI" className="mini-logo" />

        <AudioCapture
          recordingState={recordingState}
          activationMode={settings.activationMode}
          onToggle={handleToggle}
          permissionState={permissionState}
          hotkey={settings.hotkey}
          audioLevel={audioLevel}
        />

        <button
          className="mini-expand-btn"
          onClick={() => setMiniMode(false)}
          title="Expand to full view"
          aria-label="Expand"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>

        <ErrorDisplay error={lastError} onRetry={handleRetry} />

        <SettingsPanel
          settings={settings}
          onUpdate={updateSettings}
          onReset={resetSettings}
          onExport={exportSettings}
          onImport={importSettings}
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-brand">
          <img src="/bacon-ai-logo-black.png" alt="B" className="app-logo" />
          <div className="app-brand-text">
            <h1 className="app-title">ACON-AI</h1>
            <span className="app-subtitle">SPEECH-TO-TEXT</span>
          </div>
        </div>
        <div className="app-header__right">
          <StatusBar
            connectionState={connectionState}
            serverStatus={serverStatus}
            reconnectAttempt={reconnectAttempt}
          />
          <button
            className="app-mini-btn"
            onClick={() => setMiniMode(true)}
            title="Collapse to mini mode"
            aria-label="Collapse to mini"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="4 14 10 14 10 20" />
              <polyline points="20 10 14 10 14 4" />
              <line x1="14" y1="10" x2="21" y2="3" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </button>
          <button
            className="app-settings-btn"
            onClick={() => setSettingsOpen((prev) => !prev)}
            title="Settings"
            aria-label="Toggle settings"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </header>

      {countdown > 0 && (
        <div className="countdown-overlay">
          <div className="countdown-number">{countdown}</div>
          <div className="countdown-label">Mic activating...</div>
        </div>
      )}

      <main className="app-main">
        <AudioCapture
          recordingState={recordingState}
          activationMode={settings.activationMode}
          onToggle={handleToggle}
          permissionState={permissionState}
          hotkey={settings.hotkey}
          audioLevel={audioLevel}
        />

        <WaveformVisualizer
          audioStream={audioStream}
          isRecording={recordingState === 'recording'}
        />

        <ModelProgress progress={modelProgress} />

        <TranscriptionDisplay
          lastResult={lastResult}
          notificationsEnabled={settings.notificationsEnabled}
          autoCopy={settings.autoCopy}
          typeToKeyboard={settings.typeToKeyboard}
          typingAutoFocus={settings.typingAutoFocus}
          targetWindow={settings.targetWindow}
          backendUrl={settings.backendUrl}
        />

        <SettingsPanel
          settings={settings}
          onUpdate={updateSettings}
          onReset={resetSettings}
          onExport={exportSettings}
          onImport={importSettings}
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        />
      </main>

      <ErrorDisplay error={lastError} onRetry={handleRetry} />

      <footer className="app-footer">
        <span>Powered by BACON-AI</span>
      </footer>
    </div>
  );
}

export default App;
