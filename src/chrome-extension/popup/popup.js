'use strict';

const defaults = { port: 8702, shortcut: 'Ctrl+Shift+M', model: 'base', silenceMs: 3000, ttydPort: 7681 };

// Load saved settings
chrome.storage.sync.get(defaults, (stored) => {
  document.getElementById('port').value = stored.port;
  document.getElementById('shortcut').value = stored.shortcut;
  document.getElementById('model').value = stored.model;
  document.getElementById('silenceMs').value = stored.silenceMs;
  document.getElementById('ttyd-port').value = stored.ttydPort;
});

document.getElementById('save').addEventListener('click', () => {
  const port = parseInt(document.getElementById('port').value, 10) || defaults.port;
  const shortcut = document.getElementById('shortcut').value.trim() || defaults.shortcut;
  const model = document.getElementById('model').value || defaults.model;
  const silenceMs = parseInt(document.getElementById('silenceMs').value, 10) || defaults.silenceMs;
  const ttydPort = parseInt(document.getElementById('ttyd-port').value, 10) || defaults.ttydPort;

  chrome.storage.sync.set({ port, shortcut, model, silenceMs, ttydPort }, () => {
    const status = document.getElementById('status');
    status.textContent = '✓ Saved!';
    status.className = 'status saved';
    setTimeout(() => { status.textContent = ''; status.className = 'status'; }, 2000);
  });
});
