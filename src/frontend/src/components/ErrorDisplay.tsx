import { useState, useEffect, useRef } from 'react';
import './ErrorDisplay.css';

interface ErrorDisplayProps {
  error: string | null;
  autoDismissMs?: number;
}

interface Toast {
  id: number;
  message: string;
}

let nextId = 0;

export function ErrorDisplay({ error, autoDismissMs = 5000 }: ErrorDisplayProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const lastErrorRef = useRef<string | null>(null);

  useEffect(() => {
    if (error && error !== lastErrorRef.current) {
      lastErrorRef.current = error;
      const id = nextId++;
      setToasts((prev) => [...prev, { id, message: error }]);

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
        <div key={toast.id} className="error-toast">
          <span className="error-toast__icon">!</span>
          <span className="error-toast__message">{toast.message}</span>
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
