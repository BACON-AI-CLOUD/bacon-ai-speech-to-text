import { useState, useCallback } from 'react';
import type { AppSettings } from '../types/index.ts';
import './RefinerSettings.css';

interface RefinerSettingsProps {
  settings: AppSettings;
  onUpdate: (updates: Partial<AppSettings>) => void;
  backendUrl: string;
}

interface TestResult {
  raw: string;
  refined: string;
  latency: number;
  provider: string;
  error?: string;
}

function getHttpUrl(wsUrl: string): string {
  return wsUrl.replace('ws://', 'http://').replace('wss://', 'https://');
}

export function RefinerSettings({ settings, onUpdate, backendUrl }: RefinerSettingsProps) {
  const [collapsed, setCollapsed] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [ollamaHost, setOllamaHost] = useState('http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState('llama3.2');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [promptExpanded, setPromptExpanded] = useState(false);

  const httpUrl = getHttpUrl(backendUrl);
  const { refiner } = settings;

  const updateRefiner = useCallback(
    (updates: Partial<AppSettings['refiner']>) => {
      onUpdate({ refiner: { ...refiner, ...updates } });
    },
    [refiner, onUpdate],
  );

  const handleSaveBackendConfig = useCallback(async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        enabled: refiner.enabled,
        active_provider: refiner.provider,
      };
      const providerConfigs: Record<string, Record<string, string>> = {};
      if (refiner.provider === 'groq' && apiKey) {
        providerConfigs.groq = { api_key: apiKey };
      }
      if (refiner.provider === 'gemini' && apiKey) {
        providerConfigs.gemini = { api_key: apiKey };
      }
      if (refiner.provider === 'ollama') {
        providerConfigs.ollama = { base_url: ollamaHost + '/api/chat', model: ollamaModel };
      }
      if (Object.keys(providerConfigs).length > 0) {
        body.provider_configs = providerConfigs;
      }
      if (refiner.customPrompt) {
        body.custom_prompt = refiner.customPrompt;
      }
      await fetch(`${httpUrl}/refiner/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      // Backend not reachable
    }
    setSaving(false);
  }, [httpUrl, refiner.provider, refiner.customPrompt, apiKey, ollamaHost, ollamaModel]);

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${httpUrl}/refiner/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'This is a test transcription to verify the refiner is working properly.' }),
      });
      if (res.ok) {
        const data = await res.json();
        setTestResult({
          raw: data.original,
          refined: data.refined_text,
          latency: data.processing_time_ms,
          provider: data.provider,
        });
      } else {
        const errData = await res.json().catch(() => ({ detail: 'Unknown error' }));
        setTestResult({
          raw: 'Test text',
          refined: '',
          latency: 0,
          provider: refiner.provider,
          error: errData.detail || 'Refiner test failed',
        });
      }
    } catch {
      setTestResult({
        raw: 'Test text',
        refined: '',
        latency: 0,
        provider: refiner.provider,
        error: 'Could not reach backend',
      });
    }
    setTesting(false);
  }, [httpUrl, refiner.provider]);

  return (
    <div className="refiner-settings">
      <button
        className="refiner-settings__toggle"
        onClick={() => setCollapsed((prev) => !prev)}
        type="button"
        aria-expanded={!collapsed}
      >
        <span className="refiner-settings__toggle-icon">
          {collapsed ? '\u25B6' : '\u25BC'}
        </span>
        Text Refiner (LLM Post-Processing)
      </button>

      {!collapsed && (
        <div className="refiner-settings__body">
          {/* Enable/Disable */}
          <div className="settings-group settings-group--inline">
            <label className="settings-label settings-label--toggle">
              <input
                type="checkbox"
                checked={refiner.enabled}
                onChange={(e) => updateRefiner({ enabled: e.target.checked })}
              />
              Enable text refinement
            </label>
          </div>

          {/* Provider */}
          <div className="settings-group">
            <label className="settings-label">Provider</label>
            <select
              className="settings-select"
              value={refiner.provider}
              onChange={(e) =>
                updateRefiner({ provider: e.target.value as 'groq' | 'ollama' | 'gemini' })
              }
            >
              <option value="ollama">Ollama (Local)</option>
              <option value="groq">Groq (Cloud)</option>
              <option value="gemini">Gemini (Cloud)</option>
            </select>
          </div>

          {/* API Key for cloud providers */}
          {(refiner.provider === 'groq' || refiner.provider === 'gemini') && (
            <div className="settings-group">
              <label className="settings-label">
                {refiner.provider === 'groq' ? 'Groq' : 'Gemini'} API Key
              </label>
              <input
                className="settings-input"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter API key (stored backend-side only)"
              />
              <span className="settings-hint">Key is sent to backend config.json, never stored in browser.</span>
            </div>
          )}

          {/* Ollama settings */}
          {refiner.provider === 'ollama' && (
            <>
              <div className="settings-group">
                <label className="settings-label">Ollama Host URL</label>
                <input
                  className="settings-input"
                  type="text"
                  value={ollamaHost}
                  onChange={(e) => setOllamaHost(e.target.value)}
                  placeholder="http://localhost:11434"
                />
              </div>
              <div className="settings-group">
                <label className="settings-label">Ollama Model</label>
                <input
                  className="settings-input"
                  type="text"
                  value={ollamaModel}
                  onChange={(e) => setOllamaModel(e.target.value)}
                  placeholder="llama3.2"
                />
              </div>
            </>
          )}

          {/* Custom Prompt */}
          <div className="settings-group">
            <button
              className="refiner-settings__prompt-toggle"
              onClick={() => setPromptExpanded((prev) => !prev)}
              type="button"
            >
              {promptExpanded ? '\u25BC' : '\u25B6'} Custom Prompt
            </button>
            {promptExpanded && (
              <>
                <textarea
                  className="settings-input refiner-settings__prompt-area"
                  value={refiner.customPrompt}
                  onChange={(e) => updateRefiner({ customPrompt: e.target.value })}
                  rows={4}
                  placeholder="Leave empty to use server default prompt"
                />
                <span className="settings-hint">Override the system prompt sent to the LLM for text refinement.</span>
              </>
            )}
          </div>

          {/* Action buttons */}
          <div className="refiner-settings__actions">
            <button
              className="btn btn--secondary"
              onClick={handleSaveBackendConfig}
              disabled={saving}
              type="button"
            >
              {saving ? 'Saving...' : 'Save to Backend'}
            </button>
            <button
              className="btn btn--primary"
              onClick={handleTest}
              disabled={testing}
              type="button"
              data-testid="test-refiner-btn"
            >
              {testing ? 'Testing...' : 'Test Refiner'}
            </button>
          </div>

          {/* Test Result */}
          {testResult && (
            <div className={`refiner-test-result ${testResult.error ? 'refiner-test-result--error' : ''}`}>
              {testResult.error ? (
                <div className="refiner-test-result__error">{testResult.error}</div>
              ) : (
                <>
                  <div className="refiner-test-result__row">
                    <span className="refiner-test-result__label">Raw:</span>
                    <span className="refiner-test-result__value">{testResult.raw}</span>
                  </div>
                  <div className="refiner-test-result__row">
                    <span className="refiner-test-result__label">Refined:</span>
                    <span className="refiner-test-result__value">{testResult.refined}</span>
                  </div>
                  <div className="refiner-test-result__meta">
                    {testResult.latency}ms via {testResult.provider}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
