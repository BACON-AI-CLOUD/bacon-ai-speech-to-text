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
import type { ModelDownloadProgress } from './types/index.ts';
import './App.css';

function App() {
  const { settings, updateSettings, resetSettings, exportSettings, importSettings } = useSettings();

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
    onRemoteToggle: () => handleToggleRef.current(),
  });

  // Ref to avoid circular dependency between useWebSocket and handleToggle
  const handleToggleRef = useRef<() => void>(() => {});

  // Model download progress state
  const [modelProgress, setModelProgress] = useState<ModelDownloadProgress | null>(null);
  const modelPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll for model download progress when model changes
  const prevModelRef = useRef('');
  useEffect(() => {
    if (settings.selectedModel !== prevModelRef.current) {
      prevModelRef.current = settings.selectedModel;
      setModelProgress({
        modelName: settings.selectedModel,
        percentage: 0,
        downloading: true,
      });

      // Trigger the actual model load on the backend, then poll for progress
      const backendHttp = settings.backendUrl
        .replace('ws://', 'http://')
        .replace('wss://', 'https://');

      fetch(`${backendHttp}/models/${settings.selectedModel}/load`, { method: 'POST' })
        .catch(() => { /* polling below handles progress */ });

      let attempts = 0;
      modelPollRef.current = setInterval(async () => {
        attempts++;
        try {
          const res = await fetch(`${backendHttp}/models`);
          if (res.ok) {
            const data = await res.json();
            const model = data?.models?.find(
              (m: { name: string; loaded: boolean }) => m.name === settings.selectedModel,
            );
            if (model?.loaded) {
              setModelProgress(null);
              if (modelPollRef.current) clearInterval(modelPollRef.current);
            } else {
              // Simulate progress based on poll attempts
              setModelProgress((prev) =>
                prev
                  ? { ...prev, percentage: Math.min(95, attempts * 10) }
                  : null,
              );
            }
          }
        } catch {
          // Backend not reachable - stop polling after a while
          if (attempts > 15) {
            setModelProgress(null);
            if (modelPollRef.current) clearInterval(modelPollRef.current);
          }
        }
      }, 2000);

      // Cleanup after 60s max
      setTimeout(() => {
        setModelProgress(null);
        if (modelPollRef.current) clearInterval(modelPollRef.current);
      }, 60000);
    }

    return () => {
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
  }, [sendControl]);

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

  // VAD integration: monitor audio stream when in VAD mode
  const { audioLevel } = useVAD({
    audioStream,
    vadThreshold: settings.vadThreshold,
    silenceTimeout: settings.silenceTimeout,
    enabled: settings.activationMode === 'vad',
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

  // Keep handleToggleRef in sync for remote toggle
  useEffect(() => {
    handleToggleRef.current = handleToggle;
  }, [handleToggle]);

  // Retry handler for error display
  const handleRetry = useCallback(() => {
    connect();
  }, [connect]);

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">BACON-AI Voice</h1>
        <StatusBar
          connectionState={connectionState}
          serverStatus={serverStatus}
          reconnectAttempt={reconnectAttempt}
        />
      </header>

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
          backendUrl={settings.backendUrl}
        />

        <SettingsPanel
          settings={settings}
          onUpdate={updateSettings}
          onReset={resetSettings}
          onExport={exportSettings}
          onImport={importSettings}
        />
      </main>

      <ErrorDisplay error={lastError} onRetry={handleRetry} />
    </div>
  );
}

export default App;
