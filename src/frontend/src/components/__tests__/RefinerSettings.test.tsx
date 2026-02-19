import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RefinerSettings } from '../RefinerSettings.tsx';
import { DEFAULT_SETTINGS } from '../../types/index.ts';
import type { AppSettings } from '../../types/index.ts';

function makeSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return { ...DEFAULT_SETTINGS, ...overrides };
}

const MOCK_PROVIDERS = [
  { id: 'anthropic', name: 'Anthropic', requires_api_key: true, configured: false },
  { id: 'openai', name: 'OpenAI', requires_api_key: true, configured: false },
  { id: 'groq', name: 'Groq', requires_api_key: true, configured: true },
  { id: 'ollama', name: 'Ollama', requires_api_key: false, configured: true },
  { id: 'gemini', name: 'Google Gemini', requires_api_key: true, configured: false },
];

const MOCK_MODELS = [
  { id: 'llama3.2', name: 'llama3.2' },
  { id: 'llama3.1', name: 'llama3.1' },
];

function mockFetchForProviders() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
    const urlStr = typeof url === 'string' ? url : url.toString();
    if (urlStr.includes('/refiner/providers/') && urlStr.includes('/models')) {
      return Promise.resolve(
        new Response(JSON.stringify(MOCK_MODELS), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }
    if (urlStr.includes('/refiner/providers')) {
      return Promise.resolve(
        new Response(JSON.stringify(MOCK_PROVIDERS), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }
    if (urlStr.includes('/refiner/test')) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            original: 'test input',
            refined_text: 'Test input.',
            provider: 'ollama',
            model: 'llama3.2',
            processing_time_ms: 150,
            tokens_used: 10,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    }
    return Promise.resolve(new Response('{}', { status: 200 }));
  });
}

describe('RefinerSettings', () => {
  const defaultProps = {
    settings: makeSettings(),
    onUpdate: vi.fn(),
    backendUrl: 'ws://localhost:8765',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  function expandSection() {
    const toggle = screen.getByText(/text refiner/i);
    fireEvent.click(toggle);
  }

  it('renders provider dropdown with 5 options after fetching', async () => {
    mockFetchForProviders();
    render(<RefinerSettings {...defaultProps} />);
    expandSection();

    // Wait for providers to load by checking for a provider option
    await waitFor(() => {
      const selects = document.querySelectorAll('select.settings-select');
      expect(selects.length).toBeGreaterThanOrEqual(1);
      const providerSelect = selects[0];
      const options = providerSelect.querySelectorAll('option');
      expect(options.length).toBe(5);
    });
  });

  it('shows model dropdown that loads models', async () => {
    mockFetchForProviders();
    render(<RefinerSettings {...defaultProps} />);
    expandSection();

    await waitFor(() => {
      const selects = document.querySelectorAll('select.settings-select');
      expect(selects.length).toBe(3);  // Provider, Model, Prompt Template
      const modelSelect = selects[1];
      const options = modelSelect.querySelectorAll('option');
      expect(options.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('shows refresh button for ollama provider', async () => {
    mockFetchForProviders();
    render(<RefinerSettings {...defaultProps} />);
    expandSection();

    await waitFor(() => {
      expect(screen.getByTitle('Refresh model list')).toBeInTheDocument();
    });
  });

  it('shows refresh button for groq provider', async () => {
    mockFetchForProviders();
    const settings = makeSettings({
      refiner: { enabled: true, provider: 'groq', model: '', customPrompt: '' },
    });
    render(<RefinerSettings {...defaultProps} settings={settings} />);
    expandSection();

    await waitFor(() => {
      expect(screen.getByTitle('Refresh model list')).toBeInTheDocument();
    });
  });

  it('does not show refresh button for anthropic provider', async () => {
    mockFetchForProviders();
    const settings = makeSettings({
      refiner: { enabled: true, provider: 'anthropic', model: '', customPrompt: '' },
    });
    render(<RefinerSettings {...defaultProps} settings={settings} />);
    expandSection();

    // Wait for providers to load
    await waitFor(() => {
      const selects = document.querySelectorAll('select.settings-select');
      expect(selects.length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.queryByTitle('Refresh model list')).not.toBeInTheDocument();
  });

  it('shows api key input for cloud providers', async () => {
    mockFetchForProviders();
    const settings = makeSettings({
      refiner: { enabled: true, provider: 'groq', model: '', customPrompt: '' },
    });
    render(<RefinerSettings {...defaultProps} settings={settings} />);
    expandSection();

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/enter api key/i)).toBeInTheDocument();
    });
  });

  it('does not show api key input for ollama', async () => {
    mockFetchForProviders();
    render(<RefinerSettings {...defaultProps} />);
    expandSection();

    // Wait for providers to load
    await waitFor(() => {
      const selects = document.querySelectorAll('select.settings-select');
      const providerSelect = selects[0];
      if (providerSelect) {
        const options = providerSelect.querySelectorAll('option');
        expect(options.length).toBe(5);
      }
    });
    expect(screen.queryByPlaceholderText(/enter api key/i)).not.toBeInTheDocument();
  });

  it('shows ollama host url only for ollama provider', async () => {
    mockFetchForProviders();
    render(<RefinerSettings {...defaultProps} />);
    expandSection();

    await waitFor(() => {
      expect(screen.getByDisplayValue('http://localhost:11434')).toBeInTheDocument();
    });
  });

  it('toggle enables and disables refiner', async () => {
    mockFetchForProviders();
    const onUpdate = vi.fn();
    render(<RefinerSettings {...defaultProps} onUpdate={onUpdate} />);
    expandSection();

    const checkbox = screen.getByLabelText(/enable text refinement/i);
    fireEvent.click(checkbox);

    expect(onUpdate).toHaveBeenCalledWith({
      refiner: { ...DEFAULT_SETTINGS.refiner, enabled: true },
    });
  });

  it('test button calls refiner test endpoint', async () => {
    const fetchSpy = mockFetchForProviders();
    render(<RefinerSettings {...defaultProps} />);
    expandSection();

    const testBtn = screen.getByTestId('test-refiner-btn');
    fireEvent.click(testBtn);

    await waitFor(() => {
      const testCall = fetchSpy.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('/refiner/test'),
      );
      expect(testCall).toBeTruthy();
    });

    await waitFor(() => {
      expect(screen.getByText(/150ms via ollama/i)).toBeInTheDocument();
    });
  });

  it('refresh button re-fetches models', async () => {
    const fetchSpy = mockFetchForProviders();
    render(<RefinerSettings {...defaultProps} />);
    expandSection();

    await waitFor(() => {
      expect(screen.getByTitle('Refresh model list')).toBeInTheDocument();
    });

    const refreshBtn = screen.getByTitle('Refresh model list');
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      const modelCalls = fetchSpy.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('/models'),
      );
      expect(modelCalls.length).toBeGreaterThanOrEqual(2);
    });
  });
});
