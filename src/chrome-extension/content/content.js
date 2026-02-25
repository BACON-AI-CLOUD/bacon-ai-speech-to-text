/**
 * BACON-AI Voice — Chrome Extension Content Script
 * Captures mic via WebSocket, streams to local Whisper backend, inserts text at cursor.
 *
 * Keyboard shortcut (configurable): Ctrl+Shift+M
 * Backend: ws://localhost:PORT/ws/audio (PORT configurable in popup, default 8702)
 */

'use strict';

// ─── State ───────────────────────────────────────────────────────────────────
let isRecording = false;
let ws = null;
let mediaRecorder = null;
let audioStream = null;
let audioContext = null;
let analyserNode = null;
let silenceTimer = null;
let resultTimeout = null;
let overlayEl = null;

// ─── Config (loaded from chrome.storage.sync) ────────────────────────────────
let config = {
  port: 8702,
  shortcut: 'Ctrl+Shift+M',
  silenceMs: 3000,
  model: 'base',
  ttydPort: 7681,
};

chrome.storage.sync.get(['port', 'shortcut', 'silenceMs', 'model', 'ttydPort'], (stored) => {
  if (stored.port) config.port = stored.port;
  if (stored.shortcut) config.shortcut = stored.shortcut;
  if (stored.silenceMs) config.silenceMs = stored.silenceMs;
  if (stored.model) config.model = stored.model;
  if (stored.ttydPort) config.ttydPort = stored.ttydPort;
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.port) config.port = changes.port.newValue;
  if (changes.shortcut) config.shortcut = changes.shortcut.newValue;
  if (changes.silenceMs) config.silenceMs = changes.silenceMs.newValue;
  if (changes.model) config.model = changes.model.newValue;
  if (changes.ttydPort) config.ttydPort = changes.ttydPort.newValue;
});

// ─── Overlay UI ──────────────────────────────────────────────────────────────
function showOverlay(message, persistent = false) {
  removeOverlay();
  overlayEl = document.createElement('div');
  overlayEl.id = 'bacon-voice-overlay';
  overlayEl.textContent = message;
  document.body.appendChild(overlayEl);
  if (!persistent) {
    setTimeout(removeOverlay, 2500);
  }
}

function removeOverlay() {
  if (overlayEl && overlayEl.parentNode) {
    overlayEl.parentNode.removeChild(overlayEl);
  }
  overlayEl = null;
}

// ─── Gmail Smart Insert ───────────────────────────────────────────────────────
function detectGmailCompose() {
  // Gmail compose window selector
  const subjectInput = document.querySelector('input[name="subjectbox"], input[aria-label="Subject"]');
  const bodyArea = document.querySelector(
    'div[aria-label="Message Body"], div[role="textbox"][aria-label*="Body"], div.Am.Al.editable, div[g_editable="true"]'
  );
  return subjectInput && bodyArea ? { subjectInput, bodyArea } : null;
}

function parseEmailText(text) {
  // Parse "Subject: ...\n\nBody..." format from email template
  const lines = text.split('\n');
  const subjectLine = lines.find(l => l.toLowerCase().startsWith('subject:'));
  if (!subjectLine) return null;
  const subject = subjectLine.replace(/^subject:\s*/i, '').trim();
  // Body is everything after the first blank line following the Subject line
  const subjectIdx = lines.indexOf(subjectLine);
  const bodyLines = lines.slice(subjectIdx + 1);
  // Skip leading blank lines
  const firstContent = bodyLines.findIndex(l => l.trim() !== '');
  const body = firstContent >= 0 ? bodyLines.slice(firstContent).join('\n').trim() : '';
  return { subject, body };
}

// ─── Text Insertion ───────────────────────────────────────────────────────────
async function insertTextAtCursor(text) {
  // ── xterm.js / ttyd terminal injection ──────────────────────────────────────
  const isLocalhost = window.location.hostname === 'localhost' ||
                      window.location.hostname === '127.0.0.1';
  const isTtydPort = isLocalhost &&
                     (window.location.port === String(config.ttydPort || 7681));
  if (isTtydPort) {
    // Strategy 1: xterm.js Terminal.paste() API (ttyd exposes window.term)
    if (typeof window.term !== 'undefined' && typeof window.term.paste === 'function') {
      window.term.paste(text);
      showOverlay('\u2713 Sent to terminal');
      return;
    }
    // Strategy 2: xterm.js hidden helper textarea
    const xtermTA = document.querySelector('textarea.xterm-helper-textarea');
    if (xtermTA) {
      xtermTA.focus();
      const pos = xtermTA.selectionStart ?? xtermTA.value.length;
      xtermTA.setRangeText(text, pos, pos, 'end');
      xtermTA.dispatchEvent(new Event('input', { bubbles: true }));
      showOverlay('\u2713 Sent to terminal');
      return;
    }
    // Strategy 3: clipboard fallback with notification
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      showOverlay('Copied (paste with Ctrl+Shift+V in terminal)');
      return;
    }
  }

  // ── Gmail smart insert ──────────────────────────────────────────────────────
  if (window.location.hostname === 'mail.google.com') {
    const gmail = detectGmailCompose();
    if (gmail) {
      const parsed = parseEmailText(text);
      if (parsed && parsed.subject) {
        // Fill subject field
        gmail.subjectInput.focus();
        gmail.subjectInput.value = parsed.subject;
        gmail.subjectInput.dispatchEvent(new Event('input', { bubbles: true }));
        gmail.subjectInput.dispatchEvent(new Event('change', { bubbles: true }));
        // Fill body field
        if (parsed.body) {
          gmail.bodyArea.focus();
          // Try execCommand first, fall back to clipboard
          if (!document.execCommand('selectAll', false, null)) {
            // select all existing content
          }
          if (document.execCommand('insertText', false, parsed.body)) {
            showOverlay('✓ Subject + body filled');
            return;
          }
          // Clipboard fallback for body
          try {
            await navigator.clipboard.writeText(parsed.body);
            document.execCommand('paste');
            showOverlay('✓ Subject filled, body pasted');
          } catch {
            showOverlay(`✓ Subject filled — paste body manually (Ctrl+V)`);
            await navigator.clipboard.writeText(parsed.body).catch(() => {});
          }
        } else {
          showOverlay('✓ Subject filled');
        }
        return;
      }
      // No Subject: prefix — just insert normally at current focus
    }
  }

  // ── Standard insertion (non-Gmail or no compose window detected) ───────────
  let el = document.activeElement;
  if (el && el.tagName === 'IFRAME') {
    try {
      el = el.contentDocument && el.contentDocument.activeElement;
    } catch {
      el = null;
    }
  }
  if (!el) el = document.activeElement;

  // Strategy 1a: Standard textarea / input — setRangeText (most reliable)
  if (el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT')) {
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    el.setRangeText(text, start, end, 'end');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    showOverlay('✓ Done');
    return;
  }

  // Strategy 1b: contentEditable — execCommand insertText
  if (el && el.isContentEditable) {
    if (document.execCommand('insertText', false, text)) {
      showOverlay('✓ Done');
      return;
    }
  }

  // Strategy 2: Clipboard fallback — write to clipboard, show instruction overlay
  try {
    await navigator.clipboard.writeText(text);
    showOverlay(`✓ Copied — press Ctrl+V to paste`, false);
  } catch {
    // Strategy 3: Last resort — show text in overlay so user can manually copy
    showOverlay(`📋 ${text.length > 80 ? text.slice(0, 80) + '…' : text}`, true);
    setTimeout(removeOverlay, 6000);
  }
}

// ─── Silence Detection ────────────────────────────────────────────────────────
function startSilenceDetection(stream) {
  audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  analyserNode = audioContext.createAnalyser();
  analyserNode.fftSize = 512;
  source.connect(analyserNode);

  const buffer = new Float32Array(analyserNode.fftSize);
  const RMS_THRESHOLD = 0.01;

  function checkSilence() {
    if (!isRecording) return;
    analyserNode.getFloatTimeDomainData(buffer);
    const rms = Math.sqrt(buffer.reduce((s, v) => s + v * v, 0) / buffer.length);
    if (rms < RMS_THRESHOLD) {
      if (!silenceTimer) {
        silenceTimer = setTimeout(() => {
          if (isRecording) stopRecording();
        }, config.silenceMs);
      }
    } else {
      clearTimeout(silenceTimer);
      silenceTimer = null;
    }
    requestAnimationFrame(checkSilence);
  }
  checkSilence();
}

// ─── Recording Control ────────────────────────────────────────────────────────
async function startRecording() {
  if (isRecording) return;

  try {
    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    showOverlay('❌ Mic denied — check browser permissions', true);
    setTimeout(removeOverlay, 4000);
    return;
  }

  showOverlay('🎙 Connecting…', true);

  ws = new WebSocket(`ws://localhost:${config.port}/ws/audio`);

  ws.onerror = () => {
    showOverlay('❌ BACON-AI not running\nStart the backend first', true);
    setTimeout(removeOverlay, 5000);
    stopRecordingCleanup();
  };

  ws.onclose = () => {
    if (isRecording) {
      showOverlay('⚡ Processing…', true);
    }
  };

  resultTimeout = setTimeout(() => {
    showOverlay('⏱ Timeout — try again', false);
    stopRecordingCleanup();
  }, 30000);

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'start', model: config.model }));
    isRecording = true;
    showOverlay('🎙 Recording…', true);

    mediaRecorder = new MediaRecorder(audioStream, { mimeType: 'audio/webm;codecs=opus' });
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0 && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(e.data);
      }
    };
    mediaRecorder.start(250);
    startSilenceDetection(audioStream);
  };

  ws.onmessage = (e) => {
    clearTimeout(resultTimeout);
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'result' && msg.payload && msg.payload.text) {
        insertTextAtCursor(msg.payload.text.trim());
        stopRecordingCleanup();
      } else if (msg.type === 'error') {
        showOverlay(`❌ Error: ${msg.message || 'Unknown'}`, false);
        stopRecordingCleanup();
      }
    } catch {
      // not JSON, ignore
    }
  };
}

function stopRecording() {
  if (!isRecording) return;
  showOverlay('⚡ Processing…', true);
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'stop' }));
  }
  isRecording = false;
  clearTimeout(silenceTimer);
  silenceTimer = null;
  if (audioStream) {
    audioStream.getTracks().forEach((t) => t.stop());
    audioStream = null;
  }
}

function stopRecordingCleanup() {
  isRecording = false;
  clearTimeout(silenceTimer);
  clearTimeout(resultTimeout);
  silenceTimer = null;
  resultTimeout = null;
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    try { mediaRecorder.stop(); } catch {}
  }
  mediaRecorder = null;
  if (audioStream) {
    audioStream.getTracks().forEach((t) => t.stop());
    audioStream = null;
  }
  if (audioContext) {
    try { audioContext.close(); } catch {}
    audioContext = null;
  }
  analyserNode = null;
  ws = null;
}

// ─── Keyboard Shortcut ────────────────────────────────────────────────────────
function parseShortcut(shortcut) {
  const parts = shortcut.toLowerCase().split('+').map((p) => p.trim());
  return {
    ctrl: parts.includes('ctrl'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
    meta: parts.includes('meta') || parts.includes('cmd'),
    key: parts.find((p) => !['ctrl', 'shift', 'alt', 'meta', 'cmd'].includes(p)) || '',
  };
}

document.addEventListener('keydown', (e) => {
  const sc = parseShortcut(config.shortcut);
  const keyMatch = e.key.toLowerCase() === sc.key.toLowerCase() ||
    e.code.toLowerCase() === `key${sc.key.toUpperCase()}`;
  if (
    e.ctrlKey === sc.ctrl &&
    e.shiftKey === sc.shift &&
    e.altKey === sc.alt &&
    e.metaKey === sc.meta &&
    keyMatch
  ) {
    e.preventDefault();
    e.stopPropagation();
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }
}, true); // capture phase so we get it before the page
