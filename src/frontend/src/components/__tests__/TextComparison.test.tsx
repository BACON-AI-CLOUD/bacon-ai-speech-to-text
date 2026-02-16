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

  it('shows raw and refined side by side', () => {
    render(<TextComparison {...defaultProps} />);

    expect(screen.getByText('hello world this is raw text')).toBeInTheDocument();
    expect(screen.getByText('Hello world, this is raw text.')).toBeInTheDocument();
    expect(screen.getByText('Raw', { selector: '.text-comparison__panel-title' })).toBeInTheDocument();
    expect(screen.getByText('Refined', { selector: '.text-comparison__panel-title' })).toBeInTheDocument();
  });

  it('shows only raw when no refined text', () => {
    render(<TextComparison {...defaultProps} refinedText={null} />);

    expect(screen.getByText('hello world this is raw text')).toBeInTheDocument();
    expect(screen.getByText('Use Text')).toBeInTheDocument();
    expect(screen.queryByText('Use Refined')).not.toBeInTheDocument();
  });

  it('copy button copies to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    render(<TextComparison {...defaultProps} />);

    const copyRawBtn = screen.getByTestId('copy-raw');
    fireEvent.click(copyRawBtn);

    expect(writeText).toHaveBeenCalledWith('hello world this is raw text');
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

  it('calls onSelectText when use button clicked', () => {
    const onSelectText = vi.fn();
    render(<TextComparison {...defaultProps} onSelectText={onSelectText} />);

    fireEvent.click(screen.getByText('Use Refined'));

    expect(onSelectText).toHaveBeenCalledWith('Hello world, this is raw text.');
  });
});
