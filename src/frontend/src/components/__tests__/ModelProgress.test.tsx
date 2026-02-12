import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ModelProgress } from '../ModelProgress.tsx';

describe('ModelProgress', () => {
  it('renders progress bar with percentage and model name', () => {
    render(
      <ModelProgress
        progress={{ modelName: 'large-v3', percentage: 45, downloading: true }}
      />,
    );

    expect(screen.getByText('large-v3')).toBeInTheDocument();
    expect(screen.getByText('45%')).toBeInTheDocument();
  });

  it('renders nothing when progress is null', () => {
    const { container } = render(<ModelProgress progress={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when not downloading', () => {
    const { container } = render(
      <ModelProgress
        progress={{ modelName: 'base', percentage: 100, downloading: false }}
      />,
    );
    expect(container.innerHTML).toBe('');
  });
});
