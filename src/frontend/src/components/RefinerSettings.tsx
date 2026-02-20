import { useState, useCallback, useEffect } from 'react';
import type { AppSettings, ProviderInfo, ModelInfo, PromptTemplate, BuiltinPromptTemplate, UserPromptTemplate } from '../types/index.ts';
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
  warning?: string;
}

function getHttpUrl(wsUrl: string): string {
  return wsUrl.replace('ws://', 'http://').replace('wss://', 'https://');
}

const DYNAMIC_PROVIDERS = new Set(['groq', 'ollama']);

const FALLBACK_PROVIDER_INFO: Record<string, { name: string; requires_api_key: boolean }> = {
  anthropic: { name: 'Anthropic', requires_api_key: true },
  openai: { name: 'OpenAI', requires_api_key: true },
  groq: { name: 'Groq', requires_api_key: true },
  ollama: { name: 'Ollama', requires_api_key: false },
  gemini: { name: 'Google Gemini', requires_api_key: true },
};

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
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile' },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant' },
    { id: 'llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout 17B' },
    { id: 'llama-4-maverick-17b-128e-instruct', name: 'Llama 4 Maverick 17B' },
  ],
  ollama: [
    { id: 'llama3.2', name: 'llama3.2' },
  ],
  gemini: [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro (Preview)' },
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (Preview)' },
  ],
};

const USER_PROMPTS_KEY = 'bacon-voice-user-prompts';

function loadUserPrompts(): Record<string, UserPromptTemplate> {
  try {
    const raw = localStorage.getItem(USER_PROMPTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

function saveUserPrompts(prompts: Record<string, UserPromptTemplate>): void {
  localStorage.setItem(USER_PROMPTS_KEY, JSON.stringify(prompts));
}

export const BUILTIN_TEMPLATES: Record<BuiltinPromptTemplate, { label: string; description: string; prompt: string }> = {
  cleanup: {
    label: 'Speech Cleanup',
    description: 'Remove filler words and speech artifacts, keep meaning intact',
    prompt: `You are a speech-to-text cleanup assistant. Your job is to clean up raw transcriptions while preserving the speaker's exact meaning.

REMOVE: Filler words (um, uh, like, you know, sort of, basically, actually, right, so yeah, I mean), false starts, repetitions, trailing fragments, self-corrections (keep only the corrected version), verbal tics, pause markers.

PRESERVE: All technical terms, proper nouns, specific values (numbers, dates, versions), emotional emphasis, conditional logic, constraints and preferences.

RULES:
- Never add meaning that wasn't in the original
- Never remove intentional content
- Fix obvious grammar issues caused by speech patterns
- Output ONLY the cleaned text, nothing else`,
  },
  nudge: {
    label: 'BACON-AI Nudge',
    description: 'Voice-to-governance bridge: clean speech + inject complexity tiers, control points, and evidence-of-done cues',
    prompt: `You are the BACON-AI Text Refinement Agent — the bridge between human speech and AI agent execution. You receive raw speech-to-text transcriptions and transform them into structured, governance-aligned prompts.

SPEECH CLEANUP:
- Remove: filler words (um, uh, like, you know, basically, actually), false starts, repetitions, trailing fragments, self-corrections (keep only corrected version), verbal tics, pause markers.
- Preserve: technical terms (correct spelling), proper nouns, specific values (numbers, dates, versions, branch names), emotional emphasis/urgency, conditional logic, constraints and preferences.
- If references are unclear, flag: [CLARIFICATION NEEDED: reference unclear]
- If terms are garbled, note: [INTERPRETED: "webpak" → webpack]

GOVERNANCE NUDGE INJECTION:
After cleaning the speech, add governance cues that prime the receiving agent:

1. Complexity Anchor: Infer tier from scope.
   - Small/single change → "TRIVIAL-tier. Classify to confirm."
   - Multi-file/cross-module → "Likely CRITICAL tier. ADR + plan approval before implementation."

2. Evidence Anchor: End with tier-appropriate completion definition.
   - TRIVIAL: "Evidence of done: smoke test passes, commit with message."
   - STANDARD: "Evidence of done: TUT + FUT green, evidence pack, PR with diff."
   - CRITICAL: "Evidence of done: full evidence pack (TUT+FUT+E2E+SIT), ADR, traceability matrix, PR with human approval."

3. CP Activation: When detecting triggers, name the control point:
   - UI/frontend/CSS → "CP-9 browser testing required."
   - Database/schema/migration → "CP-18 schema migration gate applies."
   - Auth/security/token → "Security-sensitive — auto-escalation applies."
   - Deploy/production → "Production deployment — CRITICAL tier mandatory."

4. Workflow Primer: For code changes, include:
   "Start with preflight: classify complexity → create sandbox → capture baseline → implement → produce evidence pack → submit PR."

OUTPUT FORMAT:
## Task
[Clean, structured description with governance nudges woven in]

## Context
[Project name, files, constraints, preferences mentioned]

## Governance Cues
- **Inferred Tier:** TRIVIAL / STANDARD / CRITICAL (with reasoning)
- **Active CPs:** [triggered control points]
- **Evidence of Done:** [tier-appropriate definition]

## Clarifications Needed
[Ambiguities or missing info — omit if none]

RULES:
- Never invent intent — nudges are FRAMING, not new requirements
- Never remove intent — preserve all constraints and preferences
- Flag ambiguity, don't resolve it — present options if unclear
- Keep nudges natural — helpful context, not a compliance checklist
- Preserve urgency signals`,
  },
  governance: {
    label: 'BACON-AI Governance',
    description: 'Voice-to-governance bridge with complexity tiers and control points',
    prompt: '', // Loaded from backend config (the long NPSL prompt)
  },
  professional: {
    label: 'Professional Correspondence',
    description: 'Formal business communication tone',
    prompt: `You are a professional correspondence editor. Transform raw speech transcriptions into polished, professional business communication.

GUIDELINES:
- Use formal but approachable business English
- Structure into clear paragraphs with logical flow
- Remove all speech artifacts and filler words
- Add appropriate greetings/closings if the context suggests a letter or message
- Maintain professional tone without being stiff
- Preserve all factual content, names, dates, and commitments
- Fix grammar and punctuation
- Use active voice where possible

Output ONLY the refined professional text.`,
  },
  email: {
    label: 'Email',
    description: 'Clear, concise email format with subject line',
    prompt: `You are an email drafting assistant. Transform raw speech transcriptions into well-structured emails.

FORMAT:
- Start with "Subject: [inferred subject]" on the first line
- Add appropriate greeting (Dear/Hi/Hello based on tone)
- Body: clear, concise paragraphs
- Close with appropriate sign-off
- Remove all speech artifacts

GUIDELINES:
- Keep paragraphs short (2-3 sentences max)
- Use bullet points for lists or multiple items
- Highlight any action items or deadlines
- Match formality to the apparent relationship (formal for unknown, casual for colleagues)
- Preserve all key information: names, dates, numbers, commitments

Output ONLY the formatted email.`,
  },
  whatsapp: {
    label: 'WhatsApp / Chat',
    description: 'Casual messaging style, brief and natural',
    prompt: `You are a casual message editor. Transform speech transcriptions into natural chat/WhatsApp messages.

STYLE:
- Keep it brief and conversational
- Use casual tone (contractions, informal language)
- Break long messages into shorter ones (separate with blank lines)
- Emojis are OK if the tone suggests them
- Remove speech artifacts but keep the natural voice
- Don't over-formalize - if they said "gonna" that's fine
- Fix only actual errors, not casual speech patterns

Output ONLY the cleaned message text. Keep it feeling like a real person texting.`,
  },
  technical: {
    label: 'Technical Documentation',
    description: 'Structured technical writing with proper formatting',
    prompt: `You are a technical documentation editor. Transform speech transcriptions into clear, structured technical content.

FORMAT:
- Use markdown formatting where helpful (headers, code blocks, lists)
- Structure information logically (problem -> context -> solution)
- Use precise technical terminology
- Format code references with backticks
- Use numbered steps for procedures
- Use bullet points for lists

GUIDELINES:
- Remove all speech artifacts
- Preserve exact technical terms, command names, file paths, version numbers
- Clarify ambiguous references with [brackets] if meaning is unclear
- Keep explanations concise but complete
- Use present tense for documentation
- Add structure even if the speaker was rambling

Output ONLY the formatted technical content.`,
  },
  personal: {
    label: 'Personal / Friendly',
    description: 'Warm, natural tone for personal messages and letters',
    prompt: `You are a personal message editor. Transform speech transcriptions into warm, natural personal communication.

STYLE:
- Keep the speaker's authentic voice and personality
- Warm and genuine tone
- Remove speech artifacts but preserve emotional expression
- Keep humor, enthusiasm, and personal touches
- Fix grammar gently without making it sound robotic
- If it sounds like a letter, add appropriate personal greeting/closing
- Preserve stories and anecdotes as told

RULES:
- Never make it sound corporate or formal
- Keep exclamations and emphasis where the speaker used them
- Preserve the speaker's unique way of expressing things
- Only clean up, never rewrite the personality out

Output ONLY the cleaned personal message.`,
  },
  custom: {
    label: 'Custom',
    description: 'Write or paste your own prompt',
    prompt: '',
  },
};

const DEFAULT_MODEL_IDS: Record<string, string> = {
  anthropic: 'claude-sonnet-4-5-20250929',
  openai: 'gpt-4o',
  groq: 'llama-3.3-70b-versatile',
  ollama: 'llama3.2',
  gemini: 'gemini-2.5-flash',
};

export function RefinerSettings({ settings, onUpdate, backendUrl }: RefinerSettingsProps) {
  const [collapsed, setCollapsed] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [ollamaHost, setOllamaHost] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{ ok: boolean; latency_ms: number; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [userPrompts, setUserPrompts] = useState<Record<string, UserPromptTemplate>>(loadUserPrompts);
  const [savePromptName, setSavePromptName] = useState('');
  const [showSavePrompt, setShowSavePrompt] = useState(false);

  const httpUrl = getHttpUrl(backendUrl);
  const { refiner } = settings;

  const updateRefiner = useCallback(
    (updates: Partial<AppSettings['refiner']>) => {
      onUpdate({ refiner: { ...refiner, ...updates } });
    },
    [refiner, onUpdate],
  );

  // Auto-sync prompt to backend whenever it changes
  useEffect(() => {
    if (!refiner.customPrompt) return;
    const controller = new AbortController();
    fetch(`${httpUrl}/refiner/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ custom_prompt: refiner.customPrompt }),
      signal: controller.signal,
    }).catch(() => { /* backend not reachable */ });
    return () => controller.abort();
  }, [httpUrl, refiner.customPrompt]);

  // Fetch providers and Ollama host URL on expand
  useEffect(() => {
    if (collapsed) return;
    fetch(`${httpUrl}/refiner/providers`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setProviders(data);
      })
      .catch(() => {
        // Backend not reachable - use fallback
        setProviders([
          { id: 'claude-cli', name: 'Claude Code (Max/Pro)', requires_api_key: false, configured: true },
          { id: 'anthropic', name: 'Anthropic', requires_api_key: true, configured: false },
          { id: 'openai', name: 'OpenAI', requires_api_key: true, configured: false },
          { id: 'groq', name: 'Groq', requires_api_key: true, configured: false },
          { id: 'ollama', name: 'Ollama', requires_api_key: false, configured: true },
          { id: 'gemini', name: 'Google Gemini', requires_api_key: true, configured: false },
        ]);
      });
    // Fetch actual Ollama host from backend config (auto-detected or user-configured)
    if (!ollamaHost) {
      fetch(`${httpUrl}/refiner/config`)
        .then((res) => res.json())
        .then((data) => {
          const ollamaInfo = data?.providers?.ollama;
          if (ollamaInfo?.base_url) {
            // Strip /api/chat suffix for display
            setOllamaHost(ollamaInfo.base_url.replace(/\/api\/chat\/?$/, ''));
          } else {
            setOllamaHost('http://localhost:11434');
          }
        })
        .catch(() => {
          setOllamaHost('http://localhost:11434');
        });
    }
  }, [collapsed, httpUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch models when provider changes
  const fetchModels = useCallback(
    (providerName: string) => {
      setLoadingModels(true);
      const fallback = FALLBACK_MODELS[providerName] ?? [];
      fetch(`${httpUrl}/refiner/providers/${providerName}/models`)
        .then((res) => res.json())
        .then((data) => {
          const modelList = Array.isArray(data) && data.length > 0 ? data : fallback;
          setModels(modelList);
          // Auto-select default model if current model isn't in the list
          if (modelList.length > 0 && !modelList.some((m: ModelInfo) => m.id === refiner.model)) {
            const defaultId = DEFAULT_MODEL_IDS[providerName];
            const defaultModel = modelList.find((m: ModelInfo) => m.id === defaultId);
            updateRefiner({ model: defaultModel ? defaultModel.id : modelList[0].id });
          }
        })
        .catch(() => {
          setModels(fallback);
          if (fallback.length > 0 && !fallback.some((m) => m.id === refiner.model)) {
            const defaultId = DEFAULT_MODEL_IDS[providerName];
            const defaultModel = fallback.find((m) => m.id === defaultId);
            updateRefiner({ model: defaultModel ? defaultModel.id : fallback[0].id });
          }
        })
        .finally(() => setLoadingModels(false));
    },
    [httpUrl, refiner.model, updateRefiner],
  );

  useEffect(() => {
    if (collapsed) return;
    fetchModels(refiner.provider);
  }, [collapsed, refiner.provider]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedProviderInfo = providers.find((p) => p.id === refiner.provider)
    ?? (FALLBACK_PROVIDER_INFO[refiner.provider]
      ? { id: refiner.provider, ...FALLBACK_PROVIDER_INFO[refiner.provider], configured: false }
      : undefined);

  const handleSaveBackendConfig = useCallback(async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        enabled: refiner.enabled,
        active_provider: refiner.provider,
      };
      const providerConfigs: Record<string, Record<string, string>> = {};

      if (selectedProviderInfo?.requires_api_key && apiKey) {
        providerConfigs[refiner.provider] = { api_key: apiKey };
      }
      if (refiner.provider === 'ollama') {
        providerConfigs.ollama = {
          base_url: ollamaHost + '/api/chat',
          ...(refiner.model ? { model: refiner.model } : {}),
        };
      } else if (refiner.model) {
        providerConfigs[refiner.provider] = {
          ...providerConfigs[refiner.provider],
          model: refiner.model,
        };
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
  }, [httpUrl, refiner, apiKey, ollamaHost, selectedProviderInfo]);

  const handleTestConnection = useCallback(async () => {
    setTestingConnection(true);
    setConnectionResult(null);
    try {
      const res = await fetch(`${httpUrl}/refiner/providers/${refiner.provider}/test-connection`);
      if (res.ok) {
        setConnectionResult(await res.json());
      } else {
        setConnectionResult({ ok: false, latency_ms: 0, message: 'Backend unreachable' });
      }
    } catch {
      setConnectionResult({ ok: false, latency_ms: 0, message: 'Could not reach backend' });
    }
    setTestingConnection(false);
  }, [httpUrl, refiner.provider]);

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
          warning: data.warning,
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

  // Resolve template data for any key (built-in or user)
  const getTemplateData = useCallback((key: string): { label: string; description: string; prompt: string } | undefined => {
    if (key in BUILTIN_TEMPLATES) return BUILTIN_TEMPLATES[key as BuiltinPromptTemplate];
    if (key in userPrompts) return userPrompts[key];
    return undefined;
  }, [userPrompts]);

  const handleSaveAsTemplate = useCallback(() => {
    const name = savePromptName.trim();
    if (!name || !refiner.customPrompt) return;
    const key = `user_${Date.now()}`;
    const updated = {
      ...userPrompts,
      [key]: { label: name, description: 'User-saved prompt template', prompt: refiner.customPrompt },
    };
    setUserPrompts(updated);
    saveUserPrompts(updated);
    updateRefiner({ promptTemplate: key });
    setSavePromptName('');
    setShowSavePrompt(false);
  }, [savePromptName, refiner.customPrompt, userPrompts, updateRefiner]);

  const handleUpdateUserTemplate = useCallback(() => {
    const key = refiner.promptTemplate;
    if (!key || !(key in userPrompts)) return;
    const updated = {
      ...userPrompts,
      [key]: { ...userPrompts[key], prompt: refiner.customPrompt },
    };
    setUserPrompts(updated);
    saveUserPrompts(updated);
  }, [refiner.promptTemplate, refiner.customPrompt, userPrompts]);

  const handleDeleteUserTemplate = useCallback((key: string) => {
    const { [key]: _, ...rest } = userPrompts;
    setUserPrompts(rest);
    saveUserPrompts(rest);
    if (refiner.promptTemplate === key) {
      updateRefiner({ promptTemplate: 'cleanup', customPrompt: BUILTIN_TEMPLATES.cleanup.prompt });
    }
  }, [userPrompts, refiner.promptTemplate, updateRefiner]);

  const isUserTemplate = refiner.promptTemplate in userPrompts;

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
          <p className="settings-hint refiner-settings__quick-hint">
            Use <strong>Quick Controls</strong> (›) to switch provider, model, and template.
          </p>

          {/* API Key for cloud providers */}
          {selectedProviderInfo?.requires_api_key && (
            <div className="settings-group">
              <label className="settings-label">
                {selectedProviderInfo.name} API Key
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

          {/* Ollama host URL */}
          {refiner.provider === 'ollama' && (
            <div className="settings-group">
              <label className="settings-label">Ollama Host URL</label>
              <input
                className="settings-input"
                type="text"
                value={ollamaHost}
                onChange={(e) => setOllamaHost(e.target.value)}
                placeholder="http://localhost:11434"
              />
              <span className="settings-hint">
                Auto-detected from your environment. Change if Ollama runs on a different host/port.
                Use &quot;Save to Backend&quot; to persist. Set OLLAMA_HOST env var to override at startup.
              </span>
            </div>
          )}

          {/* Test Connection */}
          <div className="settings-group settings-group--inline">
            <button
              className="btn btn--outline"
              onClick={handleTestConnection}
              disabled={testingConnection}
              type="button"
              data-testid="test-connection-btn"
            >
              {testingConnection ? 'Testing...' : 'Test Connection'}
            </button>
            {connectionResult && (
              <span
                className={`refiner-settings__connection-result ${connectionResult.ok ? 'refiner-settings__connection-result--ok' : 'refiner-settings__connection-result--fail'}`}
              >
                {connectionResult.ok ? '\u2705' : '\u274C'}{' '}
                {connectionResult.message}
                {connectionResult.ok && connectionResult.latency_ms > 0 && (
                  <> ({connectionResult.latency_ms}ms)</>
                )}
              </span>
            )}
          </div>

          {/* Prompt Editor */}
          <div className="settings-group">
            <button
              className="refiner-settings__prompt-toggle"
              onClick={() => setPromptExpanded((prev) => !prev)}
              type="button"
            >
              {promptExpanded ? '\u25BC' : '\u25B6'}{' '}
              {refiner.promptTemplate === 'custom' ? 'Custom Prompt' : 'View / Edit Prompt'}
            </button>
            {promptExpanded && (
              <>
                <textarea
                  className="settings-input refiner-settings__prompt-area"
                  value={refiner.customPrompt}
                  onChange={(e) => {
                    updateRefiner({ customPrompt: e.target.value });
                    // Auto-switch to "custom" if user edits a built-in template prompt
                    const tmplKey = refiner.promptTemplate;
                    if (tmplKey !== 'custom' && !isUserTemplate) {
                      const tmplPrompt = BUILTIN_TEMPLATES[tmplKey as BuiltinPromptTemplate]?.prompt;
                      if (tmplPrompt && e.target.value !== tmplPrompt) {
                        updateRefiner({ promptTemplate: 'custom', customPrompt: e.target.value });
                      }
                    }
                  }}
                  rows={6}
                  placeholder="Enter your prompt here, or select a template above"
                />
                <span className="settings-hint">
                  {refiner.promptTemplate === 'custom'
                    ? 'Write or paste your own prompt. Use "Save as Template" to keep it.'
                    : isUserTemplate
                      ? 'Editing your saved template. Click "Update Template" to save changes.'
                      : 'Editing will switch to "Custom". Use "Save to Backend" to persist.'}
                </span>
                <div className="refiner-settings__prompt-actions">
                  {/* Reset to default for built-in (non-custom, non-governance) */}
                  {!isUserTemplate && refiner.promptTemplate !== 'custom' && refiner.promptTemplate !== 'governance' && (
                    <button
                      className="btn btn--outline refiner-settings__reset-prompt"
                      type="button"
                      onClick={() => {
                        const tmpl = BUILTIN_TEMPLATES[refiner.promptTemplate as BuiltinPromptTemplate];
                        if (tmpl) updateRefiner({ customPrompt: tmpl.prompt });
                      }}
                    >
                      Reset to Default
                    </button>
                  )}
                  {/* Update user template in-place */}
                  {isUserTemplate && (
                    <button
                      className="btn btn--outline refiner-settings__reset-prompt"
                      type="button"
                      onClick={handleUpdateUserTemplate}
                    >
                      Update Template
                    </button>
                  )}
                  {/* Save as new template */}
                  {!showSavePrompt ? (
                    <button
                      className="btn btn--outline refiner-settings__reset-prompt"
                      type="button"
                      onClick={() => setShowSavePrompt(true)}
                      disabled={!refiner.customPrompt}
                    >
                      Save as Template
                    </button>
                  ) : (
                    <div className="refiner-settings__save-prompt-row">
                      <input
                        className="settings-input refiner-settings__save-prompt-input"
                        type="text"
                        value={savePromptName}
                        onChange={(e) => setSavePromptName(e.target.value)}
                        placeholder="Template name"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveAsTemplate();
                          if (e.key === 'Escape') { setShowSavePrompt(false); setSavePromptName(''); }
                        }}
                      />
                      <button
                        className="btn btn--outline refiner-settings__reset-prompt"
                        type="button"
                        onClick={handleSaveAsTemplate}
                        disabled={!savePromptName.trim()}
                      >
                        Save
                      </button>
                      <button
                        className="btn btn--outline refiner-settings__reset-prompt"
                        type="button"
                        onClick={() => { setShowSavePrompt(false); setSavePromptName(''); }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
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
                  {testResult.warning && (
                    <div className="refiner-test-result__warning">{testResult.warning}</div>
                  )}
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
