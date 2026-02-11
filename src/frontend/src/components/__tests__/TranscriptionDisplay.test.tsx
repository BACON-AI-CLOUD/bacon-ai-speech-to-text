import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TranscriptionDisplay } from '../TranscriptionDisplay.tsx';
import type { TranscriptionResult } from '../../types/index.ts';

function makeResult(overrides: Partial<TranscriptionResult> = {}): TranscriptionResult {
  return {
    text: 'Hello world, this is a test transcription.',
    confidence: 0.92,
    language: 'en',
    duration: 2.5,
    segments: [],
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('TranscriptionDisplay', () => {
  it('renders empty state when no results exist', () => {
    render(<TranscriptionDisplay lastResult={null} />);

    expect(screen.getByText(/no transcriptions yet/i)).toBeInTheDocument();
  });

  it('renders a transcription result with text and confidence', () => {
    const result = makeResult({ text: 'Test speech to text', confidence: 0.88 });

    render(<TranscriptionDisplay lastResult={result} />);

    expect(screen.getByText(/latest transcription/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test speech to text')).toBeInTheDocument();
    expect(screen.getByText('88%')).toBeInTheDocument();
  });

  it('allows editing the transcription text', () => {
    const result = makeResult({ text: 'Original text' });

    render(<TranscriptionDisplay lastResult={result} />);

    const textarea = screen.getByDisplayValue('Original text');
    fireEvent.change(textarea, { target: { value: 'Corrected text' } });

    expect(screen.getByDisplayValue('Corrected text')).toBeInTheDocument();
  });

  it('shows high confidence badge for >= 90%', () => {
    const result = makeResult({ confidence: 0.95 });

    const { container } = render(<TranscriptionDisplay lastResult={result} />);

    const badge = container.querySelector('.confidence-badge--high');
    expect(badge).toBeInTheDocument();
    expect(badge?.textContent).toBe('95%');
  });

  it('shows medium confidence badge for 70-89%', () => {
    const result = makeResult({ confidence: 0.75 });

    const { container } = render(<TranscriptionDisplay lastResult={result} />);

    const badge = container.querySelector('.confidence-badge--medium');
    expect(badge).toBeInTheDocument();
    expect(badge?.textContent).toBe('75%');
  });

  it('shows low confidence badge for < 70%', () => {
    const result = makeResult({ confidence: 0.45 });

    const { container } = render(<TranscriptionDisplay lastResult={result} />);

    const badge = container.querySelector('.confidence-badge--low');
    expect(badge).toBeInTheDocument();
    expect(badge?.textContent).toBe('45%');
  });

  it('displays language and duration metadata', () => {
    const result = makeResult({ language: 'de', duration: 3.7 });

    render(<TranscriptionDisplay lastResult={result} />);

    expect(screen.getByText(/de/)).toBeInTheDocument();
    expect(screen.getByText(/3\.7s/)).toBeInTheDocument();
  });
});
