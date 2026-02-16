import { useState, useCallback } from 'react';
import './TextComparison.css';

interface TextComparisonProps {
  rawText: string;
  refinedText: string | null;
  provider: string;
  processingTimeMs: number;
  isRefining: boolean;
  error: string | null;
  onSelectText: (text: string) => void;
}

export function TextComparison({
  rawText,
  refinedText,
  provider,
  processingTimeMs,
  isRefining,
  error,
  onSelectText,
}: TextComparisonProps) {
  const [copiedPanel, setCopiedPanel] = useState<'raw' | 'refined' | null>(null);

  const handleCopy = useCallback(async (text: string, panel: 'raw' | 'refined') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPanel(panel);
      setTimeout(() => setCopiedPanel(null), 2000);
    } catch {
      // Clipboard API may not be available
    }
  }, []);

  if (isRefining) {
    return (
      <div className="text-comparison">
        <div className="text-comparison__panel">
          <div className="text-comparison__panel-header">
            <span className="text-comparison__panel-title">Raw</span>
          </div>
          <div className="text-comparison__panel-body">{rawText}</div>
        </div>
        <div className="text-comparison__panel text-comparison__panel--loading">
          <div className="text-comparison__panel-header">
            <span className="text-comparison__panel-title">Refined</span>
          </div>
          <div className="text-comparison__spinner" role="status">
            <span className="text-comparison__spinner-dot" />
            <span>Refining...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-comparison">
        <div className="text-comparison__panel text-comparison__panel--full">
          <div className="text-comparison__panel-body">{rawText}</div>
          <div className="text-comparison__actions">
            <button className="btn btn--primary" onClick={() => onSelectText(rawText)}>
              Use Text
            </button>
          </div>
        </div>
        <div className="text-comparison__error" role="alert">{error}</div>
      </div>
    );
  }

  if (!refinedText) {
    return (
      <div className="text-comparison">
        <div className="text-comparison__panel text-comparison__panel--full">
          <div className="text-comparison__panel-body">{rawText}</div>
          <div className="text-comparison__actions">
            <button className="btn btn--primary" onClick={() => onSelectText(rawText)}>
              Use Text
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="text-comparison">
      <div className="text-comparison__panels">
        <div className="text-comparison__panel">
          <div className="text-comparison__panel-header">
            <span className="text-comparison__panel-title">Raw</span>
            <button
              className="btn-icon"
              onClick={() => handleCopy(rawText, 'raw')}
              title="Copy raw text"
              data-testid="copy-raw"
            >
              {copiedPanel === 'raw' ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
              )}
            </button>
          </div>
          <div className="text-comparison__panel-body">{rawText}</div>
          <div className="text-comparison__actions">
            <button className="btn btn--secondary" onClick={() => onSelectText(rawText)}>
              Use Raw
            </button>
          </div>
        </div>

        <div className="text-comparison__panel">
          <div className="text-comparison__panel-header">
            <span className="text-comparison__panel-title">Refined</span>
            <button
              className="btn-icon"
              onClick={() => handleCopy(refinedText, 'refined')}
              title="Copy refined text"
              data-testid="copy-refined"
            >
              {copiedPanel === 'refined' ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
              )}
            </button>
          </div>
          <div className="text-comparison__panel-body">{refinedText}</div>
          <div className="text-comparison__actions">
            <button className="btn btn--primary" onClick={() => onSelectText(refinedText)}>
              Use Refined
            </button>
          </div>
        </div>
      </div>

      <div className="text-comparison__meta">
        Refined in {processingTimeMs}ms via {provider}
      </div>
    </div>
  );
}
