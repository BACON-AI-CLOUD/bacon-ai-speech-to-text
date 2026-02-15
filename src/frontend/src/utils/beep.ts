/**
 * Simple beep generator using Web Audio API.
 * All timing/frequency/volume values come from AppSettings.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new AudioContext();
  }
  // Resume if suspended (browser autoplay policy)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Pre-warm the AudioContext on a user gesture (click/keypress).
 * Call this once from a click handler so future programmatic
 * playback (e.g. from WebSocket events) is allowed.
 */
export function warmUpAudio(): void {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
}

export function playBeep(
  frequency: number,
  duration: number,
  volume: number,
): Promise<void> {
  return new Promise((resolve) => {
    try {
      const ctx = getAudioContext();
      // Don't await resume - it may block without user gesture.
      // Just fire and forget; the beep plays once ctx is running.
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
      gainNode.gain.setValueAtTime(volume, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration);

      // Use setTimeout as primary timer - onended may not fire if ctx is suspended
      setTimeout(resolve, duration * 1000 + 50);
    } catch {
      resolve();
    }
  });
}

export interface CountdownConfig {
  count: number;          // Number of beeps (e.g. 3)
  intervalMs: number;     // Delay between beeps in ms
  freqStart: number;      // First beep frequency
  freqEnd: number;        // Last beep frequency (ramps up)
  duration: number;       // Each beep duration in seconds
  volume: number;         // Volume 0.0 - 1.0
}

/**
 * Play countdown beeps with configurable parameters.
 * Calls onCount(n) for each step (n, n-1, ... 1, then 0 when done).
 */
export async function playCountdownBeeps(
  config: CountdownConfig,
  onCount: (n: number) => void,
): Promise<void> {
  const { count, intervalMs, freqStart, freqEnd, duration, volume } = config;

  if (count <= 0) {
    onCount(0);
    return;
  }

  for (let i = count; i >= 1; i--) {
    onCount(i);
    // Linearly interpolate frequency from start to end
    const t = count === 1 ? 1 : (count - i) / (count - 1);
    const freq = freqStart + t * (freqEnd - freqStart);
    await playBeep(freq, duration, volume);
    if (i > 1) {
      await delay(intervalMs);
    } else {
      // Shorter pause after the final beep before mic goes live
      await delay(Math.min(intervalMs, 400));
    }
  }

  onCount(0);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
