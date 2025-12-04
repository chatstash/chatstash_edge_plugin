// extension/background.js

// Configuration defaults

const DEFAULT_API_BASE = "http://127.0.0.1";
const DEFAULT_PORT = 27124;

// Helper to get configuration
async function getConfig() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['obsidianApiKey', 'obsidianApiPort'], (items) => {
            resolve({
                apiKey: items.obsidianApiKey, // User must set this
                port: items.obsidianApiPort || DEFAULT_PORT
            });
        });
    });
}

// Helper to make requests to Obsidian
async function obsidianRequest(endpoint, method, body, isBinary = false) {
  const config = await getConfig();

  if (!config.apiKey) {
      throw new Error("Obsidian API Key not set. Please configure in extension settings.");
  }

  const baseUrl = `${DEFAULT_API_BASE}:${config.port}`;

  const headers = {
    "Authorization": `Bearer ${config.apiKey}`
  };

  // Note: Local REST API plugin usually handles content-type detection or expects raw

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: method,
    headers: headers,
    body: body
  });

  if (!response.ok) {
    throw new Error(`Obsidian API Error: ${response.status} ${response.statusText}`);
  }
  return response;
}

// Convert Base64 to Blob/Uint8Array
function base64ToUint8Array(base64) {
  const binaryString = atob(base64.split(',')[1]);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "SAVE_PAYLOAD") {
    handleSavePayload(request.payload)
      .then(() => sendResponse({ status: 'success' }))
      .catch((err) => sendResponse({ status: 'error', message: err.message }));
    return true; // Keep channel open for async response
  }
});

async function handleSavePayload(payload) {
  console.log("Processing payload for:", payload.title);

  // 1. Upload Assets (Images)
  if (payload.assets && payload.assets.length > 0) {
    for (const asset of payload.assets) {
      try {
        console.log(`Uploading asset: ${asset.filename}`);
        const binaryData = base64ToUint8Array(asset.base64);
        // PUT /vault/attachments/{filename}
        await obsidianRequest(`/vault/attachments/${asset.filename}`, 'PUT', binaryData, true);
      } catch (err) {
        console.error(`Failed to upload asset ${asset.filename}:`, err);
        // Continue anyway? Or fail? Let's continue to save the text at least.
      }
    }
  }

  // 2. Upload Markdown Note
  // Sanitize filename
  const safeTitle = payload.title.replace(/[\\/:*?"<>|]/g, "-").trim();
  const filename = `${safeTitle}.md`;

  // Construct final Markdown content
  const frontmatter = `---
url: ${payload.url}
platform: ${payload.platform}
date: ${new Date().toISOString()}
---

# ${payload.title}

`;

  const finalContent = frontmatter + payload.content;

  console.log(`Saving note: ${filename}`);
  await obsidianRequest(`/vault/${filename}`, 'PUT', finalContent);
}
