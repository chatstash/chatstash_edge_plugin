// background.js - The Bridge

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'SAVE_TO_OBSIDIAN') {
        handleSave(request.payload, request.config)
           .then(() => sendResponse({ status: 'success' }))
           .catch(err => sendResponse({ status: 'error', message: err.toString() }));
        return true; // Keep message channel open for async response
    }

    if (request.type === 'UPLOAD_IMAGE') {
        handleImageUpload(request.payload, request.config)
            .then(() => sendResponse({ status: 'success' }))
            .catch(err => sendResponse({ status: 'error', message: err.toString() }));
        return true;
    }
});

/**
 * Handles the logic to save markdown content to Obsidian via Local REST API.
 * @param {string} markdown - The markdown content to save.
 * @param {Object} config - Configuration object (apiKey, filename, vault path etc).
 */
async function handleSave(markdown, config) {
    const { apiKey, filename } = config;
    // Default to localhost:27124 if not specified
    const baseUrl = config.baseUrl || 'http://127.0.0.1:27124';

    // Ensure filename ends with .md and handles subdirectories if needed
    // Sanitize filename to prevent directory traversal
    const sanitizedBase = filename.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    const safeFilename = sanitizedBase.endsWith('.md') ? sanitizedBase : `${sanitizedBase}.md`;

    const endpoint = `${baseUrl}/vault/${safeFilename}`;

    console.log(`[Background] Uploading to ${endpoint}`);

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

        console.log('[Background] Save successful');
    } catch (error) {
        console.error('[Background] Save failed', error);
        throw error;
    }
}

async function handleImageUpload(payload, config) {
    const { filename, base64 } = payload;
    const { apiKey } = config;
    const baseUrl = config.baseUrl || 'http://127.0.0.1:27124';

    // Convert Base64 back to binary for upload
    // Note: fetch can take a Blob or ArrayBuffer.
    const binary = atob(base64);
    const len = binary.length;
    const buffer = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        buffer[i] = binary.charCodeAt(i);
    }

    // Upload to attachments/ folder (default obsidian behavior often puts images in root or specific folder)
    // We'll try to put them in an 'attachments' folder to be tidy.
    const endpoint = `${baseUrl}/vault/attachments/${filename}`;

    try {
        const response = await fetch(endpoint, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'image/png' // Generic, or detect from filename
            },
            body: buffer
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Obsidian Image Upload Error ${response.status}: ${errorText}`);
        }
    } catch (error) {
        console.error('[Background] Image Upload failed', error);
        throw error;
    }
}
