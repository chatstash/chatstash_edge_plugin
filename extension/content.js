// extension/content.js

console.log("Obsidian Bridge Content Script Loaded");

// Initialize Turndown
// Note: 'TurndownService' is injected via lib/turndown.js and createCustomTurndownService via lib/turndown-service.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "SCRAPE_PAGE") {
        scrapePage()
            .then(payload => {
                chrome.runtime.sendMessage({ action: "SAVE_PAYLOAD", payload: payload }, (response) => {
                    if (response && response.status === 'success') {
                        sendResponse({ status: 'success' });
                    } else {
                        sendResponse({ status: 'error', message: response ? response.message : "Unknown background error" });
                    }
                });
            })
            .catch(err => {
                console.error("Scraping failed:", err);
                sendResponse({ status: 'error', message: err.message });
            });
        return true; // Async response
    }
});

async function scrapePage() {
    const platform = detectPlatform();
    console.log("Detected Platform:", platform);

    const title = getTitle(platform);
    const container = getContentContainer(platform);

    if (!container) {
        throw new Error("Could not find content container. Please ensure the chat is visible.");
    }

    // Clone to avoid modifying the active page
    const clone = container.cloneNode(true);
    const assets = [];

    // Process Images
    const images = clone.querySelectorAll('img');
    for (let i = 0; i < images.length; i++) {
        const img = images[i];

        // Filter out small icons/avatars (heuristic)
        if (img.width < 100 && img.height < 100) continue;

        // Skip if src is missing or empty
        if (!img.src) continue;

        try {
            const base64 = await imageToBase64(img.src);
            if (base64) {
                const ext = getExtensionFromSrc(img.src) || 'png';
                // Unique filename
                const filename = `img_${Date.now()}_${i}.${ext}`;

                assets.push({
                    filename: filename,
                    base64: base64
                });

                // Update src to relative path for Obsidian
                img.src = `attachments/${filename}`;
                img.alt = filename;

                // Add a marker class to ensure we can identify it if needed,
                // though Turndown usually handles <img> tags fine.
            }
        } catch (e) {
            console.warn("Failed to process image:", img.src, e);
        }
    }

    const turndownService = createCustomTurndownService(TurndownService);
    let markdown = turndownService.turndown(clone);

    // Post-process: specific fixes
    // 1. Obsidian Image Links: ![alt](attachments/filename) -> ![[filename]]
    markdown = markdown.replace(/!\[.*?\]\(attachments\/(.*?)\)/g, '![[$1]]');

    // 2. Remove multiple blank lines
    markdown = markdown.replace(/\n{3,}/g, '\n\n');

    return {
        url: window.location.href,
        platform: platform,
        title: title,
        content: markdown,
        assets: assets
    };
}

function detectPlatform() {
    const host = window.location.hostname;
    if (host.includes('deepseek')) return 'deepseek';
    if (host.includes('doubao')) return 'doubao';
    if (host.includes('chatgpt')) return 'chatgpt';
    if (host.includes('gemini') || host.includes('google')) return 'gemini';
    return 'unknown';
}

function getTitle(platform) {
    // Try to find a chat title in the DOM
    if (platform === 'deepseek') {
        const titleEl = document.querySelector('title'); // Often dynamic
        return titleEl ? titleEl.innerText : "DeepSeek Chat";
    }
    return document.title || "Saved Chat";
}

function getContentContainer(platform) {
    if (platform === 'deepseek') {
        // Look for the main chat area
        // Fallback: document.body
        return document.querySelector('#root') || document.body;
    }
    if (platform === 'doubao') {
        // Doubao: Try to find the message list container
        // Strategy: Look for a container that has many children with text
        // Or specific ID 'root' or 'app'
        const app = document.querySelector('#app') || document.querySelector('#root');
        if (app) return app;

        // Strategy from prompt: "Find avatar img -> parent -> sibling"
        // This is brittle without actual DOM access to test.
        // Fallback to body.
        return document.body;
    }
    if (platform === 'chatgpt') {
         // ChatGPT usually puts chat in main
         return document.querySelector('main') || document.body;
    }
    return document.body;
}

function imageToBase64(url) {
    return new Promise((resolve, reject) => {
        if (url.startsWith('data:')) {
            resolve(url);
            return;
        }

        // Try fetch
        fetch(url)
            .then(response => response.blob())
            .then(blob => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            })
            .catch(err => {
                console.warn("Direct fetch failed for", url, err);
                resolve(null);
            });
    });
}

function getExtensionFromSrc(src) {
    try {
        const url = new URL(src);
        const path = url.pathname;
        if (path.endsWith('.png')) return 'png';
        if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'jpg';
        if (path.endsWith('.webp')) return 'webp';
        if (path.endsWith('.gif')) return 'gif';
    } catch (e) {
        // ignore
    }
    if (src.includes('data:image/png')) return 'png';
    if (src.includes('data:image/jpeg')) return 'jpg';
    if (src.includes('data:image/webp')) return 'webp';
    return 'png';
}
