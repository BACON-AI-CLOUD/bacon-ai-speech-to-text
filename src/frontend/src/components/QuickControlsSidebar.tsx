import { useState, useEffect, useCallback, useRef } from 'react';
import type { AppSettings, ProviderInfo, ModelInfo, PromptTemplate, BuiltinPromptTemplate, SuffixInjection } from '../types/index.ts';
import { BUILTIN_TEMPLATES } from './RefinerSettings.tsx';
import './QuickControlsSidebar.css';

interface QuickControlsSidebarProps {
  settings: AppSettings;
  onUpdate: (updates: Partial<AppSettings>) => void;
  backendUrl: string;
  isOpen: boolean;
  onToggle: () => void;
}

type SidebarTab = 'refiner' | 'output' | 'inject';

const FALLBACK_PROVIDERS: ProviderInfo[] = [
  { id: 'claude-cli', name: 'Claude Code', requires_api_key: false, configured: true },
  { id: 'anthropic', name: 'Anthropic', requires_api_key: true, configured: false },
  { id: 'openai', name: 'OpenAI', requires_api_key: true, configured: false },
  { id: 'groq', name: 'Groq', requires_api_key: true, configured: false },
  { id: 'ollama', name: 'Ollama', requires_api_key: false, configured: true },
  { id: 'gemini', name: 'Gemini', requires_api_key: true, configured: false },
];

const FALLBACK_MODELS: Record<string, ModelInfo[]> = {
  anthropic: [
    { id: 'claude-opus-4-6', name: 'Claude Opus 4.6' },
    { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5' },
    { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5' },
  ],
  openai: [
    { id: 'gpt-5.2', name: 'GPT-5.2' },
    { id: 'gpt-5-mini', name: 'GPT-5 Mini' },
    { id: 'gpt-4o', name: 'GPT-4o' },
  ],
  groq: [
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B' },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B' },
  ],
  ollama: [{ id: 'llama3.2', name: 'llama3.2' }],
  gemini: [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
  ],
  'claude-cli': [{ id: '', name: 'Default (claude)' }],
};

const TEMPLATE_LABELS: Record<string, string> = {
  cleanup: 'Speech Cleanup',
  nudge: 'BACON-AI Nudge',
  governance: 'Governance',
  professional: 'Professional',
  email: 'Email',
  whatsapp: 'WhatsApp',
  technical: 'Technical Docs',
  personal: 'Personal',
  'sheets-tsv': 'Sheets — Data (TSV)',
  'sheets-script': 'Sheets — Apps Script',
  'markdown-doc': 'Markdown \u2192 Clean Doc',
  custom: 'Custom',
};

function getHttpUrl(wsUrl: string): string {
  return wsUrl.replace('ws://', 'http://').replace('wss://', 'https://');
}

export function QuickControlsSidebar({
  settings,
  onUpdate,
  backendUrl,
  isOpen,
  onToggle,
}: QuickControlsSidebarProps) {
  const [activeTab, setActiveTab] = useState<SidebarTab>('refiner');
  const [providers, setProviders] = useState<ProviderInfo[]>(FALLBACK_PROVIDERS);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [windows, setWindows] = useState<{ title: string; process: string }[]>([]);
  const [loadingWindows, setLoadingWindows] = useState(false);
  const fetchedWindowsRef = useRef(false);

  const httpUrl = getHttpUrl(backendUrl);
  const { refiner } = settings;

  const updateRefiner = useCallback(
    (updates: Partial<AppSettings['refiner']>) => {
      onUpdate({ refiner: { ...refiner, ...updates } });
    },
    [refiner, onUpdate],
  );

  const fetchWindows = useCallback(async () => {
    setLoadingWindows(true);
    try {
      const res = await fetch(`${httpUrl}/windows`);
      if (res.ok) {
        const data = await res.json();
        setWindows(data.windows || []);
      }
    } catch { /* backend not reachable */ }
    setLoadingWindows(false);
  }, [httpUrl]);

  // Fetch windows every time the panel opens
  useEffect(() => {
    if (!isOpen) {
      fetchedWindowsRef.current = false;
      return;
    }
    if (fetchedWindowsRef.current) return;
    fetchedWindowsRef.current = true;
    fetchWindows();
  }, [isOpen, fetchWindows]);

  // Fetch providers once on open
  useEffect(() => {
    if (!isOpen) return;
    fetch(`${httpUrl}/refiner/providers`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setProviders(data);
      })
      .catch(() => { /* keep fallback */ });
  }, [isOpen, httpUrl]);

  // Fetch models when provider changes (or sidebar opens)
  useEffect(() => {
    if (!isOpen) return;
    const provider = refiner.provider;
    setLoadingModels(true);
    const fallback = FALLBACK_MODELS[provider] ?? [];

    fetch(`${httpUrl}/refiner/providers/${provider}/models`)
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) && data.length > 0 ? data : fallback;
        setModels(list);
        if (list.length > 0 && !list.some((m: ModelInfo) => m.id === refiner.model)) {
          updateRefiner({ model: list[0].id });
        }
      })
      .catch(() => {
        setModels(fallback);
        if (fallback.length > 0 && !fallback.some((m) => m.id === refiner.model)) {
          updateRefiner({ model: fallback[0].id });
        }
      })
      .finally(() => setLoadingModels(false));
  }, [isOpen, refiner.provider, httpUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync provider/model changes to backend
  const syncToBackend = useCallback(
    (providerOverride?: string, modelOverride?: string) => {
      const provider = providerOverride ?? refiner.provider;
      const model = modelOverride ?? refiner.model;
      fetch(`${httpUrl}/refiner/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active_provider: provider, ...(model ? { provider_configs: { [provider]: { model } } } : {}) }),
      }).catch(() => { /* backend not reachable */ });
    },
    [httpUrl, refiner.provider, refiner.model],
  );

  const handleProviderChange = useCallback(
    (provider: string) => {
      updateRefiner({ provider: provider as AppSettings['refiner']['provider'], model: '' });
      syncToBackend(provider, '');
    },
    [updateRefiner, syncToBackend],
  );

  const handleModelChange = useCallback(
    (model: string) => {
      updateRefiner({ model });
      syncToBackend(undefined, model);
    },
    [updateRefiner, syncToBackend],
  );

  const handleTemplateChange = useCallback(
    (tmpl: string) => {
      // Also update customPrompt so the new template's prompt is sent on the next process call
      const builtinPrompt = BUILTIN_TEMPLATES[tmpl as BuiltinPromptTemplate]?.prompt;
      const userPrompts: Record<string, { label: string; prompt: string }> = (() => {
        try { return JSON.parse(localStorage.getItem('bacon-voice-user-prompts') || '{}'); } catch { return {}; }
      })();
      const userPrompt = userPrompts[tmpl]?.prompt;
      const newPrompt = builtinPrompt ?? userPrompt ?? refiner.customPrompt;
      updateRefiner({ promptTemplate: tmpl as PromptTemplate, customPrompt: newPrompt });
    },
    [updateRefiner, refiner.customPrompt],
  );

  // Build list of all template options (built-in + user-saved from localStorage)
  const userPrompts: Record<string, { label: string }> = (() => {
    try {
      const raw = localStorage.getItem('bacon-voice-user-prompts');
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  })();

  const builtinKeys = Object.keys(TEMPLATE_LABELS) as BuiltinPromptTemplate[];

  return (
    <>
      {/* Collapse toggle button - always visible on the right edge */}
      <button
        className={`qcs-toggle-btn ${isOpen ? 'qcs-toggle-btn--open' : ''}`}
        onClick={onToggle}
        title={isOpen ? 'Close quick controls' : 'Open quick controls'}
        aria-label={isOpen ? 'Close quick controls' : 'Open quick controls'}
        aria-expanded={isOpen}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          {isOpen ? (
            <polyline points="9 18 15 12 9 6" />
          ) : (
            <polyline points="15 18 9 12 15 6" />
          )}
        </svg>
      </button>

      {/* Sidebar panel */}
      <aside className={`quick-controls-sidebar ${isOpen ? 'quick-controls-sidebar--open' : ''}`}>
        <div className="qcs-header">
          <span className="qcs-title">Quick Controls</span>
        </div>

        {/* Tab switcher */}
        <div className="qcs-tabs" role="tablist">
          <button
            className={`qcs-tab ${activeTab === 'refiner' ? 'qcs-tab--active' : ''}`}
            role="tab"
            aria-selected={activeTab === 'refiner'}
            onClick={() => setActiveTab('refiner')}
          >
            Refiner
          </button>
          <button
            className={`qcs-tab ${activeTab === 'output' ? 'qcs-tab--active' : ''}`}
            role="tab"
            aria-selected={activeTab === 'output'}
            onClick={() => setActiveTab('output')}
          >
            Output
          </button>
          <button
            className={`qcs-tab ${activeTab === 'inject' ? 'qcs-tab--active' : ''}`}
            role="tab"
            aria-selected={activeTab === 'inject'}
            onClick={() => setActiveTab('inject')}
          >
            Inject
          </button>
        </div>

        {/* Refiner tab */}
        {activeTab === 'refiner' && (
          <div className="qcs-body" role="tabpanel">
            {/* Enable toggle */}
            <label className="qcs-toggle-label">
              <input
                type="checkbox"
                checked={refiner.enabled}
                onChange={(e) => updateRefiner({ enabled: e.target.checked })}
              />
              <span>Enable Refiner</span>
            </label>

            <div className={`qcs-controls ${!refiner.enabled ? 'qcs-controls--disabled' : ''}`}>
              {/* Provider */}
              <div className="qcs-field">
                <label className="qcs-label">Provider</label>
                <select
                  className="qcs-select"
                  value={refiner.provider}
                  onChange={(e) => handleProviderChange(e.target.value)}
                  disabled={!refiner.enabled}
                >
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.requires_api_key && !p.configured ? ' ⚠' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Model */}
              <div className="qcs-field">
                <label className="qcs-label">Model</label>
                <select
                  className="qcs-select"
                  value={refiner.model}
                  onChange={(e) => handleModelChange(e.target.value)}
                  disabled={!refiner.enabled || loadingModels || models.length === 0}
                >
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                  {models.length === 0 && (
                    <option value="">{loadingModels ? 'Loading...' : 'No models'}</option>
                  )}
                </select>
              </div>

              {/* Template */}
              <div className="qcs-field">
                <label className="qcs-label">Template</label>
                <select
                  className="qcs-select"
                  value={refiner.promptTemplate ?? 'cleanup'}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  disabled={!refiner.enabled}
                >
                  <optgroup label="Built-in">
                    {builtinKeys.map((key) => (
                      <option key={key} value={key}>
                        {TEMPLATE_LABELS[key]}
                      </option>
                    ))}
                  </optgroup>
                  {Object.keys(userPrompts).length > 0 && (
                    <optgroup label="My Prompts">
                      {Object.entries(userPrompts).map(([key, tmpl]) => (
                        <option key={key} value={key}>
                          {tmpl.label}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            </div>

            <p className="qcs-hint">
              Full refiner settings in <strong>⚙ Settings</strong>
            </p>
          </div>
        )}

        {/* Output tab */}
        {activeTab === 'output' && (
          <div className="qcs-body" role="tabpanel">
            <label className="qcs-toggle-label">
              <input
                type="checkbox"
                checked={settings.autoCopy}
                onChange={(e) => onUpdate({ autoCopy: e.target.checked })}
              />
              <span>Auto-copy</span>
            </label>

            <label className="qcs-toggle-label">
              <input
                type="checkbox"
                checked={settings.typeToKeyboard}
                onChange={(e) => onUpdate({ typeToKeyboard: e.target.checked })}
              />
              <span>Type to keyboard</span>
            </label>

            {settings.typeToKeyboard && (
              <>
                <label className="qcs-toggle-label">
                  <input
                    type="checkbox"
                    checked={settings.cursorPositionMode}
                    onChange={(e) => onUpdate({ cursorPositionMode: e.target.checked })}
                  />
                  <span>Cursor Position mode</span>
                </label>
                <p className="qcs-hint" style={{ paddingLeft: '22px', marginTop: '2px' }}>
                  Hear beeps → switch to your app → text pastes at cursor
                </p>

                <label className="qcs-toggle-label" style={{ paddingLeft: '22px', opacity: settings.cursorPositionMode ? 0.4 : 1, pointerEvents: settings.cursorPositionMode ? 'none' : 'auto' }}>
                  <input
                    type="checkbox"
                    checked={settings.typingAutoFocus}
                    onChange={(e) => onUpdate({ typingAutoFocus: e.target.checked })}
                  />
                  <span>Auto-focus window</span>
                </label>

                <div className="qcs-field" style={{ opacity: settings.cursorPositionMode ? 0.4 : 1, pointerEvents: settings.cursorPositionMode ? 'none' : 'auto' }}>
                  <label className="qcs-label">Target window</label>
                  <div className="qcs-window-row">
                    <select
                      className="qcs-select"
                      value={windows.some((w) => w.title === settings.targetWindow) ? settings.targetWindow : '__custom__'}
                      onChange={(e) => {
                        if (e.target.value === '__none__') {
                          onUpdate({ targetWindow: '' });
                        } else if (e.target.value !== '__custom__') {
                          onUpdate({ targetWindow: e.target.value });
                        }
                      }}
                    >
                      <option value="__none__">Last active (Alt+Tab)</option>
                      {windows.map((w) => (
                        <option key={w.title} value={w.title}>
                          {w.title.length > 28 ? w.title.slice(0, 25) + '...' : w.title}
                        </option>
                      ))}
                      {settings.targetWindow && !windows.some((w) => w.title === settings.targetWindow) && (
                        <option value="__custom__">Custom: {settings.targetWindow.slice(0, 18)}</option>
                      )}
                    </select>
                    <button
                      className="qcs-refresh-btn"
                      onClick={fetchWindows}
                      title="Refresh window list"
                      type="button"
                      disabled={loadingWindows}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="23 4 23 10 17 10" />
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                      </svg>
                    </button>
                  </div>
                  <input
                    className="qcs-input"
                    type="text"
                    value={settings.targetWindow}
                    onChange={(e) => onUpdate({ targetWindow: e.target.value })}
                    placeholder="Or type partial title"
                    style={{ marginTop: '4px' }}
                  />
                </div>

                <div className="qcs-field">
                  <label className="qcs-label">Focus delay (ms)</label>
                  <input
                    type="number"
                    className="qcs-input"
                    value={settings.typingFocusDelay}
                    min={100}
                    max={3000}
                    step={100}
                    onChange={(e) => onUpdate({ typingFocusDelay: Number(e.target.value) })}
                    style={{ marginTop: '4px' }}
                  />
                </div>

                <label className="qcs-toggle-label" style={{ paddingLeft: '22px' }}>
                  <input
                    type="checkbox"
                    checked={settings.typingFlashWindow}
                    onChange={(e) => onUpdate({ typingFlashWindow: e.target.checked })}
                  />
                  <span>Flash window on paste</span>
                </label>

                <div className="qcs-field" style={{ marginTop: '8px' }}>
                  <label className="qcs-label">Countdown mode</label>
                  <label className="qcs-toggle-label">
                    <input
                      type="radio"
                      name="announcementMode"
                      checked={settings.announcementMode !== 'voice'}
                      onChange={() => onUpdate({ announcementMode: 'beep' })}
                    />
                    <span>Countdown beeps</span>
                  </label>
                  <label className="qcs-toggle-label">
                    <input
                      type="radio"
                      name="announcementMode"
                      checked={settings.announcementMode === 'voice'}
                      onChange={() => onUpdate({ announcementMode: 'voice' })}
                    />
                    <span>Elisabeth voice</span>
                  </label>
                  {settings.announcementMode === 'voice' && (
                    <div style={{ paddingLeft: '22px', marginTop: '4px' }}>
                      <div className="qcs-field">
                        <label className="qcs-label" style={{ fontSize: '11px' }}>Mic opens:</label>
                        <input
                          className="qcs-input"
                          type="text"
                          value={settings.startMessage}
                          onChange={(e) => onUpdate({ startMessage: e.target.value })}
                          style={{ marginTop: '2px' }}
                        />
                      </div>
                      <div className="qcs-field">
                        <label className="qcs-label" style={{ fontSize: '11px' }}>After stop:</label>
                        <input
                          className="qcs-input"
                          type="text"
                          value={settings.stopMessage}
                          onChange={(e) => onUpdate({ stopMessage: e.target.value })}
                          style={{ marginTop: '2px' }}
                        />
                      </div>
                      <div className="qcs-field">
                        <label className="qcs-label" style={{ fontSize: '11px' }}>Before write:</label>
                        <input
                          className="qcs-input"
                          type="text"
                          value={settings.writeMessage}
                          onChange={(e) => onUpdate({ writeMessage: e.target.value })}
                          style={{ marginTop: '2px' }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            <label className="qcs-toggle-label">
              <input
                type="checkbox"
                checked={settings.notificationsEnabled}
                onChange={(e) => onUpdate({ notificationsEnabled: e.target.checked })}
              />
              <span>Notifications</span>
            </label>

            <label className="qcs-toggle-label">
              <input
                type="checkbox"
                checked={settings.discussMode}
                onChange={(e) => onUpdate({ discussMode: e.target.checked })}
              />
              <span>Chat with Elisabeth</span>
            </label>
          </div>
        )}

        {/* Inject tab */}
        {activeTab === 'inject' && (
          <div className="qcs-body" role="tabpanel">
            <div className="qcs-field">
              <label className="qcs-label">Apply injections to:</label>
              <label className="qcs-toggle-label">
                <input type="checkbox" checked={settings.injectOnLive} onChange={(e) => onUpdate({ injectOnLive: e.target.checked })} />
                <span>Live recording</span>
              </label>
              <label className="qcs-toggle-label">
                <input type="checkbox" checked={settings.injectOnFile} onChange={(e) => onUpdate({ injectOnFile: e.target.checked })} />
                <span>File transcription</span>
              </label>
              <label className="qcs-toggle-label">
                <input type="checkbox" checked={settings.injectOnKeyboard} onChange={(e) => onUpdate({ injectOnKeyboard: e.target.checked })} />
                <span>Keyboard typing</span>
              </label>
            </div>

            <div className="qcs-field" style={{ marginTop: '8px' }}>
              <label className="qcs-label">Suffix injections</label>
              <div className="qcs-inject-list">
                {settings.suffixInjections.map((inj) => (
                  <div key={inj.id} className="qcs-inject-item">
                    <label className="qcs-toggle-label" style={{ flex: 1 }}>
                      <input
                        type="checkbox"
                        checked={inj.enabled}
                        onChange={(e) => {
                          const updated = settings.suffixInjections.map((i) =>
                            i.id === inj.id ? { ...i, enabled: e.target.checked } : i,
                          );
                          onUpdate({ suffixInjections: updated });
                        }}
                      />
                      <span style={{ fontSize: '12px' }}>{inj.label}</span>
                    </label>
                    {!inj.builtIn && (
                      <button
                        className="qcs-inject-delete"
                        onClick={() => {
                          const updated = settings.suffixInjections.filter((i) => i.id !== inj.id);
                          onUpdate({ suffixInjections: updated });
                        }}
                        title="Remove injection"
                      >
                        x
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <AddCustomInjection
              onAdd={(label, text) => {
                const newInj: SuffixInjection = {
                  id: `custom-${Date.now()}`,
                  label,
                  text,
                  enabled: true,
                  builtIn: false,
                };
                onUpdate({ suffixInjections: [...settings.suffixInjections, newInj] });
              }}
            />

            <div className="qcs-field" style={{ marginTop: '8px' }}>
              <button
                className="qcs-btn-small"
                title="Load target window set by Win+Shift+B hotkey"
                onClick={async () => {
                  try {
                    const resp = await fetch(`${httpUrl}/keyboard/target`);
                    const data = await resp.json();
                    if (data.target) onUpdate({ targetWindow: data.target });
                  } catch { /* ignored */ }
                }}
              >
                Load AHK target
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

function AddCustomInjection({ onAdd }: { onAdd: (label: string, text: string) => void }) {
  const [label, setLabel] = useState('');
  const [text, setText] = useState('');

  const handleAdd = () => {
    if (!label.trim() || !text.trim()) return;
    onAdd(label.trim(), text.trim());
    setLabel('');
    setText('');
  };

  return (
    <div className="qcs-add-injection">
      <input
        className="qcs-input"
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Label"
      />
      <textarea
        className="qcs-input qcs-textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Injection text..."
        rows={2}
      />
      <button
        className="qcs-btn-small"
        onClick={handleAdd}
        disabled={!label.trim() || !text.trim()}
      >
        + Add
      </button>
    </div>
  );
}
