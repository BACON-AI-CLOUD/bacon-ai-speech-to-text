import { useState, useCallback } from 'react';
import type { TranscriptionResult, DiscussResult } from '../types/index.ts';
import './HistorySidebar.css';

interface HistorySidebarProps {
  history: TranscriptionResult[];
  onDeleteEntry: (index: number) => void;
  onEditEntry: (index: number, text: string) => void;
  discussHistory: Array<{ role: string; content: string }>;
  discussMode: boolean;
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

export function HistorySidebar({
  history,
  onDeleteEntry,
  onEditEntry,
  discussHistory,
  discussMode,
}: HistorySidebarProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');

  const handleStartEdit = useCallback((index: number, text: string) => {
    setEditingIndex(index);
    setEditingText(text);
  }, []);

  const handleSaveEdit = useCallback((index: number) => {
    onEditEntry(index, editingText);
    setEditingIndex(null);
    setEditingText('');
  }, [editingText, onEditEntry]);

  const handleCopyEntry = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API may not be available
    }
  }, []);

  const handleDeleteEntry = useCallback((index: number) => {
    onDeleteEntry(index);
    if (editingIndex === index) {
      setEditingIndex(null);
      setEditingText('');
    }
  }, [editingIndex, onDeleteEntry]);

  return (
    <aside className="sidebar">
      <div className="sidebar__header">
        {discussMode ? 'Conversation' : 'History'}
        <span className="sidebar__count">
          {discussMode ? Math.floor(discussHistory.length / 2) : history.length}
        </span>
      </div>

      {/* Discuss conversation history */}
      {discussMode && discussHistory.length > 0 && (
        <div className="sidebar__discuss-history">
          {discussHistory.map((msg, i) => (
            <div
              key={i}
              className={`sidebar__discuss-msg sidebar__discuss-msg--${msg.role}`}
            >
              <div className="sidebar__discuss-msg-label">
                {msg.role === 'user' ? 'You' : 'Elisabeth'}
              </div>
              <div className="sidebar__discuss-msg-text">{msg.content}</div>
            </div>
          ))}
        </div>
      )}

      {/* Transcription history */}
      {!discussMode && history.length === 0 && (
        <div className="sidebar__empty">No transcriptions yet</div>
      )}

      {!discussMode && (
        <div className="sidebar__list">
          {history.map((result, index) => (
            <div key={`${result.timestamp}-${index}`} className="sidebar__entry">
              {editingIndex === index ? (
                <textarea
                  className="sidebar__edit-area"
                  value={editingText}
                  onChange={(e) => setEditingText(e.target.value)}
                  rows={2}
                />
              ) : (
                <div className="sidebar__entry-text">{result.text}</div>
              )}
              <div className="sidebar__entry-meta">
                <span className={`confidence-badge confidence-badge--small ${confidenceBadgeClass(result.confidence)}`}>
                  {Math.round(result.confidence * 100)}%
                </span>
                <span>{formatTimestamp(result.timestamp)}</span>
              </div>
              <div className="sidebar__entry-actions">
                {editingIndex === index ? (
                  <>
                    <button className="btn-icon" onClick={() => handleSaveEdit(index)} title="Save">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                    </button>
                    <button className="btn-icon" onClick={() => setEditingIndex(null)} title="Cancel">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                  </>
                ) : (
                  <>
                    <button className="btn-icon" onClick={() => handleCopyEntry(result.text)} title="Copy">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                    </button>
                    <button className="btn-icon" onClick={() => handleStartEdit(index, result.text)} title="Edit">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    </button>
                    <button className="btn-icon btn-icon--danger" onClick={() => handleDeleteEntry(index)} title="Delete">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
