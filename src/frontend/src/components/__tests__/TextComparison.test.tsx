import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TextComparison } from '../TextComparison.tsx';

describe('TextComparison', () => {
  const defaultProps = {
    rawText: 'hello world this is raw text',
    refinedText: 'Hello world, this is raw text.',
    provider: 'ollama',
    processingTimeMs: 187,
    isRefining: false,
    error: null,
    onSelectText: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows refined text by default when available', () => {
    render(<TextComparison {...defaultProps} />);

    expect(screen.getByText('Hello world, this is raw text.')).toBeInTheDocument();
    expect(screen.getByText('Refined', { selector: '.text-comparison__panel-title' })).toBeInTheDocument();
  });

  it('shows raw text when checkbox unchecked', () => {
    render(<TextComparison {...defaultProps} />);

    const checkbox = screen.getByTestId('use-refined-checkbox');
    fireEvent.click(checkbox);

    expect(screen.getByText('hello world this is raw text')).toBeInTheDocument();
    expect(screen.getByText('Raw', { selector: '.text-comparison__panel-title' })).toBeInTheDocument();
  });

  it('shows only raw when no refined text', () => {
    render(<TextComparison {...defaultProps} refinedText={null} />);

    expect(screen.getByText('hello world this is raw text')).toBeInTheDocument();
    expect(screen.getByText('Use Text')).toBeInTheDocument();
  });

  it('copy button copies to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    render(<TextComparison {...defaultProps} />);

    const copyBtn = screen.getByTestId('copy-refined');
    fireEvent.click(copyBtn);

    expect(writeText).toHaveBeenCalledWith('Hello world, this is raw text.');
  });

  it('shows refining spinner', () => {
    render(<TextComparison {...defaultProps} isRefining={true} refinedText={null} />);

    expect(screen.getByText('Refining...')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows error message on failure', () => {
    render(
      <TextComparison
        {...defaultProps}
        refinedText={null}
        error="Ollama connection refused"
      />,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Ollama connection refused')).toBeInTheDocument();
  });
});
