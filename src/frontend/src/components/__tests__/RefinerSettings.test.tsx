import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RefinerSettings } from '../RefinerSettings.tsx';
import { DEFAULT_SETTINGS } from '../../types/index.ts';
import type { AppSettings } from '../../types/index.ts';

function makeSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return { ...DEFAULT_SETTINGS, ...overrides };
}

describe('RefinerSettings', () => {
  const defaultProps = {
    settings: makeSettings(),
    onUpdate: vi.fn(),
    backendUrl: 'ws://localhost:8765',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset fetch mock
    vi.restoreAllMocks();
  });

  function expandSection() {
    const toggle = screen.getByText(/text refiner/i);
    fireEvent.click(toggle);
  }

  it('renders provider dropdown with 3 options', () => {
    render(<RefinerSettings {...defaultProps} />);
    expandSection();

    const select = screen.getByDisplayValue('Ollama (Local)');
    expect(select).toBeInTheDocument();

    const options = select.querySelectorAll('option');
    expect(options).toHaveLength(3);
    expect(options[0].textContent).toBe('Ollama (Local)');
    expect(options[1].textContent).toBe('Groq (Cloud)');
    expect(options[2].textContent).toBe('Gemini (Cloud)');
  });

  it('shows api key input for groq', () => {
    const settings = makeSettings({
      refiner: { enabled: true, provider: 'groq', customPrompt: '' },
    });
    render(<RefinerSettings {...defaultProps} settings={settings} />);
    expandSection();

    expect(screen.getByPlaceholderText(/enter api key/i)).toBeInTheDocument();
    expect(screen.getByText(/groq api key/i)).toBeInTheDocument();
  });

  it('shows api key input for gemini', () => {
    const settings = makeSettings({
      refiner: { enabled: true, provider: 'gemini', customPrompt: '' },
    });
    render(<RefinerSettings {...defaultProps} settings={settings} />);
    expandSection();

    expect(screen.getByPlaceholderText(/enter api key/i)).toBeInTheDocument();
    expect(screen.getByText(/gemini api key/i)).toBeInTheDocument();
  });

  it('shows ollama url input and no api key for ollama', () => {
    render(<RefinerSettings {...defaultProps} />);
    expandSection();

    expect(screen.getByDisplayValue('http://localhost:11434')).toBeInTheDocument();
    expect(screen.getByDisplayValue('llama3.2')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/enter api key/i)).not.toBeInTheDocument();
  });

  it('toggle enables and disables refiner', () => {
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
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          raw_text: 'test input',
          refined_text: 'Test input.',
          provider: 'ollama',
          model: 'llama3.2',
          processing_time_ms: 150,
          tokens_used: 10,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    render(<RefinerSettings {...defaultProps} />);
    expandSection();

    const testBtn = screen.getByTestId('test-refiner-btn');
    fireEvent.click(testBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:8765/refiner/test',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/150ms via ollama/i)).toBeInTheDocument();
    });
  });
});
