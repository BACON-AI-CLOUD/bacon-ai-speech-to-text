import { useState, useEffect, useRef } from 'react';
import type { ErrorCategory } from '../types/index.ts';
import './ErrorDisplay.css';

interface ErrorDisplayProps {
  error: string | null;
  autoDismissMs?: number;
  onRetry?: () => void;
}

interface Toast {
  id: number;
  message: string;
  category: ErrorCategory;
}

let nextId = 0;

function categorizeError(message: string): ErrorCategory {
  const lower = message.toLowerCase();
  if (
    lower.includes('websocket') ||
    lower.includes('connection') ||
    lower.includes('backend') ||
    lower.includes('offline') ||
    lower.includes('reconnect')
  ) {
    return 'connection';
  }
  if (
    lower.includes('permission') ||
    lower.includes('denied') ||
    lower.includes('microphone') ||
    lower.includes('not allowed')
  ) {
    return 'permission';
  }
  if (
    lower.includes('model') ||
    lower.includes('transcri') ||
    lower.includes('whisper') ||
    lower.includes('audio')
  ) {
    return 'transcription';
  }
  return 'unknown';
}

function categoryIcon(category: ErrorCategory): string {
  switch (category) {
    case 'connection':
      return '\u26A1'; // lightning bolt (connection)
    case 'permission':
      return '\uD83D\uDD12'; // lock
    case 'transcription':
      return '\u26A0'; // warning triangle
    case 'unknown':
      return '!';
  }
}

export function ErrorDisplay({ error, autoDismissMs = 5000, onRetry }: ErrorDisplayProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const lastErrorRef = useRef<string | null>(null);

  useEffect(() => {
    if (error && error !== lastErrorRef.current) {
      lastErrorRef.current = error;
      const id = nextId++;
      const category = categorizeError(error);
      setToasts((prev) => [...prev, { id, message: error, category }]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, autoDismissMs);
    }

    if (!error) {
      lastErrorRef.current = null;
    }
  }, [error, autoDismissMs]);

  const dismiss = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="error-display">
      {toasts.map((toast) => (
        <div key={toast.id} className={`error-toast error-toast--${toast.category}`}>
          <span className="error-toast__icon">{categoryIcon(toast.category)}</span>
          <span className="error-toast__message">{toast.message}</span>
          {onRetry && toast.category !== 'unknown' && (
            <button
              className="error-toast__retry"
              onClick={onRetry}
              aria-label="Retry"
            >
              Retry
            </button>
          )}
          <button
            className="error-toast__dismiss"
            onClick={() => dismiss(toast.id)}
            aria-label="Dismiss"
          >
            x
          </button>
        </div>
      ))}
    </div>
  );
}
