import { useState, useRef, useEffect, useCallback } from 'react';
import type { TranscriptionResult } from '../types/index.ts';
import './TranscriptionDisplay.css';

interface TranscriptionDisplayProps {
  lastResult: TranscriptionResult | null;
  notificationsEnabled?: boolean;
  autoCopy?: boolean;
  typeToKeyboard?: boolean;
  typingAutoFocus?: boolean;
  targetWindow?: string;
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

function downloadAsMarkdown(result: TranscriptionResult) {
  const md = `# Transcription\n\n**Time:** ${new Date(result.timestamp).toLocaleString()}\n**Language:** ${result.language}\n**Confidence:** ${Math.round(result.confidence * 100)}%\n**Duration:** ${result.duration.toFixed(1)}s\n\n---\n\n${result.text}\n`;
  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `transcription-${new Date(result.timestamp).toISOString().slice(0, 19).replace(/:/g, '-')}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

export function TranscriptionDisplay({
  lastResult,
  notificationsEnabled = false,
  autoCopy = false,
  typeToKeyboard = false,
  typingAutoFocus = true,
  targetWindow = '',
  backendUrl = 'ws://localhost:8765',
}: TranscriptionDisplayProps) {
  const [history, setHistory] = useState<TranscriptionResult[]>([]);
  const [editText, setEditText] = useState('');
  const [copied, setCopied] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');
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
        return updated.slice(0, 50);
      });

      // Auto-copy to clipboard
      if (autoCopy && navigator.clipboard) {
        navigator.clipboard.writeText(lastResult.text).catch(() => {});
      }

      // Type to keyboard via backend emulation
      if (typeToKeyboard) {
        const httpUrl = backendUrl
          .replace('ws://', 'http://')
          .replace('wss://', 'https://');
        fetch(`${httpUrl}/keyboard/type`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: lastResult.text,
            auto_focus: typingAutoFocus,
            target_window: targetWindow || undefined,
          }),
        }).catch(() => {});
      }

      // Browser notification
      if (notificationsEnabled && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('BACON-AI Voice', {
          body: lastResult.text.slice(0, 100),
          tag: 'bacon-voice-transcription',
        });
      }
    }
  }, [lastResult, autoCopy, notificationsEnabled, typeToKeyboard, typingAutoFocus, targetWindow, backendUrl]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(editText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may not be available
    }
  }, [editText]);

  const handleDeleteEntry = useCallback((index: number) => {
    setHistory((prev) => prev.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
      setEditingText('');
    }
  }, [editingIndex]);

  const handleStartEdit = useCallback((index: number, text: string) => {
    setEditingIndex(index);
    setEditingText(text);
  }, []);

  const handleSaveEdit = useCallback((index: number) => {
    setHistory((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, text: editingText } : item
      )
    );
    setEditingIndex(null);
    setEditingText('');
  }, [editingText]);

  const handleCopyEntry = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API may not be available
    }
  }, []);

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
            <button className="btn btn--secondary" onClick={() => downloadAsMarkdown({ ...lastResult, text: editText })}>
              Download .md
            </button>
            <span className="transcription-current__meta">
              {lastResult.language} | {lastResult.duration.toFixed(1)}s
            </span>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="transcription-history">
          <button
            className="transcription-history__toggle"
            onClick={() => setHistoryOpen((prev) => !prev)}
            aria-expanded={historyOpen}
          >
            <span className="transcription-history__toggle-icon">
              {historyOpen ? '\u25BC' : '\u25B6'}
            </span>
            History ({history.length})
          </button>

          {historyOpen && (
            <div className="transcription-history__list">
              {history.map((result, index) => (
                <div key={`${result.timestamp}-${index}`} className="transcription-history__entry">
                  {editingIndex === index ? (
                    <textarea
                      className="transcription-history__edit-area"
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      rows={2}
                    />
                  ) : (
                    <div className="transcription-history__text">{result.text}</div>
                  )}
                  <div className="transcription-history__meta">
                    <span className={`confidence-badge confidence-badge--small ${confidenceBadgeClass(result.confidence)}`}>
                      {Math.round(result.confidence * 100)}%
                    </span>
                    <span>{formatTimestamp(result.timestamp)}</span>
                  </div>
                  <div className="transcription-history__actions">
                    {editingIndex === index ? (
                      <>
                        <button className="btn-icon" onClick={() => handleSaveEdit(index)} title="Save">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                        </button>
                        <button className="btn-icon" onClick={() => setEditingIndex(null)} title="Cancel">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="btn-icon" onClick={() => handleCopyEntry(result.text)} title="Copy">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                        </button>
                        <button className="btn-icon" onClick={() => handleStartEdit(index, result.text)} title="Edit">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                        </button>
                        <button className="btn-icon" onClick={() => downloadAsMarkdown(result)} title="Download .md">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                        </button>
                        <button className="btn-icon btn-icon--danger" onClick={() => handleDeleteEntry(index)} title="Delete">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
