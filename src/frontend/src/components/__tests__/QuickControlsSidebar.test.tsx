import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuickControlsSidebar } from '../QuickControlsSidebar.tsx';
import type { AppSettings } from '../../types/index.ts';
import { DEFAULT_SETTINGS } from '../../types/index.ts';

// Suppress act() warnings from async fetch mocks
vi.spyOn(console, 'error').mockImplementation(() => {});

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve([]),
});

const mockSettings: AppSettings = {
  ...DEFAULT_SETTINGS,
  refiner: {
    enabled: true,
    provider: 'ollama',
    model: 'llama3.2',
    promptTemplate: 'cleanup',
    customPrompt: '',
  },
  autoCopy: false,
  typeToKeyboard: false,
  targetWindow: '',
  notificationsEnabled: false,
  discussMode: false,
};

describe('QuickControlsSidebar', () => {
  const onUpdate = vi.fn();
  const onToggle = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders toggle button', () => {
    render(
      <QuickControlsSidebar
        settings={mockSettings}
        onUpdate={onUpdate}
        backendUrl="ws://localhost:8702"
        isOpen={false}
        onToggle={onToggle}
      />,
    );
    expect(screen.getByLabelText('Open quick controls')).toBeDefined();
  });

  it('calls onToggle when toggle button is clicked', () => {
    render(
      <QuickControlsSidebar
        settings={mockSettings}
        onUpdate={onUpdate}
        backendUrl="ws://localhost:8702"
        isOpen={false}
        onToggle={onToggle}
      />,
    );
    fireEvent.click(screen.getByLabelText('Open quick controls'));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('shows sidebar content when open', () => {
    render(
      <QuickControlsSidebar
        settings={mockSettings}
        onUpdate={onUpdate}
        backendUrl="ws://localhost:8702"
        isOpen={true}
        onToggle={onToggle}
      />,
    );
    expect(screen.getByText('Quick Controls')).toBeDefined();
    expect(screen.getByText('Refiner')).toBeDefined();
    expect(screen.getByText('Output')).toBeDefined();
  });

  it('shows refiner tab controls by default', () => {
    render(
      <QuickControlsSidebar
        settings={mockSettings}
        onUpdate={onUpdate}
        backendUrl="ws://localhost:8702"
        isOpen={true}
        onToggle={onToggle}
      />,
    );
    expect(screen.getByText('Enable Refiner')).toBeDefined();
    expect(screen.getByText('Provider')).toBeDefined();
    expect(screen.getByText('Model')).toBeDefined();
    expect(screen.getByText('Template')).toBeDefined();
  });

  it('switches to output tab on click', () => {
    render(
      <QuickControlsSidebar
        settings={mockSettings}
        onUpdate={onUpdate}
        backendUrl="ws://localhost:8702"
        isOpen={true}
        onToggle={onToggle}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Output' }));
    expect(screen.getByText('Auto-copy')).toBeDefined();
    expect(screen.getByText('Type to keyboard')).toBeDefined();
    expect(screen.getByText('Notifications')).toBeDefined();
  });

  it('calls onUpdate when enable refiner checkbox changes', () => {
    render(
      <QuickControlsSidebar
        settings={mockSettings}
        onUpdate={onUpdate}
        backendUrl="ws://localhost:8702"
        isOpen={true}
        onToggle={onToggle}
      />,
    );
    const checkbox = screen.getByRole('checkbox', { name: /enable refiner/i });
    fireEvent.click(checkbox);
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ refiner: expect.objectContaining({ enabled: false }) }),
    );
  });

  it('shows target window input when type to keyboard is enabled', () => {
    render(
      <QuickControlsSidebar
        settings={{ ...mockSettings, typeToKeyboard: true }}
        onUpdate={onUpdate}
        backendUrl="ws://localhost:8702"
        isOpen={true}
        onToggle={onToggle}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Output' }));
    expect(screen.getByPlaceholderText('Or type partial title')).toBeDefined();
  });

  it('has closed aria-label when open', () => {
    render(
      <QuickControlsSidebar
        settings={mockSettings}
        onUpdate={onUpdate}
        backendUrl="ws://localhost:8702"
        isOpen={true}
        onToggle={onToggle}
      />,
    );
    expect(screen.getByLabelText('Close quick controls')).toBeDefined();
  });
});
