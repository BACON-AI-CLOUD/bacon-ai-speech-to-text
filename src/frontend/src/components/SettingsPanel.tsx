import { useState, useEffect, useCallback, useRef } from 'react';
import type { AppSettings, ActivationMode } from '../types/index.ts';
import { formatKeyName } from '../utils/keys.ts';
import { RefinerSettings } from './RefinerSettings.tsx';
import './SettingsPanel.css';

interface SettingsPanelProps {
  settings: AppSettings;
  onUpdate: (updates: Partial<AppSettings>) => void;
  onReset: () => void;
  onExport?: () => void;
  onImport?: (file: File) => Promise<boolean>;
  isOpen: boolean;
  onClose: () => void;
}

const MODELS = [
  { name: 'tiny', size: '39 MB', accuracy: 'Low' },
  { name: 'base', size: '74 MB', accuracy: 'Medium' },
  { name: 'small', size: '244 MB', accuracy: 'Good' },
  { name: 'medium', size: '769 MB', accuracy: 'High' },
  { name: 'large-v3', size: '1550 MB', accuracy: 'Best' },
];

const ACTIVATION_MODES: { value: ActivationMode; label: string }[] = [
  { value: 'toggle', label: 'Toggle (click/Space)' },
  { value: 'push-to-talk', label: 'Push-to-Talk (hold key)' },
  { value: 'vad', label: 'Voice Activity Detection (Phase B)' },
];

function KeyCaptureButton({
  currentKey,
  onCapture,
}: {
  currentKey: string;
  onCapture: (code: string) => void;
}) {
  const [listening, setListening] = useState(false);

  const handleClick = useCallback(() => {
    setListening(true);
  }, []);

  useEffect(() => {
    if (!listening) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.code === 'Escape') {
        setListening(false);
        return;
      }

      onCapture(e.code);
      setListening(false);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [listening, onCapture]);

  return (
    <div className="key-capture">
      <button
        className={`key-capture__button ${listening ? 'key-capture__button--listening' : ''}`}
        onClick={handleClick}
        type="button"
      >
        {listening ? 'Press a key...' : formatKeyName(currentKey)}
      </button>
      {currentKey !== 'Space' && (
        <button
          className="key-capture__reset"
          onClick={() => onCapture('Space')}
          type="button"
          title="Reset to default (Space)"
        >
          Reset
        </button>
      )}
    </div>
  );
}

function TargetWindowSelector({
  backendUrl,
  targetWindow,
  onUpdate,
}: {
  backendUrl: string;
  targetWindow: string;
  onUpdate: (val: string) => void;
}) {
  const [windows, setWindows] = useState<{ title: string; process: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchWindows = useCallback(async () => {
    setLoading(true);
    try {
      const httpUrl = backendUrl
        .replace('ws://', 'http://')
        .replace('wss://', 'https://');
      const res = await fetch(`${httpUrl}/windows`);
      if (res.ok) {
        const data = await res.json();
        setWindows(data.windows || []);
      }
    } catch {
      // Backend not reachable
    }
    setLoading(false);
  }, [backendUrl]);

  useEffect(() => {
    fetchWindows();
  }, [fetchWindows]);

  return (
    <div className="settings-group settings-group--indent">
      <label className="settings-label">Target Window</label>
      <div className="target-window-row">
        <select
          className="settings-select"
          value={windows.some((w) => w.title === targetWindow) ? targetWindow : '__custom__'}
          onChange={(e) => {
            if (e.target.value === '__none__') {
              onUpdate('');
            } else if (e.target.value !== '__custom__') {
              onUpdate(e.target.value);
            }
          }}
        >
          <option value="__none__">Last active window (Alt+Tab)</option>
          {windows.map((w) => (
            <option key={w.title} value={w.title}>
              {w.title.length > 60 ? w.title.slice(0, 57) + '...' : w.title}
            </option>
          ))}
          {targetWindow && !windows.some((w) => w.title === targetWindow) && (
            <option value="__custom__">Custom: {targetWindow}</option>
          )}
        </select>
        <button
          className="btn-icon"
          onClick={fetchWindows}
          title="Refresh window list"
          type="button"
          disabled={loading}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>
      </div>
      <input
        className="settings-input"
        type="text"
        value={targetWindow}
        onChange={(e) => onUpdate(e.target.value)}
        placeholder="Or type partial title (empty = Alt+Tab)"
      />
      <span className="settings-hint">Select a window or type a partial title match. Empty uses Alt+Tab to last active window.</span>
    </div>
  );
}

export function SettingsPanel({ settings, onUpdate, onReset, onExport, onImport, isOpen, onClose }: SettingsPanelProps) {
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !onImport) return;

      const success = await onImport(file);
      setImportStatus(success ? 'success' : 'error');
      setTimeout(() => setImportStatus('idle'), 3000);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [onImport],
  );

  if (!isOpen) return null;

  return (
    <>
      <div className="settings-overlay" onClick={onClose} />
      <div className="settings-panel">
        <div className="settings-panel__header">
          <h2 className="settings-panel__title">Settings</h2>
          <button className="settings-panel__close" onClick={onClose} title="Close settings">
            &times;
          </button>
        </div>

        <div className="settings-panel__content">
          {/* Activation Mode */}
          <div className="settings-group">
            <label className="settings-label">Activation Mode</label>
            <select
              className="settings-select"
              value={settings.activationMode}
              onChange={(e) =>
                onUpdate({ activationMode: e.target.value as ActivationMode })
              }
            >
              {ACTIVATION_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Hotkey (only for push-to-talk) */}
          {settings.activationMode === 'push-to-talk' && (
            <div className="settings-group">
              <label className="settings-label">Hotkey</label>
              <KeyCaptureButton
                currentKey={settings.hotkey}
                onCapture={(code) => onUpdate({ hotkey: code })}
              />
              <span className="settings-hint">Click the button, then press the desired key. Escape to cancel.</span>
            </div>
          )}

          {/* Backend URL */}
          <div className="settings-group">
            <label className="settings-label">Backend URL</label>
            <input
              className="settings-input"
              type="text"
              value={settings.backendUrl}
              onChange={(e) => onUpdate({ backendUrl: e.target.value })}
              placeholder="ws://localhost:8765"
            />
          </div>

          {/* Model Selector */}
          <div className="settings-group">
            <label className="settings-label">Whisper Model</label>
            <select
              className="settings-select"
              value={settings.selectedModel}
              onChange={(e) => onUpdate({ selectedModel: e.target.value })}
            >
              {MODELS.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name} ({m.size} - {m.accuracy})
                </option>
              ))}
            </select>
          </div>

          {/* VAD Threshold (only for vad mode) */}
          {settings.activationMode === 'vad' && (
            <div className="settings-group">
              <label className="settings-label">
                VAD Threshold: {settings.vadThreshold.toFixed(3)}
              </label>
              <input
                className="settings-range"
                type="range"
                min="0.001"
                max="0.1"
                step="0.001"
                value={settings.vadThreshold}
                onChange={(e) =>
                  onUpdate({ vadThreshold: parseFloat(e.target.value) })
                }
              />
            </div>
          )}

          {/* Silence Timeout */}
          <div className="settings-group">
            <label className="settings-label">
              Silence Timeout: {settings.silenceTimeout}ms
            </label>
            <input
              className="settings-range"
              type="range"
              min="500"
              max="5000"
              step="100"
              value={settings.silenceTimeout}
              onChange={(e) =>
                onUpdate({ silenceTimeout: parseInt(e.target.value, 10) })
              }
            />
          </div>

          {/* Countdown Beeps */}
          <div className="settings-group">
            <label className="settings-label">
              Countdown Beeps: {settings.countdownBeeps}
            </label>
            <input
              className="settings-range"
              type="range"
              min="0"
              max="5"
              step="1"
              value={settings.countdownBeeps}
              onChange={(e) =>
                onUpdate({ countdownBeeps: parseInt(e.target.value, 10) })
              }
            />
            <span className="settings-hint">0 = no countdown, mic activates immediately</span>
          </div>

          {/* Countdown Interval */}
          {settings.countdownBeeps > 0 && (
            <div className="settings-group">
              <label className="settings-label">
                Beep Interval: {settings.countdownIntervalMs}ms
              </label>
              <input
                className="settings-range"
                type="range"
                min="300"
                max="1500"
                step="100"
                value={settings.countdownIntervalMs}
                onChange={(e) =>
                  onUpdate({ countdownIntervalMs: parseInt(e.target.value, 10) })
                }
              />
            </div>
          )}

          {/* Beep Volume */}
          <div className="settings-group">
            <label className="settings-label">
              Beep Volume: {Math.round(settings.beepVolume * 100)}%
            </label>
            <input
              className="settings-range"
              type="range"
              min="0.05"
              max="1.0"
              step="0.05"
              value={settings.beepVolume}
              onChange={(e) =>
                onUpdate({ beepVolume: parseFloat(e.target.value) })
              }
            />
          </div>

          {/* Auto-copy toggle */}
          <div className="settings-group settings-group--inline">
            <label className="settings-label settings-label--toggle">
              <input
                type="checkbox"
                checked={settings.autoCopy}
                onChange={(e) => onUpdate({ autoCopy: e.target.checked })}
              />
              Auto-copy transcriptions
            </label>
          </div>

          {/* Type to keyboard toggle */}
          <div className="settings-group settings-group--inline">
            <label className="settings-label settings-label--toggle">
              <input
                type="checkbox"
                checked={settings.typeToKeyboard}
                onChange={(e) => onUpdate({ typeToKeyboard: e.target.checked })}
              />
              Type to keyboard
            </label>
          </div>

          {/* Auto-focus previous window (only when type-to-keyboard is on) */}
          {settings.typeToKeyboard && (
            <div className="settings-group settings-group--inline settings-group--indent">
              <label className="settings-label settings-label--toggle">
                <input
                  type="checkbox"
                  checked={settings.typingAutoFocus}
                  onChange={(e) => onUpdate({ typingAutoFocus: e.target.checked })}
                />
                Auto-focus previous window
              </label>
              <span className="settings-hint">Switches to the previous app (Alt+Tab) before typing</span>
            </div>
          )}

          {/* Target Window (only when type-to-keyboard is on) */}
          {settings.typeToKeyboard && (
            <TargetWindowSelector
              backendUrl={settings.backendUrl}
              targetWindow={settings.targetWindow}
              onUpdate={(val) => onUpdate({ targetWindow: val })}
            />
          )}

          {/* Notifications toggle */}
          <div className="settings-group settings-group--inline">
            <label className="settings-label settings-label--toggle">
              <input
                type="checkbox"
                checked={settings.notificationsEnabled}
                onChange={(e) => onUpdate({ notificationsEnabled: e.target.checked })}
              />
              Browser notifications
            </label>
          </div>

          {/* Text Refiner */}
          <RefinerSettings
            settings={settings}
            onUpdate={onUpdate}
            backendUrl={settings.backendUrl}
          />

          {/* Action Buttons */}
          <div className="settings-actions">
            {onExport && (
              <button className="btn btn--secondary" onClick={onExport}>
                Export Settings
              </button>
            )}
            {onImport && (
              <>
                <button
                  className="btn btn--secondary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Import Settings
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  style={{ display: 'none' }}
                  onChange={handleImport}
                />
              </>
            )}
            <button className="btn btn--secondary" onClick={onReset}>
              Reset to Defaults
            </button>
          </div>

          {importStatus === 'success' && (
            <div className="settings-feedback settings-feedback--success">
              Settings imported successfully.
            </div>
          )}
          {importStatus === 'error' && (
            <div className="settings-feedback settings-feedback--error">
              Failed to import settings. Invalid file format.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
