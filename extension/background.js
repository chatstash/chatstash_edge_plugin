// extension/background.js

// The Bridge: Handles communication between Content Script (Browser) and Local Server (Obsidian)

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'SAVE_TO_OBSIDIAN') {
        saveToObsidian(request.payload, request.config)
            .then(() => sendResponse({ status: 'success' }))
            .catch(err => sendResponse({ status: 'error', message: err.toString() }));
        return true; // Keep channel open for async response
    }
});

async function saveToObsidian(markdown, config) {
    const { apiKey, filename } = config;
    const port = config.port || 27124;
    // Ensure filename ends with .md
    const safeFilename = filename.endsWith('.md') ? filename : `${filename}.md`;

    const endpoint = `http://127.0.0.1:${port}/vault/${safeFilename}`;

    console.log(`Saving to ${endpoint}...`);

    try {
        const response = await fetch(endpoint, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'text/markdown'
            },
            body: markdown
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Obsidian API Error ${response.status}: ${errorText}`);
        }
        console.log("Save successful");
    } catch (error) {
        console.error("Fetch failed:", error);
        throw error;
    }
}
