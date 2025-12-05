// extension/popup.js

const DEFAULT_PORT = 27124;

document.addEventListener('DOMContentLoaded', restoreSettings);

document.getElementById('scrapeBtn').addEventListener('click', async () => {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = 'Scraping...';
    statusDiv.className = '';

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        throw new Error("No active tab found");
      }

      // Trigger scraping in content script
      const response = await chrome.tabs.sendMessage(tab.id, { action: "SCRAPE_PAGE" });

      if (response && response.status === 'success') {
        statusDiv.textContent = 'Saved!';
        statusDiv.className = 'success';
      } else {
        throw new Error(response?.message || 'Unknown error');
      }
    } catch (error) {
      statusDiv.textContent = 'Error: ' + error.message;
      statusDiv.className = 'error';
      console.error(error);
    }
});

document.getElementById('toggleSettings').addEventListener('click', () => {
    const panel = document.getElementById('settingsPanel');
    panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
});

document.getElementById('saveSettings').addEventListener('click', () => {
    const apiKey = document.getElementById('apiKey').value;
    const baseUrl = document.getElementById('baseUrl').value;
    const saveFolder = document.getElementById('saveFolder').value;
    const useHttps = document.getElementById('useHttps').checked;

    chrome.storage.local.set({
        obsidianApiKey: apiKey,
        obsidianBaseUrl: baseUrl,
        obsidianSaveFolder: saveFolder,
        obsidianUseHttps: useHttps
    }, () => {
        const status = document.getElementById('status');
        status.textContent = 'Settings saved.';
        status.className = 'success';
        setTimeout(() => { status.textContent = 'Ready'; status.className = ''; }, 2000);
    });
});

function restoreSettings() {
    chrome.storage.local.get(['obsidianApiKey', 'obsidianBaseUrl', 'obsidianSaveFolder', 'obsidianUseHttps'], (items) => {
        if (items.obsidianApiKey) {
            document.getElementById('apiKey').value = items.obsidianApiKey;
        }
        if (items.obsidianBaseUrl) {
            document.getElementById('baseUrl').value = items.obsidianBaseUrl;
        }
        if (items.obsidianSaveFolder) {
            document.getElementById('saveFolder').value = items.obsidianSaveFolder;
        }
        if (items.obsidianUseHttps !== undefined) {
             document.getElementById('useHttps').checked = items.obsidianUseHttps;
        }
    });
}
