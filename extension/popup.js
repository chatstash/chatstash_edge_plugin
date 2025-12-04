// extension/popup.js

document.addEventListener('DOMContentLoaded', restoreSettings);

document.getElementById('scrapeBtn').addEventListener('click', async () => {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = 'Processing...';
    statusDiv.className = 'info';

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        throw new Error("No active tab found");
      }

      // Send message to content script to start scraping
      const response = await chrome.tabs.sendMessage(tab.id, { action: "SCRAPE_PAGE" });

      if (response && response.status === 'success') {
        statusDiv.textContent = 'Saved successfully!';
        statusDiv.className = 'success';
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 3000);
      } else {
        throw new Error(response?.message || 'Unknown error');
      }
    } catch (error) {
      statusDiv.textContent = `Error: ${error.message}`;
      statusDiv.className = 'error';
      console.error(error);
    }
});

document.getElementById('toggleSettings').addEventListener('click', () => {
    const panel = document.getElementById('settingsPanel');
    const isHidden = panel.style.display !== 'block';
    panel.style.display = isHidden ? 'block' : 'none';

    // Update button text
    document.getElementById('toggleSettings').textContent = isHidden ? 'Hide Settings' : 'Settings';
});

document.getElementById('saveSettings').addEventListener('click', () => {
    const apiKey = document.getElementById('apiKey').value.trim();
    const apiPort = document.getElementById('apiPort').value.trim();
    const savePath = document.getElementById('savePath').value.trim();
    const useHttps = document.getElementById('useHttps').checked;

    chrome.storage.local.set({
        obsidianApiKey: apiKey,
        obsidianApiPort: apiPort,
        obsidianSaveDir: savePath,
        obsidianUseHttps: useHttps
    }, () => {
        const status = document.getElementById('status');
        status.textContent = 'Settings saved.';
        status.className = 'success';
        setTimeout(() => {
            status.style.display = 'none';
        }, 2000);
    });
});

function restoreSettings() {
    chrome.storage.local.get(['obsidianApiKey', 'obsidianApiPort', 'obsidianSaveDir', 'obsidianUseHttps'], (items) => {
        if (items.obsidianApiKey) {
            document.getElementById('apiKey').value = items.obsidianApiKey;
        }
        if (items.obsidianApiPort) {
            document.getElementById('apiPort').value = items.obsidianApiPort;
        }
        if (items.obsidianSaveDir) {
            document.getElementById('savePath').value = items.obsidianSaveDir;
        }
        if (items.obsidianUseHttps) {
            document.getElementById('useHttps').checked = items.obsidianUseHttps;
        }
    });
}
