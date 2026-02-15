import { useState, useRef, useEffect } from 'react';
import type { TranscriptionResult } from '../types/index.ts';
import './TranscriptionDisplay.css';

interface TranscriptionDisplayProps {
  lastResult: TranscriptionResult | null;
  notificationsEnabled?: boolean;
  autoCopy?: boolean;
  typeToKeyboard?: boolean;
  backendUrl?: string;
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function confidenceBadgeClass(confidence: number): string {
  if (confidence >= 0.9) return 'confidence-badge--high';
  if (confidence >= 0.7) return 'confidence-badge--medium';
  return 'confidence-badge--low';
}

export function TranscriptionDisplay({
  lastResult,
  notificationsEnabled = false,
  autoCopy = false,
  typeToKeyboard = false,
  backendUrl = 'ws://localhost:8765',
}: TranscriptionDisplayProps) {
  const [history, setHistory] = useState<TranscriptionResult[]>([]);
  const [editText, setEditText] = useState('');
  const [copied, setCopied] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);
  const prevResultRef = useRef<TranscriptionResult | null>(null);

  // Request notification permission when enabled
  useEffect(() => {
    if (notificationsEnabled && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [notificationsEnabled]);

  useEffect(() => {
    if (lastResult && lastResult.text.trim() && lastResult !== prevResultRef.current) {
      prevResultRef.current = lastResult;
      setEditText(lastResult.text);
      setHistory((prev) => {
        const updated = [lastResult, ...prev];
        return updated.slice(0, 10);
      });

      // Auto-copy to clipboard
      if (autoCopy && navigator.clipboard) {
        navigator.clipboard.writeText(lastResult.text).catch(() => {
          // Clipboard API may not be available
        });
      }

      // Type to keyboard via backend emulation
      if (typeToKeyboard) {
        const httpUrl = backendUrl
          .replace('ws://', 'http://')
          .replace('wss://', 'https://');
        fetch(`${httpUrl}/keyboard/type`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: lastResult.text }),
        }).catch(() => {
          // Keyboard typing is best-effort
        });
      }

      // Browser notification
      if (notificationsEnabled && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('BACON-AI Voice', {
          body: lastResult.text.slice(0, 100),
          tag: 'bacon-voice-transcription',
        });
      }
    }
  }, [lastResult, autoCopy, notificationsEnabled, typeToKeyboard, backendUrl]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(editText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may not be available
    }
  };

  if (!lastResult && history.length === 0) {
    return (
      <div className="transcription-display">
        <div className="transcription-empty">
          No transcriptions yet. Start recording to see results here.
        </div>
      </div>
    );
  }

  return (
    <div className="transcription-display">
      {lastResult && (
        <div className="transcription-current">
          <div className="transcription-current__header">
            <span className="transcription-current__title">Latest Transcription</span>
            <span className={`confidence-badge ${confidenceBadgeClass(lastResult.confidence)}`}>
              {Math.round(lastResult.confidence * 100)}%
            </span>
          </div>

          <textarea
            className="transcription-current__editor"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={3}
          />

          <div className="transcription-current__actions">
            <button className="btn btn--primary" onClick={handleCopy}>
              {copied ? 'Copied!' : 'Copy to Clipboard'}
            </button>
            <span className="transcription-current__meta">
              {lastResult.language} | {lastResult.duration.toFixed(1)}s
            </span>
          </div>
        </div>
      )}

      {history.length > 1 && (
        <div className="transcription-history" ref={historyRef}>
          <div className="transcription-history__title">History</div>
          {history.slice(1).map((result, index) => (
            <div key={`${result.timestamp}-${index}`} className="transcription-history__entry">
              <div className="transcription-history__text">{result.text}</div>
              <div className="transcription-history__meta">
                <span className={`confidence-badge confidence-badge--small ${confidenceBadgeClass(result.confidence)}`}>
                  {Math.round(result.confidence * 100)}%
                </span>
                <span>{formatTimestamp(result.timestamp)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
