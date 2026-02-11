import { useCallback, useRef, useEffect } from 'react';
import { useSettings } from './hooks/useSettings.ts';
import { useWebSocket } from './hooks/useWebSocket.ts';
import { useAudioCapture } from './hooks/useAudioCapture.ts';
import { useActivation } from './hooks/useActivation.ts';
import { StatusBar } from './components/StatusBar.tsx';
import { AudioCapture } from './components/AudioCapture.tsx';
import { WaveformVisualizer } from './components/WaveformVisualizer.tsx';
import { TranscriptionDisplay } from './components/TranscriptionDisplay.tsx';
import { SettingsPanel } from './components/SettingsPanel.tsx';
import { ErrorDisplay } from './components/ErrorDisplay.tsx';
import './App.css';

function App() {
  const { settings, updateSettings, resetSettings } = useSettings();

  const {
    connectionState,
    sendAudio,
    sendControl,
    lastResult,
    lastError,
    serverStatus,
  } = useWebSocket({
    url: settings.backendUrl,
    autoConnect: true,
  });

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

  // Keep refs in sync
  useEffect(() => {
    startRecordingRef.current = startRecording;
  }, [startRecording]);

  useEffect(() => {
    stopRecordingRef.current = stopRecording;
  }, [stopRecording]);

  const handleToggle = useCallback(() => {
    if (recordingState === 'recording') {
      triggerStop();
    } else if (recordingState === 'idle') {
      triggerStart();
    }
  }, [recordingState, triggerStart, triggerStop]);

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">BACON-AI Voice</h1>
        <StatusBar connectionState={connectionState} serverStatus={serverStatus} />
      </header>

      <main className="app-main">
        <AudioCapture
          recordingState={recordingState}
          activationMode={settings.activationMode}
          onToggle={handleToggle}
          permissionState={permissionState}
        />

        <WaveformVisualizer
          audioStream={audioStream}
          isRecording={recordingState === 'recording'}
        />

        <TranscriptionDisplay lastResult={lastResult} />

        <SettingsPanel
          settings={settings}
          onUpdate={updateSettings}
          onReset={resetSettings}
        />
      </main>

      <ErrorDisplay error={lastError} />
    </div>
  );
}

export default App;
