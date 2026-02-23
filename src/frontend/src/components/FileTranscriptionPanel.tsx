import { useState, useCallback, useRef } from 'react';
import type { AppSettings } from '../types/index.ts';
import './FileTranscriptionPanel.css';

interface FileTranscriptionPanelProps {
  settings: AppSettings;
  backendUrl: string;
}

interface FileResult {
  text: string;
  refined_text?: string;
  language: string;
  duration: number;
  output_url?: string;
  output_format: string;
  processing_time_ms: number;
  error?: string;
}

const LANGUAGES = [
  { code: '', label: 'Auto-detect' },
  { code: 'en', label: 'English' },
  { code: 'de', label: 'German' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'nl', label: 'Dutch' },
  { code: 'pl', label: 'Polish' },
  { code: 'ru', label: 'Russian' },
  { code: 'ja', label: 'Japanese' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ko', label: 'Korean' },
  { code: 'ar', label: 'Arabic' },
];

export function FileTranscriptionPanel({ settings, backendUrl }: FileTranscriptionPanelProps) {
  const httpUrl = backendUrl.replace('ws://', 'http://').replace('wss://', 'https://');

  const [inputMode, setInputMode] = useState<'upload' | 'path'>('upload');
  const [filePath, setFilePath] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [language, setLanguage] = useState('');
  const [outputFormat, setOutputFormat] = useState<'txt' | 'srt' | 'vtt'>('txt');
  const [refine, setRefine] = useState(false);
  const [useInjections, setUseInjections] = useState(settings.injectOnFile);
  const [transcribing, setTranscribing] = useState(false);
  const [result, setResult] = useState<FileResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
      setInputMode('upload');
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
  }, []);

  const handleTranscribe = useCallback(async () => {
    setTranscribing(true);
    setError(null);
    setResult(null);
    try {
      let data: FileResult;
      let customPrompt = '';
      if (useInjections) {
        const active = settings.suffixInjections.filter(i => i.enabled);
        if (active.length > 0) {
          customPrompt = active.map(i => i.text).join('\n\n');
        }
      }

      if (inputMode === 'upload' && selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('language', language);
        formData.append('output_format', outputFormat);
        formData.append('refine', String(refine));
        if (customPrompt) formData.append('custom_prompt', customPrompt);
        const resp = await fetch(`${httpUrl}/transcribe/file/upload`, {
          method: 'POST',
          body: formData,
        });
        data = await resp.json();
      } else if (inputMode === 'path' && filePath) {
        const resp = await fetch(`${httpUrl}/transcribe/file/path`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: filePath,
            language,
            output_format: outputFormat,
            refine,
            custom_prompt: customPrompt || undefined,
          }),
        });
        data = await resp.json();
      } else {
        throw new Error(inputMode === 'upload' ? 'Please select a file' : 'Please enter a file path');
      }
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Transcription failed');
    } finally {
      setTranscribing(false);
    }
  }, [inputMode, selectedFile, filePath, language, outputFormat, refine, useInjections, settings.suffixInjections, httpUrl]);

  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  }, []);

  const canTranscribe = inputMode === 'upload' ? !!selectedFile : !!filePath.trim();

  return (
    <div className="file-panel">
      {/* Mode switcher */}
      <div className="mode-switcher">
        <button
          className={`mode-btn ${inputMode === 'upload' ? 'mode-btn--active' : ''}`}
          onClick={() => setInputMode('upload')}
        >
          Upload file
        </button>
        <button
          className={`mode-btn ${inputMode === 'path' ? 'mode-btn--active' : ''}`}
          onClick={() => setInputMode('path')}
        >
          Local path
        </button>
      </div>

      {/* File input area */}
      {inputMode === 'upload' ? (
        <div
          className={`drop-zone ${dragging ? 'drop-zone--dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,video/*,.wav,.mp3,.mp4,.webm,.ogg,.flac,.m4a,.aac,.mkv,.avi,.mov,.wma"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          {selectedFile ? (
            <div className="drop-zone__file">
              <span className="drop-zone__filename">{selectedFile.name}</span>
              <span className="drop-zone__size">
                ({(selectedFile.size / 1024 / 1024).toFixed(1)} MB)
              </span>
            </div>
          ) : (
            <div className="drop-zone__placeholder">
              Drop audio/video file here or click to browse
              <span className="drop-zone__formats">mp3 · wav · mp4 · mkv · avi · mov · m4a · aac · flac · ogg · webm · wma</span>
            </div>
          )}
        </div>
      ) : (
        <input
          className="file-path-input"
          type="text"
          value={filePath}
          onChange={(e) => setFilePath(e.target.value)}
          placeholder="C:\path\to\video.mp4 or /home/user/audio.mp3  (mp3, wav, mp4, mkv, avi, mov, m4a, aac, flac, ogg, webm, wma)"
        />
      )}

      {/* Options row */}
      <div className="panel-row">
        <div className="panel-field">
          <label className="panel-label">Language</label>
          <select
            className="panel-select"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </div>
        <div className="panel-field">
          <label className="panel-label">Format</label>
          <select
            className="panel-select"
            value={outputFormat}
            onChange={(e) => setOutputFormat(e.target.value as 'txt' | 'srt' | 'vtt')}
          >
            <option value="txt">TXT</option>
            <option value="srt">SRT</option>
            <option value="vtt">VTT</option>
          </select>
        </div>
      </div>

      {/* Checkboxes */}
      <div className="panel-row panel-row--checks">
        <label className="panel-check">
          <input type="checkbox" checked={refine} onChange={(e) => setRefine(e.target.checked)} />
          Pipe through refiner
        </label>
        <label className="panel-check">
          <input type="checkbox" checked={useInjections} onChange={(e) => setUseInjections(e.target.checked)} />
          Include suffix injections
        </label>
      </div>

      {/* Transcribe button */}
      <button
        className="transcribe-btn"
        onClick={handleTranscribe}
        disabled={!canTranscribe || transcribing}
      >
        {transcribing ? 'Transcribing...' : 'Transcribe'}
      </button>

      {/* Progress */}
      {transcribing && (
        <div className="progress-indicator">
          <div className="progress-spinner" />
          Processing audio file...
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="file-error">{error}</div>
      )}

      {/* Result */}
      {result && (
        <div className="file-result">
          <div className="file-result__header">
            <span>
              {result.language} | {result.duration.toFixed(1)}s | {result.processing_time_ms}ms
            </span>
            {result.output_url && (
              <a
                href={`${httpUrl}${result.output_url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="file-result__download"
              >
                Download .{result.output_format}
              </a>
            )}
          </div>

          <div className="file-result__section">
            <div className="file-result__label">Transcription</div>
            <pre className="file-result__text">{result.text}</pre>
            <button
              className="file-result__copy"
              onClick={() => handleCopy(result.text)}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          {result.refined_text && (
            <div className="file-result__section">
              <div className="file-result__label">Refined</div>
              <pre className="file-result__text">{result.refined_text}</pre>
              <button
                className="file-result__copy"
                onClick={() => handleCopy(result.refined_text!)}
              >
                Copy refined
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
