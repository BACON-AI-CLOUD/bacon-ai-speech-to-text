# BACON-AI Voice — Chrome Extension

A Chrome extension that captures your voice and inserts transcribed text directly at your cursor in any web page.

## Requirements

- BACON-AI Voice backend running locally (see parent project README)
- Default port: **8702** (v2 of the app)

## Installation

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `src/chrome-extension/` directory

## Usage

1. Click the BACON-AI icon to configure port and shortcut
2. Navigate to any web page
3. Click inside a text field, compose area, or contenteditable element
4. Press **Ctrl+Shift+M** (or your configured shortcut)
5. Speak — the extension will transcribe and insert text at your cursor
6. Press the shortcut again to stop early (silence auto-stops after 3s)

## Google Docs note

Google Docs uses canvas-based rendering which prevents direct DOM text insertion from extensions. For Google Docs, use **Cursor Position mode** in the BACON-AI Voice app instead:
1. Enable "Type to keyboard" + "Cursor Position mode" in the Output tab
2. The app plays countdown beeps, giving you time to click into Google Docs
3. Text is pasted via OS-level Ctrl+V — fully compatible with Google Docs

## Compatibility

| App | Works? |
|-----|--------|
| Gmail compose | ✅ |
| Google Sheets | ✅ (cell in edit mode) |
| Google Forms | ✅ |
| Google Chat | ✅ |
| Slack web | ✅ |
| Claude.ai | ✅ |
| Any textarea/input | ✅ |
| Google Docs | ⚠️ Use Cursor Position mode instead |
| VS Code web | ⚠️ Clipboard fallback |
