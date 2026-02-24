import { useState, useCallback, useRef } from 'react';
import type { AppSettings } from '../types/index.ts';
import './TextEditorPanel.css';

interface TextEditorPanelProps {
  settings: AppSettings;
  backendUrl: string;
}

// Simple client-side markdown to HTML (no library dependency)
function simpleMarkdownToHtml(md: string): string {
  // Escape HTML first
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks (``` ... ```)
  html = html.replace(/```[\w]*\n?([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

  // Headings
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Unordered lists
  html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');

  // Paragraphs (double newlines)
  html = html.replace(/\n\n/g, '</p><p>');
  html = '<p>' + html + '</p>';

  // Clean up empty paragraphs
  html = html.replace(/<p><\/p>/g, '');
  html = html.replace(/<p>(<h[1-6]>)/g, '$1');
  html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1');
  html = html.replace(/<p>(<ul>)/g, '$1');
  html = html.replace(/(<\/ul>)<\/p>/g, '$1');
  html = html.replace(/<p>(<pre>)/g, '$1');
  html = html.replace(/(<\/pre>)<\/p>/g, '$1');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Line breaks
  html = html.replace(/\n/g, '<br>');

  return html;
}

export function TextEditorPanel({ settings, backendUrl }: TextEditorPanelProps) {
  const httpUrl = backendUrl.replace('ws://', 'http://').replace('wss://', 'https://');

  const [text, setText] = useState('');
  const [dragging, setDragging] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [refining, setRefining] = useState(false);
  const [refinedText, setRefinedText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFile = useCallback(async (file: File) => {
    const name = file.name.toLowerCase();
    if (name.endsWith('.txt') || name.endsWith('.md')) {
      // Client-side: no backend needed
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setText(content);
        setRefinedText(null);
        setError(null);
      };
      reader.readAsText(file);
    } else if (name.endsWith('.pdf') || name.endsWith('.docx')) {
      // Backend extraction
      setExtracting(true);
      setError(null);
      try {
        const formData = new FormData();
        formData.append('file', file);
        const resp = await fetch(`${httpUrl}/extract-text/upload`, {
          method: 'POST',
          body: formData,
        });
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ detail: 'Extraction failed' }));
          throw new Error(err.detail || 'Extraction failed');
        }
        const data = await resp.json();
        setText(data.text);
        setRefinedText(null);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to extract text');
      } finally {
        setExtracting(false);
      }
    } else {
      setError('Unsupported file type. Use .txt, .md, .pdf, or .docx');
    }
  }, [httpUrl]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      await loadFile(file);
    }
  }, [loadFile]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await loadFile(file);
    }
    // Reset input so same file can be loaded again
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [loadFile]);

  const handleClear = useCallback(() => {
    setText('');
    setRefinedText(null);
    setError(null);
    setPreviewMode(false);
  }, []);

  const handleSave = useCallback(() => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'text-export.txt';
    a.click();
    URL.revokeObjectURL(url);
  }, [text]);

  const handleRefine = useCallback(async () => {
    if (!text.trim()) return;
    setRefining(true);
    setError(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120_000);
    try {
      const resp = await fetch(`${httpUrl}/refiner/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          ...(settings.refiner.customPrompt ? { custom_prompt: settings.refiner.customPrompt } : {}),
        }),
        signal: controller.signal,
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: 'Refinement failed' }));
        throw new Error(err.detail || 'Refinement failed');
      }
      const data = await resp.json();
      setRefinedText(data.refined_text);
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        setError('Refinement timed out after 2 minutes. Check that your AI provider is running.');
      } else {
        setError(e instanceof Error ? e.message : 'Refinement failed');
      }
    } finally {
      clearTimeout(timeoutId);
      setRefining(false);
    }
  }, [text, httpUrl, settings.refiner.customPrompt]);

  const handleCopy = useCallback(async (textToCopy: string) => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  }, []);

  const handleTypeToKeyboard = useCallback(async (textToType: string) => {
    try {
      await fetch(`${httpUrl}/keyboard/type`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToType,
          auto_focus: settings.cursorPositionMode ? false : settings.typingAutoFocus,
          target_window: settings.cursorPositionMode ? undefined : (settings.targetWindow || undefined),
          focus_delay_ms: settings.typingFocusDelay,
          flash_window: settings.cursorPositionMode ? false : settings.typingFlashWindow,
        }),
      });
    } catch { /* ignore */ }
  }, [httpUrl, settings.cursorPositionMode, settings.typingAutoFocus, settings.targetWindow, settings.typingFocusDelay, settings.typingFlashWindow]);

  const charCount = text.length;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <div className="text-editor-panel">
      {/* Toolbar */}
      <div className="text-editor__toolbar">
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.pdf,.docx"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        <button
          className="text-editor__tool-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Load file (.txt, .md, .pdf, .docx)"
          disabled={extracting}
        >
          Load
        </button>
        <button
          className="text-editor__tool-btn"
          onClick={handleClear}
          title="Clear editor"
          disabled={!text}
        >
          Clear
        </button>
        <button
          className="text-editor__tool-btn"
          onClick={handleSave}
          title="Save as .txt"
          disabled={!text}
        >
          Save
        </button>
        <span className="text-editor__spacer" />
        <button
          className={`text-editor__tool-btn ${previewMode ? 'text-editor__tool-btn--active' : ''}`}
          onClick={() => setPreviewMode((p) => !p)}
          title="Toggle markdown preview"
          disabled={!text}
        >
          Preview
        </button>
      </div>

      {/* Drop zone + textarea */}
      <div
        className={`text-editor__drop-zone ${dragging ? 'text-editor__drop-zone--dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {extracting ? (
          <div className="text-editor__extracting">
            <div className="text-editor__spinner" />
            <span>Extracting text from file...</span>
          </div>
        ) : previewMode ? (
          <div
            className="text-editor__preview"
            dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(text) }}
          />
        ) : (
          <textarea
            className="text-editor__textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type or paste text here, or drag & drop a .txt, .md, .pdf, or .docx file..."
            rows={15}
            spellCheck
          />
        )}
      </div>

      {/* Stats */}
      <div className="text-editor__stats">
        {charCount.toLocaleString()} chars &middot; {wordCount.toLocaleString()} words
        {dragging && <span className="text-editor__drag-hint"> &larr; drop file here</span>}
      </div>

      {/* Error */}
      {error && <div className="text-editor__error">{error}</div>}

      {/* Refine bar */}
      <div className="text-editor__refine-bar">
        <span className="text-editor__refine-label">
          Template: <strong>{settings.refiner.promptTemplate}</strong>
        </span>
        <button
          className="text-editor__refine-btn"
          onClick={handleRefine}
          disabled={!text.trim() || refining}
        >
          {refining ? 'Refining...' : 'Refine'}
        </button>
      </div>

      {/* Refined result */}
      {(refinedText !== null || refining) && (
        <div className="text-editor__result">
          <div className="text-editor__result-label">Result</div>
          {refining ? (
            <div className="text-editor__result-loading">
              <div className="text-editor__spinner" />
              <span>Refining...</span>
            </div>
          ) : (
            <>
              <textarea
                className="text-editor__result-textarea"
                value={refinedText ?? ''}
                onChange={(e) => setRefinedText(e.target.value)}
                rows={8}
              />
              <div className="text-editor__result-actions">
                <button
                  className="text-editor__action-btn"
                  onClick={() => handleCopy(refinedText ?? '')}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <button
                  className="text-editor__action-btn"
                  onClick={() => handleTypeToKeyboard(refinedText ?? '')}
                >
                  Type
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
