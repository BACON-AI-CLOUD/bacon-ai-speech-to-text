import { useState, useEffect, useCallback, useRef } from 'react';
import type { AppSettings, ActivationMode } from '../types/index.ts';
import { formatKeyName } from '../utils/keys.ts';
import './SettingsPanel.css';

interface SettingsPanelProps {
  settings: AppSettings;
  onUpdate: (updates: Partial<AppSettings>) => void;
  onReset: () => void;
  onExport?: () => void;
  onImport?: (file: File) => Promise<boolean>;
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

export function SettingsPanel({ settings, onUpdate, onReset, onExport, onImport }: SettingsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !onImport) return;

      const success = await onImport(file);
      setImportStatus(success ? 'success' : 'error');
      setTimeout(() => setImportStatus('idle'), 3000);

      // Reset file input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [onImport],
  );

  return (
    <div className="settings-panel">
      <button
        className="settings-panel__toggle"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
      >
        <span className="settings-panel__icon">{isOpen ? '\u25BC' : '\u25B6'}</span>
        Settings
      </button>

      {isOpen && (
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

          {/* Global Hotkey */}
          <div className="settings-group">
            <label className="settings-label">Global Hotkey</label>
            <div className="key-capture">
              <input
                className="settings-input"
                type="text"
                value={settings.globalHotkey}
                onChange={(e) => onUpdate({ globalHotkey: e.target.value })}
                placeholder="F2"
                style={{ width: '80px' }}
              />
            </div>
            <span className="settings-hint">
              Run <code>scripts/global-hotkey.ps1</code> (Windows) or <code>scripts/global-hotkey.sh</code> (Linux) to enable system-wide toggle.
            </span>
          </div>

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
      )}
    </div>
  );
}
