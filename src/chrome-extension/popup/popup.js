'use strict';

const defaults = { port: 8702, shortcut: 'Ctrl+Shift+M', model: 'base', silenceMs: 3000 };

// Load saved settings
chrome.storage.sync.get(defaults, (stored) => {
  document.getElementById('port').value = stored.port;
  document.getElementById('shortcut').value = stored.shortcut;
  document.getElementById('model').value = stored.model;
  document.getElementById('silenceMs').value = stored.silenceMs;
});

document.getElementById('save').addEventListener('click', () => {
  const port = parseInt(document.getElementById('port').value, 10) || defaults.port;
  const shortcut = document.getElementById('shortcut').value.trim() || defaults.shortcut;
  const model = document.getElementById('model').value || defaults.model;
  const silenceMs = parseInt(document.getElementById('silenceMs').value, 10) || defaults.silenceMs;

  chrome.storage.sync.set({ port, shortcut, model, silenceMs }, () => {
    const status = document.getElementById('status');
    status.textContent = '✓ Saved!';
    status.className = 'status saved';
    setTimeout(() => { status.textContent = ''; status.className = 'status'; }, 2000);
  });
});
