// extension/content.js

// This script injects into the page.
// In a real extension, we would import createCustomTurndownService.
// Here we assume it's loaded.

// Configuration (Managed via Popup in real life)
const CONFIG = {
    apiKey: "test_key_123", // Placeholder
    port: 27124
};

function getTurndownService() {
    // In the real extension, TurndownService is available via a library script in manifest
    // For this mock content script, we rely on the global scope or bundle.
    // If running in Node test, we inject it.
    if (typeof createCustomTurndownService === 'function') {
        // We need the actual TurndownService constructor.
        // In browser: window.TurndownService
        // In node: require('turndown')
        const Turndown = (typeof TurndownService !== 'undefined') ? TurndownService : window.TurndownService;
        return createCustomTurndownService(Turndown);
    }
    return null;
}

function extractChatContent() {
    const service = getTurndownService();
    if (!service) {
        console.error("Turndown service not initialized");
        return null;
    }

    // 1. Identify the Main Chat Container
    // This selector needs to be robust.
    // DeepSeek: often a specific ID or main role.
    // Fallback: document.body
    const mainContainer = document.querySelector('main') || document.body;

    // 2. Clone to avoid modifying the page
    // We clone so we can manipulate DOM (remove noise) before converting
    const clone = mainContainer.cloneNode(true);

    // 3. Convert to Markdown
    const markdown = service.turndown(clone);

    // 4. Post-processing (Metadata, Title)
    const title = document.title || "AI Chat Export";
    const header = `# ${title}\n\nDate: ${new Date().toISOString()}\n\n---\n\n`;

    return header + markdown;
}

// Message Listener (Triggered by Background script or Popup)
if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.type === 'EXTRACT_CONTENT') {
            try {
                const md = extractChatContent();
                sendResponse({ status: 'success', data: md });
            } catch (e) {
                sendResponse({ status: 'error', message: e.toString() });
            }
        }
        return true;
    });
}

// Export for testing
if (typeof module !== 'undefined') {
    module.exports = { extractChatContent };
}
