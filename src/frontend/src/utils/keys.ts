/**
 * Convert keyboard event code values to human-readable names.
 */
export function formatKeyName(hotkey: string): string {
  const keyMap: Record<string, string> = {
    space: 'Space',
    controlleft: 'Left Ctrl',
    controlright: 'Right Ctrl',
    shiftleft: 'Left Shift',
    shiftright: 'Right Shift',
    altleft: 'Left Alt',
    altright: 'Right Alt',
  };
  const lower = hotkey.toLowerCase();
  if (keyMap[lower]) return keyMap[lower];
  // KeyF -> F, KeyA -> A
  if (lower.startsWith('key')) return hotkey.slice(3).toUpperCase();
  // Capitalize first letter
  return hotkey.charAt(0).toUpperCase() + hotkey.slice(1);
}
