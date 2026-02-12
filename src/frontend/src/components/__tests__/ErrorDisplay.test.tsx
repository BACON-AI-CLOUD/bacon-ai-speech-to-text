import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorDisplay } from '../ErrorDisplay.tsx';

describe('ErrorDisplay', () => {
  it('renders connection error with correct category class', () => {
    const { container } = render(
      <ErrorDisplay error="WebSocket connection error" autoDismissMs={60000} />,
    );

    const toast = container.querySelector('.error-toast--connection');
    expect(toast).toBeInTheDocument();
  });

  it('renders permission error with correct category class', () => {
    const { container } = render(
      <ErrorDisplay error="Microphone permission denied" autoDismissMs={60000} />,
    );

    const toast = container.querySelector('.error-toast--permission');
    expect(toast).toBeInTheDocument();
  });

  it('renders retry button and calls onRetry when clicked', () => {
    const onRetry = vi.fn();
    render(
      <ErrorDisplay
        error="WebSocket connection error"
        autoDismissMs={60000}
        onRetry={onRetry}
      />,
    );

    const retryBtn = screen.getByText('Retry');
    expect(retryBtn).toBeInTheDocument();

    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('dismisses toast when dismiss button is clicked', () => {
    render(
      <ErrorDisplay error="Some error occurred" autoDismissMs={60000} />,
    );

    expect(screen.getByText('Some error occurred')).toBeInTheDocument();

    const dismissBtn = screen.getByLabelText('Dismiss');
    fireEvent.click(dismissBtn);

    expect(screen.queryByText('Some error occurred')).not.toBeInTheDocument();
  });
});
