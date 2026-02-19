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
  const [useRefined, setUseRefined] = useState(true);

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

  const selectedText = useRefined && refinedText ? refinedText : rawText;

  return (
    <div className="text-comparison">
      <div className="text-comparison__panels">
        <div className="text-comparison__panel">
          <div className="text-comparison__panel-header">
            <span className="text-comparison__panel-title">
              {useRefined && refinedText ? 'Refined' : 'Raw'}
            </span>
            <button
              className="btn-icon"
              onClick={() => handleCopy(selectedText, useRefined && refinedText ? 'refined' : 'raw')}
              title="Copy text"
              data-testid="copy-refined"
            >
              {copiedPanel ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
              )}
            </button>
          </div>
          <div className="text-comparison__panel-body">{selectedText}</div>
        </div>
      </div>

      <div className="text-comparison__controls">
        <label className="text-comparison__checkbox-label">
          <input
            type="checkbox"
            checked={useRefined}
            onChange={(e) => {
              setUseRefined(e.target.checked);
              onSelectText(e.target.checked && refinedText ? refinedText : rawText);
            }}
            data-testid="use-refined-checkbox"
          />
          Use refined text
        </label>
        <span className="text-comparison__meta">
          Refined in {processingTimeMs}ms via {provider}
        </span>
      </div>
    </div>
  );
}
