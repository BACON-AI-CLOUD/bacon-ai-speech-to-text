import { useState, useRef, useCallback, useEffect } from 'react';

interface UseVADOptions {
  /** Audio stream to monitor for voice activity */
  audioStream: MediaStream | null;
  /** RMS threshold above which speech is detected (0.0 - 1.0) */
  vadThreshold: number;
  /** Milliseconds of silence before stopping (e.g., 1500) */
  silenceTimeout: number;
  /** Whether VAD monitoring is enabled */
  enabled: boolean;
  /** Start in speaking state (skip onset detection, immediately monitor for silence) */
  assumeSpeaking?: boolean;
  /** Called when speech onset is detected */
  onSpeechStart: () => void;
  /** Called when silence is detected after speech */
  onSpeechEnd: () => void;
}

interface UseVADReturn {
  /** Current RMS audio level (0.0 - 1.0) */
  audioLevel: number;
  /** Whether voice activity is currently detected */
  isSpeaking: boolean;
}

export function useVAD({
  audioStream,
  vadThreshold,
  silenceTimeout,
  enabled,
  assumeSpeaking = false,
  onSpeechStart,
  onSpeechEnd,
}: UseVADOptions): UseVADReturn {
  const [audioLevel, setAudioLevel] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const isSpeakingRef = useRef(false);
  const speechStartTimeRef = useRef<number | null>(null);
  const silenceStartTimeRef = useRef<number | null>(null);

  // Keep callback refs stable to avoid re-registering effects
  const onSpeechStartRef = useRef(onSpeechStart);
  const onSpeechEndRef = useRef(onSpeechEnd);
  onSpeechStartRef.current = onSpeechStart;
  onSpeechEndRef.current = onSpeechEnd;

  const vadThresholdRef = useRef(vadThreshold);
  const silenceTimeoutRef = useRef(silenceTimeout);
  vadThresholdRef.current = vadThreshold;
  silenceTimeoutRef.current = silenceTimeout;

  const cleanup = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setAudioLevel(0);
    setIsSpeaking(false);
    isSpeakingRef.current = false;
    speechStartTimeRef.current = null;
    silenceStartTimeRef.current = null;
  }, []);

  useEffect(() => {
    console.log('[VAD] Effect run: enabled=', enabled, 'audioStream=', !!audioStream, 'assumeSpeaking=', assumeSpeaking);
    if (!enabled || !audioStream) {
      cleanup();
      return;
    }

    // Create audio context and analyser
    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;

    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.3;
    analyserRef.current = analyser;

    const source = audioContext.createMediaStreamSource(audioStream);
    source.connect(analyser);
    sourceRef.current = source;

    // If assumeSpeaking, start in speaking state to immediately monitor for silence
    if (assumeSpeaking) {
      console.log('[VAD] Starting in speaking state (assumeSpeaking=true)');
      isSpeakingRef.current = true;
      setIsSpeaking(true);
    }

    const dataArray = new Float32Array(analyser.fftSize);
    const SPEECH_ONSET_MS = 100; // Speech must persist for 100ms to trigger start

    const monitorAudio = () => {
      if (!analyserRef.current) return;

      analyserRef.current.getFloatTimeDomainData(dataArray);

      // Calculate RMS
      let sumSquares = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sumSquares += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sumSquares / dataArray.length);
      setAudioLevel(rms);

      const now = Date.now();
      const threshold = vadThresholdRef.current;
      const silTimeout = silenceTimeoutRef.current;

      if (rms > threshold) {
        // Audio above threshold
        silenceStartTimeRef.current = null;

        if (!isSpeakingRef.current) {
          // Track onset time
          if (speechStartTimeRef.current === null) {
            speechStartTimeRef.current = now;
          } else if (now - speechStartTimeRef.current >= SPEECH_ONSET_MS) {
            // Speech persisted long enough - trigger start
            isSpeakingRef.current = true;
            setIsSpeaking(true);
            onSpeechStartRef.current();
          }
        }
      } else {
        // Audio below threshold
        speechStartTimeRef.current = null;

        if (isSpeakingRef.current) {
          // Track silence onset
          if (silenceStartTimeRef.current === null) {
            silenceStartTimeRef.current = now;
          } else if (now - silenceStartTimeRef.current >= silTimeout) {
            // Silence persisted long enough - trigger stop
            console.log('[VAD] Silence detected, stopping. RMS:', rms, 'threshold:', threshold);
            isSpeakingRef.current = false;
            setIsSpeaking(false);
            onSpeechEndRef.current();
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(monitorAudio);
    };

    animFrameRef.current = requestAnimationFrame(monitorAudio);

    return cleanup;
  }, [enabled, audioStream, assumeSpeaking, cleanup]);

  return {
    audioLevel,
    isSpeaking,
  };
}
