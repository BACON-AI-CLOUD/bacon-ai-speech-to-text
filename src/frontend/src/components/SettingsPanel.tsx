import { useState } from 'react';
import type { AppSettings, ActivationMode } from '../types/index.ts';
import './SettingsPanel.css';

interface SettingsPanelProps {
  settings: AppSettings;
  onUpdate: (updates: Partial<AppSettings>) => void;
  onReset: () => void;
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

export function SettingsPanel({ settings, onUpdate, onReset }: SettingsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

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
              <input
                className="settings-input"
                type="text"
                value={settings.hotkey}
                onChange={(e) => onUpdate({ hotkey: e.target.value })}
                placeholder="e.g. Space, KeyF"
              />
              <span className="settings-hint">Use KeyCode values (e.g. Space, KeyF, KeyR)</span>
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

          {/* Action Buttons */}
          <div className="settings-actions">
            <button className="btn btn--secondary" onClick={onReset}>
              Reset to Defaults
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
