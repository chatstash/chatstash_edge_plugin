// content.js - DOM Parser & Data Extractor

// Initialize Turndown Service (assumes turndown.js and turndown-setup.js are loaded)
const turndownService = window.createTurndownService();

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'TRIGGER_SCRAPE') {
        scrapeAndProcess(request.config)
            .then(() => sendResponse({ status: 'success' }))
            .catch(err => sendResponse({ status: 'error', message: err.message }));
        return true; // Async response
    }
});

async function scrapeAndProcess(config) {
    const url = window.location.href;
    let markdown = '';

    if (url.includes('chat.deepseek.com')) {
        markdown = await scrapeDeepSeek();
    } else if (url.includes('doubao.com')) {
        markdown = await scrapeDoubao();
    } else {
        throw new Error('Unsupported site');
    }

    if (!markdown) {
        throw new Error('No content found to scrape.');
    }

    // Process images (download and upload)
    const { processedMarkdown, images } = await processImages(markdown, config);

    // Send final payload to background for saving
    await chrome.runtime.sendMessage({
        type: 'SAVE_TO_OBSIDIAN',
        payload: processedMarkdown,
        config: config
    });
}

/**
 * DeepSeek Scraper
 */
async function scrapeDeepSeek() {
    // Strategy: Look for the chat message container list
    // Selectors are heuristic and based on typical React app structures + report hints
    const chatContainer = document.querySelector('div[class*="chat-message-list"]') ||
                          document.querySelector('div[role="presentation"]'); // Fallback

    if (!chatContainer) {
        console.warn('DeepSeek: Chat container not found via standard selectors.');
        // Try to grab the main chunks directly
        return convertNodesToMarkdown(document.querySelectorAll('.ds-chat-message, .chat-message'));
    }

    return turndownService.turndown(chatContainer.innerHTML);
}

/**
 * Doubao Scraper
 */
async function scrapeDoubao() {
    // Strategy: Use a TreeWalker or specific attributes as Doubao classes are obfuscated
    // Looking for [data-role="user"] and [data-role="assistant"] if available

    const messages = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, {
        acceptNode: function(node) {
            // Heuristic for message containers
            if (node.hasAttribute('data-message-id') ||
                node.getAttribute('data-role') === 'user' ||
                node.getAttribute('data-role') === 'assistant') {
                return NodeFilter.FILTER_ACCEPT;
            }
            return NodeFilter.FILTER_SKIP;
        }
    });

    let currentNode;
    while (currentNode = walker.nextNode()) {
        messages.push(currentNode);
    }

    if (messages.length === 0) {
        // Fallback: Try to find the main scroll container
        const container = document.querySelector('main');
        if (container) return turndownService.turndown(container.innerHTML);

        throw new Error('Doubao: Could not locate chat messages.');
    }

    return convertNodesToMarkdown(messages);
}

function convertNodesToMarkdown(nodeList) {
    let md = '';
    nodeList.forEach(node => {
        // Identify role for formatting (optional)
        let prefix = '';
        if (node.textContent.includes('User') || node.getAttribute('data-role') === 'user') {
            prefix = '**User:**\n';
        } else {
            prefix = '**AI:**\n';
        }

        md += prefix + turndownService.turndown(node.innerHTML) + '\n\n---\n\n';
    });
    return md;
}

/**
 * Image Processing
 * Extracts image URLs, downloads them, converts to Base64, uploads to Obsidian,
 * and replaces links in Markdown.
 */
async function processImages(markdown, config) {
    // Regex to find images: ![alt](url)
    const imgRegex = /!\[.*?\]\((.*?)\)/g;
    const matches = [...markdown.matchAll(imgRegex)];

    if (matches.length === 0) return { processedMarkdown: markdown, images: [] };

    let newMarkdown = markdown;
    const images = [];

    for (const match of matches) {
        const fullTag = match[0];
        const src = match[1];

        try {
            // 1. Download image
            const response = await fetch(src);
            const blob = await response.blob();

            // 2. Generate a filename (hash or timestamp)
            const ext = blob.type.split('/')[1] || 'png';
            const filename = `img-${Date.now()}-${Math.random().toString(36).substr(2, 5)}.${ext}`;

            // 3. Convert to ArrayBuffer for transfer to background
            // Note: We can't send Blob objects directly via chrome.runtime.sendMessage easily in all cases,
            // but we can send Base64 or we can let Background handle the fetch if we pass the URL.
            // However, Content Script has access to the authenticated session (cookies) which is crucial for
            // fetching images from the chat interface (private URLs).
            // So we MUST fetch here.

            // Convert to Base64 for safe transport
            const base64 = await blobToBase64(blob);

            // 4. Upload to Obsidian (via Background to avoid Mixed Content/CORS if direct put fails)
            // Actually, we delegate the upload to the background script entirely.
            // We'll replace the link with the final obsidian link format now, assuming success?
            // Or better: We send the base64 to background, background uploads, returns success.
            // But to keep this function clean, let's assume we can ask background to upload ONE image.

            const uploadResponse = await chrome.runtime.sendMessage({
                type: 'UPLOAD_IMAGE',
                payload: { filename, base64 },
                config: config
            });

            if (uploadResponse && uploadResponse.status === 'success') {
                // Replace in Markdown: ![[filename]]
                newMarkdown = newMarkdown.replace(fullTag, `![[${filename}]]`);
            }

        } catch (e) {
            console.error('Failed to process image:', src, e);
            // Keep original link if failed
        }
    }

    return { processedMarkdown: newMarkdown, images };
}

function blobToBase64(blob) {
    return new Promise((resolve, _) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]); // remove data:image/png;base64, prefix
        reader.readAsDataURL(blob);
    });
}
