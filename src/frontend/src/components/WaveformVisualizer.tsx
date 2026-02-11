import { useRef, useEffect } from 'react';
import './WaveformVisualizer.css';

interface WaveformVisualizerProps {
  audioStream: MediaStream | null;
  isRecording: boolean;
}

export function WaveformVisualizer({ audioStream, isRecording }: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas resolution to match display size
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    if (audioStream && isRecording) {
      // Create audio context and analyser
      const audioCtx = new AudioContext();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      const source = audioCtx.createMediaStreamSource(audioStream);
      source.connect(analyser);

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        animationRef.current = requestAnimationFrame(draw);
        analyser.getByteTimeDomainData(dataArray);

        const width = rect.width;
        const height = rect.height;

        ctx.fillStyle = '#0d0d1a';
        ctx.fillRect(0, 0, width, height);

        ctx.lineWidth = 2;
        ctx.strokeStyle = '#4caf50';
        ctx.beginPath();

        const sliceWidth = width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * height) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }

        ctx.lineTo(width, height / 2);
        ctx.stroke();
      };

      draw();

      return () => {
        cancelAnimationFrame(animationRef.current);
        source.disconnect();
        audioCtx.close();
        audioContextRef.current = null;
        analyserRef.current = null;
      };
    } else {
      // Draw flat line when idle
      const width = rect.width;
      const height = rect.height;

      ctx.fillStyle = '#0d0d1a';
      ctx.fillRect(0, 0, width, height);

      ctx.lineWidth = 1;
      ctx.strokeStyle = '#333';
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      return () => {
        cancelAnimationFrame(animationRef.current);
      };
    }
  }, [audioStream, isRecording]);

  return (
    <div className="waveform-visualizer">
      <canvas ref={canvasRef} className="waveform-canvas" />
    </div>
  );
}
