import { useState, useRef, useEffect, useCallback } from 'react';
import type { TranscriptionResult, RefinerResult, DiscussResult } from '../types/index.ts';
import { TextComparison } from './TextComparison.tsx';
import './TranscriptionDisplay.css';

interface TranscriptionDisplayProps {
  lastResult: TranscriptionResult | null;
  notificationsEnabled?: boolean;
  autoCopy?: boolean;
  typeToKeyboard?: boolean;
  typingAutoFocus?: boolean;
  targetWindow?: string;
  backendUrl?: string;
  refinerEnabled?: boolean;
  refinerResult?: RefinerResult | null;
  isRefining?: boolean;
  refinerError?: string | null;
  suppressActions?: boolean;
  discussResult?: DiscussResult | null;
  isDiscussing?: boolean;
  discussError?: string | null;
  onHistoryUpdate?: (updater: React.SetStateAction<TranscriptionResult[]>) => void;
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
  refinerEnabled = false,
  refinerResult = null,
  isRefining = false,
  refinerError = null,
  suppressActions = false,
  discussResult = null,
  isDiscussing = false,
  discussError = null,
  onHistoryUpdate,
}: TranscriptionDisplayProps) {
  const [editText, setEditText] = useState('');
  const [copied, setCopied] = useState(false);
  const prevResultRef = useRef<TranscriptionResult | null>(null);

  // Request notification permission when enabled
  useEffect(() => {
    if (notificationsEnabled && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [notificationsEnabled]);

  // Track which result we've already sent to keyboard/clipboard/notification
  const actionsDispatchedRef = useRef<string | null>(null);

  useEffect(() => {
    if (lastResult && lastResult.text.trim() && lastResult !== prevResultRef.current) {
      prevResultRef.current = lastResult;
      setEditText(lastResult.text);
      if (onHistoryUpdate) {
        onHistoryUpdate((prev) => [lastResult, ...prev].slice(0, 50));
      }

      // Skip actions when discuss mode is active
      if (suppressActions) return;

      // If refiner is enabled, defer keyboard/copy/notification to the refiner effect below
      if (refinerEnabled) return;

      // Refiner disabled: dispatch actions immediately with raw text
      actionsDispatchedRef.current = lastResult.text;

      if (autoCopy && navigator.clipboard) {
        navigator.clipboard.writeText(lastResult.text).catch(() => {});
      }

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

      if (notificationsEnabled && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('BACON-AI Voice', {
          body: lastResult.text.slice(0, 100),
          tag: 'bacon-voice-transcription',
        });
      }
    }
  }, [lastResult, autoCopy, notificationsEnabled, typeToKeyboard, typingAutoFocus, targetWindow, backendUrl, suppressActions, refinerEnabled, onHistoryUpdate]);

  // When refiner is enabled, dispatch actions after refined text arrives
  useEffect(() => {
    if (!refinerEnabled || !refinerResult || suppressActions) return;
    // Use refined text, falling back to raw if refinement returned empty
    const outputText = refinerResult.refined_text || lastResult?.text || '';
    if (!outputText.trim()) return;
    // Don't dispatch twice for the same text
    if (actionsDispatchedRef.current === outputText) return;
    actionsDispatchedRef.current = outputText;

    if (autoCopy && navigator.clipboard) {
      navigator.clipboard.writeText(outputText).catch(() => {});
    }

    if (typeToKeyboard) {
      const httpUrl = backendUrl
        .replace('ws://', 'http://')
        .replace('wss://', 'https://');
      fetch(`${httpUrl}/keyboard/type`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: outputText,
          auto_focus: typingAutoFocus,
          target_window: targetWindow || undefined,
        }),
      }).catch(() => {});
    }

    if (notificationsEnabled && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification('BACON-AI Voice', {
        body: outputText.slice(0, 100),
        tag: 'bacon-voice-transcription',
      });
    }
  }, [refinerEnabled, refinerResult, suppressActions, autoCopy, typeToKeyboard, notificationsEnabled, typingAutoFocus, targetWindow, backendUrl, lastResult]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(editText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may not be available
    }
  }, [editText]);

  if (!lastResult) {
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
      {/* Discuss mode conversation display */}
      {(discussResult || isDiscussing || discussError) && (
        <div className="discuss-conversation">
          {discussResult && (
            <>
              <div className="discuss-bubble discuss-bubble--user">
                <div className="discuss-bubble__text">{discussResult.question}</div>
              </div>
              <div className="discuss-bubble discuss-bubble--elisabeth">
                <div className="discuss-bubble__label">Elisabeth</div>
                <div className="discuss-bubble__text">{discussResult.answer}</div>
                <div className="discuss-bubble__meta">
                  {discussResult.provider} / {discussResult.model} &middot; {discussResult.latency_ms}ms
                </div>
              </div>
            </>
          )}
          {isDiscussing && (
            <div className="discuss-bubble discuss-bubble--elisabeth discuss-bubble--thinking">
              <div className="discuss-bubble__label">Elisabeth</div>
              <div className="discuss-bubble__text">Thinking...</div>
            </div>
          )}
          {discussError && (
            <div className="discuss-bubble discuss-bubble--error">
              <div className="discuss-bubble__text">{discussError}</div>
            </div>
          )}
        </div>
      )}

      {lastResult && (
        <div className="transcription-current">
          <div className="transcription-current__header">
            <span className="transcription-current__title">Latest Transcription</span>
            <span className={`confidence-badge ${confidenceBadgeClass(lastResult.confidence)}`}>
              {Math.round(lastResult.confidence * 100)}%
            </span>
          </div>

          {refinerEnabled ? (
            <TextComparison
              rawText={lastResult.text}
              refinedText={refinerResult?.refined_text ?? null}
              provider={refinerResult?.provider ?? ''}
              processingTimeMs={refinerResult?.processing_time_ms ?? 0}
              isRefining={isRefining}
              error={refinerError}
              onSelectText={(text) => setEditText(text)}
            />
          ) : (
            <textarea
              className="transcription-current__editor"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={3}
            />
          )}

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

    </div>
  );
}
