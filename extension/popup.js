document.addEventListener('DOMContentLoaded', () => {
    // Load saved settings
    chrome.storage.local.get(['apiKey'], (result) => {
        if (result.apiKey) {
            document.getElementById('apiKey').value = result.apiKey;
        }
    });

    document.getElementById('saveBtn').addEventListener('click', async () => {
        const apiKey = document.getElementById('apiKey').value;
        const filename = document.getElementById('filename').value || `AI-Chat-${Date.now()}`;
        const statusDiv = document.getElementById('status');

        if (!apiKey) {
            statusDiv.textContent = 'Error: API Key required.';
            statusDiv.style.color = 'red';
            return;
        }

        // Save API Key for future use
        chrome.storage.local.set({ apiKey });

        statusDiv.textContent = 'Processing...';

        // Query active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab) {
             statusDiv.textContent = 'Error: No active tab.';
             return;
        }

        // Send message to content script to start scraping
        chrome.tabs.sendMessage(tab.id, {
            type: 'TRIGGER_SCRAPE',
            config: { apiKey, filename }
        }, (response) => {
            if (chrome.runtime.lastError) {
                 statusDiv.textContent = 'Error: ' + chrome.runtime.lastError.message;
                 statusDiv.style.color = 'red';
            } else if (response && response.status === 'success') {
                 statusDiv.textContent = 'Success! Saved to Obsidian.';
                 statusDiv.style.color = 'green';
            } else {
                 statusDiv.textContent = 'Failed: ' + (response ? response.message : 'Unknown error');
                 statusDiv.style.color = 'red';
            }
        });
    });
});
