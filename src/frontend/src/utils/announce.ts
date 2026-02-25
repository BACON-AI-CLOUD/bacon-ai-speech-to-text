/**
 * Play a TTS announcement via the BACON-AI backend edge-tts endpoint.
 *
 * Calls POST /discuss/announce, receives an audio_url, then plays the MP3
 * in the browser using the Web Audio API. Awaitable — resolves when playback
 * ends (or on any error, so it never blocks the calling flow).
 */
export async function playAnnouncement(
  httpUrl: string,
  message: string,
  voice = 'en-GB-SoniaNeural',
): Promise<void> {
  if (!message.trim()) return;
  try {
    const resp = await fetch(`${httpUrl}/discuss/announce`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: message.trim(), voice }),
    });
    const data = await resp.json();
    if (data.audio_url) {
      await new Promise<void>((resolve) => {
        const audio = new Audio(httpUrl + data.audio_url);
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        audio.play().catch(() => resolve());
      });
    }
  } catch {
    // Never block the recording flow due to a voice error
  }
}
