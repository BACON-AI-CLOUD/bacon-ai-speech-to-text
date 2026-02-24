import { useState, useCallback, useRef, useEffect } from 'react';
import type { AppSettings } from '../types/index.ts';
import './FileTranscriptionPanel.css';

const TRANSCRIBING_MESSAGES = [
  "Need to get some brain energy for this one...",
  "Putting on my hiking boots...",
  "Asking the neurons to wake up...",
  "Brewing a strong coffee for this...",
  "Listening very carefully...",
  "Untangling words from the audio soup...",
  "Whispering sweet nothings to Whisper...",
  "Converting sound waves into wisdom...",
  "Deciphering the audio mysteries...",
  "Teaching my ears to type...",
  "Doing linguistic gymnastics...",
  "Warming up the transcription engines...",
  "This might take a hot minute (or a cool one)...",
  "Translating vibes into text...",
  "Summoning the phoneme elves...",
  "Running the audio through the thought machine...",
  "Having a deep listen...",
  "Applying maximum brain power...",
  "The longer the video, the wiser I get...",
  "Nearly there... probably...",
];

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

function isYouTubeUrl(url: string): boolean {
  return url.includes('youtube.com') || url.includes('youtu.be');
}

export function FileTranscriptionPanel({ settings, backendUrl }: FileTranscriptionPanelProps) {
  const httpUrl = backendUrl.replace('ws://', 'http://').replace('wss://', 'https://');

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState('');
  const [sourceType, setSourceType] = useState<'file' | 'url'>('file');
  const [language, setLanguage] = useState('');
  const [outputFormat, setOutputFormat] = useState<'txt' | 'srt' | 'vtt'>('txt');
  const [refine, setRefine] = useState(false);
  const [useInjections, setUseInjections] = useState(settings.injectOnFile);
  const [transcribing, setTranscribing] = useState(false);
  const [result, setResult] = useState<FileResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [msgIndex, setMsgIndex] = useState(0);
  const [editedText, setEditedText] = useState('');
  const [editedRefined, setEditedRefined] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Rotate through fun messages while transcribing
  useEffect(() => {
    if (!transcribing) return;
    setMsgIndex(0);
    const interval = setInterval(() => {
      setMsgIndex((i) => (i + 1) % TRANSCRIBING_MESSAGES.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [transcribing]);

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
      setFileUrl('');
      setSourceType('file');
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (file) {
      setSelectedFile(file);
      setFileUrl('');
      setSourceType('file');
    }
  }, []);

  const handleTranscribe = useCallback(async () => {
    setTranscribing(true);
    setError(null);
    setResult(null);
    setEditedText('');
    setEditedRefined('');
    try {
      let data: FileResult;
      let customPrompt = '';
      if (useInjections) {
        const active = settings.suffixInjections.filter(i => i.enabled);
        if (active.length > 0) {
          customPrompt = active.map(i => i.text).join('\n\n');
        }
      }

      if (sourceType === 'file' && selectedFile) {
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
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ detail: 'Upload failed' }));
          throw new Error(err.detail || 'Upload failed');
        }
        data = await resp.json();
      } else if (sourceType === 'url' && fileUrl) {
        const resp = await fetch(`${httpUrl}/transcribe/file/url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: fileUrl,
            language,
            output_format: outputFormat,
            refine,
            custom_prompt: customPrompt || undefined,
          }),
        });
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ detail: 'URL transcription failed' }));
          throw new Error(err.detail || 'URL transcription failed');
        }
        data = await resp.json();
      } else {
        throw new Error('Please select a file or enter a URL');
      }
      if (data.error) throw new Error(data.error);
      setResult(data);
      setEditedText(data.text);
      setEditedRefined(data.refined_text ?? '');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Transcription failed');
    } finally {
      setTranscribing(false);
    }
  }, [sourceType, selectedFile, fileUrl, language, outputFormat, refine, useInjections, settings.suffixInjections, httpUrl]);

  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  }, []);

  const canTranscribe = sourceType === 'file' ? !!selectedFile : !!fileUrl.trim();

  return (
    <div className="file-panel">
      {/* Unified source area */}
      <div
        className={`source-area ${dragging ? 'source-area--dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,video/*,.wav,.mp3,.mp4,.webm,.ogg,.flac,.m4a,.aac,.mkv,.avi,.mov,.wma"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        <div className="source-area__file-row">
          <button
            className="select-file-btn"
            onClick={() => { setFileUrl(''); fileInputRef.current?.click(); }}
            type="button"
          >
            Select File
          </button>
          {selectedFile ? (
            <span className="source-area__filename">
              {selectedFile.name}
              <span className="source-area__size">({(selectedFile.size / 1024 / 1024).toFixed(1)} MB)</span>
            </span>
          ) : (
            <span className="source-area__hint">or drag &amp; drop a file here</span>
          )}
        </div>
        <div className="source-area__formats">
          mp3 · wav · mp4 · mkv · avi · mov · m4a · aac · flac · ogg · webm · wma
        </div>
        <div className="source-area__url-row">
          <span className="source-area__url-label">or URL:</span>
          <input
            className="source-area__url-input"
            type="text"
            value={fileUrl}
            onChange={(e) => {
              setFileUrl(e.target.value);
              if (e.target.value) {
                setSelectedFile(null);
                setSourceType('url');
              } else {
                setSourceType('file');
              }
            }}
            placeholder="https://... (audio, video, or YouTube URL)"
          />
          {fileUrl && (
            <span className={`url-badge ${isYouTubeUrl(fileUrl) ? 'url-badge--youtube' : 'url-badge--direct'}`}>
              {isYouTubeUrl(fileUrl) ? 'YouTube' : 'Direct URL'}
            </span>
          )}
        </div>
      </div>

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

      {/* Loading overlay */}
      {transcribing && (
        <div className="transcribing-overlay">
          <div className="transcribing-spinner" />
          <div className="transcribing-title">Transcribing...</div>
          <div className="transcribing-msg">{TRANSCRIBING_MESSAGES[msgIndex]}</div>
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
            <div className="file-result__label">Transcription <span className="file-result__edit-hint">— editable</span></div>
            <textarea
              className="file-result__text file-result__text--editable"
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              rows={6}
            />
            <button
              className="file-result__copy"
              onClick={() => handleCopy(editedText)}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          {result.refined_text && (
            <div className="file-result__section">
              <div className="file-result__label">Refined <span className="file-result__edit-hint">— editable</span></div>
              <textarea
                className="file-result__text file-result__text--editable"
                value={editedRefined}
                onChange={(e) => setEditedRefined(e.target.value)}
                rows={6}
              />
              <button
                className="file-result__copy"
                onClick={() => handleCopy(editedRefined)}
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
