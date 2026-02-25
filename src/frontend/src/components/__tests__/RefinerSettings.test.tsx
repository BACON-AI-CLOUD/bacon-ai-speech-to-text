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

function mockFetchForProviders() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
    const urlStr = typeof url === 'string' ? url : url.toString();
    if (urlStr.includes('/refiner/providers/') && urlStr.includes('/models')) {
      return Promise.resolve(
        new Response(JSON.stringify([{ id: 'llama3.2', name: 'llama3.2' }]), {
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

  it('renders collapsed by default', () => {
    mockFetchForProviders();
    render(<RefinerSettings {...defaultProps} />);
    expect(screen.queryByPlaceholderText(/enter api key/i)).not.toBeInTheDocument();
  });

  it('expands on toggle click', () => {
    mockFetchForProviders();
    render(<RefinerSettings {...defaultProps} />);
    expandSection();
    expect(screen.getByText(/quick controls/i)).toBeInTheDocument();
  });

  it('shows quick controls hint instead of duplicate dropdowns', () => {
    mockFetchForProviders();
    render(<RefinerSettings {...defaultProps} />);
    expandSection();
    expect(screen.getByText(/quick controls/i)).toBeInTheDocument();
    // Provider and model dropdowns removed - not present
    expect(screen.queryByText(/^Provider$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Model$/i)).not.toBeInTheDocument();
  });

  it('shows api key input for cloud providers', async () => {
    mockFetchForProviders();
    const settings = makeSettings({
      refiner: { enabled: true, provider: 'groq', model: '', customPrompt: '', promptTemplate: 'cleanup' },
    });
    render(<RefinerSettings {...defaultProps} settings={settings} />);
    expandSection();

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/enter api key/i)).toBeInTheDocument();
    });
  });

  it('does not show api key input for ollama', () => {
    mockFetchForProviders();
    render(<RefinerSettings {...defaultProps} />);
    expandSection();
    expect(screen.queryByPlaceholderText(/enter api key/i)).not.toBeInTheDocument();
  });

  it('shows ollama host url for ollama provider', async () => {
    mockFetchForProviders();
    render(<RefinerSettings {...defaultProps} />);
    expandSection();

    await waitFor(() => {
      expect(screen.getByDisplayValue('http://localhost:11434')).toBeInTheDocument();
    });
  });

  it('shows test connection button', () => {
    mockFetchForProviders();
    render(<RefinerSettings {...defaultProps} />);
    expandSection();
    expect(screen.getByTestId('test-connection-btn')).toBeInTheDocument();
  });

  it('shows save and test refiner buttons', () => {
    mockFetchForProviders();
    render(<RefinerSettings {...defaultProps} />);
    expandSection();
    expect(screen.getByText('Save to Backend')).toBeInTheDocument();
    expect(screen.getByTestId('test-refiner-btn')).toBeInTheDocument();
  });

  it('test button calls refiner test endpoint', async () => {
    const fetchSpy = mockFetchForProviders();
    render(<RefinerSettings {...defaultProps} />);
    expandSection();

    fireEvent.click(screen.getByTestId('test-refiner-btn'));

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

  it('shows prompt editor toggle', () => {
    mockFetchForProviders();
    render(<RefinerSettings {...defaultProps} />);
    expandSection();
    expect(screen.getByText(/view \/ edit prompt/i)).toBeInTheDocument();
  });
});
