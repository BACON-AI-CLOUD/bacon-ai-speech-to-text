import { useState, useRef, useCallback } from 'react';

type PermissionState = 'prompt' | 'granted' | 'denied' | 'error';

interface UseAudioCaptureOptions {
  onAudioData: (data: ArrayBuffer) => void;
  chunkInterval?: number;
}

interface UseAudioCaptureReturn {
  isRecording: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  audioStream: MediaStream | null;
  permissionState: PermissionState;
}

export function useAudioCapture({
  onAudioData,
  chunkInterval = 250,
}: UseAudioCaptureOptions): UseAudioCaptureReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [permissionState, setPermissionState] =
    useState<PermissionState>('prompt');
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    console.log('[AudioCapture] startRecording called, isRecording:', isRecording);
    if (isRecording) {
      console.log('[AudioCapture] Already recording, skipping');
      return;
    }

    try {
      console.log('[AudioCapture] Requesting getUserMedia...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });

      console.log('[AudioCapture] getUserMedia granted, setting up recorder');
      setPermissionState('granted');
      streamRef.current = stream;
      setAudioStream(stream);

      // Determine supported MIME type
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = ''; // Let browser pick default
        }
      }

      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );

      recorder.ondataavailable = async (event: BlobEvent) => {
        if (event.data.size > 0) {
          const buffer = await event.data.arrayBuffer();
          onAudioData(buffer);
        }
      };

      recorder.start(chunkInterval);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      console.log('[AudioCapture] Recording started successfully');
    } catch (err) {
      console.error('[AudioCapture] startRecording error:', err);
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setPermissionState('denied');
      } else {
        setPermissionState('error');
      }
    }
  }, [isRecording, onAudioData, chunkInterval]);

  const stopRecording = useCallback(() => {
    console.log('[AudioCapture] stopRecording called');
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setAudioStream(null);
    setIsRecording(false);
  }, []);

  return {
    isRecording,
    startRecording,
    stopRecording,
    audioStream,
    permissionState,
  };
}
