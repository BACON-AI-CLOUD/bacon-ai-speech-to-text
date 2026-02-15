import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsPanel } from '../SettingsPanel.tsx';
import { DEFAULT_SETTINGS } from '../../types/index.ts';
import type { AppSettings } from '../../types/index.ts';

function makePTTSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    activationMode: 'push-to-talk',
    ...overrides,
  };
}

describe('SettingsPanel', () => {
  const defaultProps = {
    settings: DEFAULT_SETTINGS,
    onUpdate: vi.fn(),
    onReset: vi.fn(),
    isOpen: true,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // === FEAT-010: Key Capture Widget ===

  it('shows key capture button in listening mode on click', () => {
    const settings = makePTTSettings({ hotkey: 'Space' });
    render(
      <SettingsPanel {...defaultProps} settings={settings} />,
    );

    // Find key capture button showing "Space"
    const captureBtn = screen.getByText('Space');
    fireEvent.click(captureBtn);

    expect(screen.getByText('Press a key...')).toBeInTheDocument();
  });

  it('captures keydown and updates settings', () => {
    const onUpdate = vi.fn();
    const settings = makePTTSettings({ hotkey: 'Space' });
    render(
      <SettingsPanel {...defaultProps} settings={settings} onUpdate={onUpdate} />,
    );

    fireEvent.click(screen.getByText('Space'));

    // Now press a key on window
    fireEvent.keyDown(window, { code: 'KeyF', key: 'f' });

    expect(onUpdate).toHaveBeenCalledWith({ hotkey: 'KeyF' });
  });

  it('cancels capture on Escape', () => {
    const onUpdate = vi.fn();
    const settings = makePTTSettings({ hotkey: 'Space' });
    render(
      <SettingsPanel {...defaultProps} settings={settings} onUpdate={onUpdate} />,
    );

    fireEvent.click(screen.getByText('Space'));

    expect(screen.getByText('Press a key...')).toBeInTheDocument();

    // Press Escape
    fireEvent.keyDown(window, { code: 'Escape', key: 'Escape' });

    // Should exit listening mode without updating
    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.getByText('Space')).toBeInTheDocument();
  });

  // === FEAT-012: Settings Import/Export ===

  it('calls onExport when export button is clicked', () => {
    const onExport = vi.fn();
    render(
      <SettingsPanel {...defaultProps} onExport={onExport} />,
    );

    fireEvent.click(screen.getByText('Export Settings'));

    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it('shows success feedback after valid import', async () => {
    const onImport = vi.fn().mockResolvedValue(true);
    render(
      <SettingsPanel {...defaultProps} onImport={onImport} />,
    );

    // Find the hidden file input and simulate file selection
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(
      [JSON.stringify({ selectedModel: 'small' })],
      'settings.json',
      { type: 'application/json' },
    );

    Object.defineProperty(fileInput, 'files', { value: [file] });
    fireEvent.change(fileInput);

    await waitFor(() => {
      expect(screen.getByText('Settings imported successfully.')).toBeInTheDocument();
    });
  });

  it('shows error feedback after invalid import', async () => {
    const onImport = vi.fn().mockResolvedValue(false);
    render(
      <SettingsPanel {...defaultProps} onImport={onImport} />,
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(
      ['not valid json'],
      'bad.json',
      { type: 'application/json' },
    );

    Object.defineProperty(fileInput, 'files', { value: [file] });
    fireEvent.change(fileInput);

    await waitFor(() => {
      expect(
        screen.getByText('Failed to import settings. Invalid file format.'),
      ).toBeInTheDocument();
    });
  });

  it('returns null when isOpen is false', () => {
    const { container } = render(
      <SettingsPanel {...defaultProps} isOpen={false} />,
    );
    expect(container.innerHTML).toBe('');
  });
});
