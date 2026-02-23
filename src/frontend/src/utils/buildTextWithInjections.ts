import type { SuffixInjection } from '../types';

/**
 * Appends active suffix injection prompts to the given text.
 * Returns original text unchanged if no injections are enabled.
 */
export function buildTextWithInjections(text: string, injections: SuffixInjection[]): string {
  const active = injections.filter(i => i.enabled);
  if (active.length === 0) return text;
  return `${text}\n\n---\n\n${active.map(i => i.text).join('\n\n')}`;
}
