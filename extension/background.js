// extension/background.js

// Configuration defaults

const DEFAULT_BASE_URL = "https://127.0.0.1:27124/";

// Helper to get configuration
async function getConfig() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['obsidianApiKey', 'obsidianBaseUrl', 'obsidianSaveFolder'], (items) => {
            resolve({
                apiKey: items.obsidianApiKey, // User must set this
                baseUrl: items.obsidianBaseUrl || DEFAULT_BASE_URL,
                saveFolder: items.obsidianSaveFolder || ""
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

  // Ensure baseUrl ends with a slash if needed, or handle path joining carefully
  let baseUrl = config.baseUrl;
  if (baseUrl.endsWith('/')) {
      baseUrl = baseUrl.slice(0, -1);
  }

  const url = `${baseUrl}${endpoint}`;

  const headers = {
    "Authorization": `Bearer ${config.apiKey}`
  };

  // Note: Local REST API plugin usually handles content-type detection or expects raw

  const response = await fetch(url, {
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

  const config = await getConfig();
  const saveFolder = config.saveFolder ? config.saveFolder.trim().replace(/^\/+|\/+$/g, '') : "";

  // 1. Upload Assets (Images)
  if (payload.assets && payload.assets.length > 0) {
    for (const asset of payload.assets) {
      try {
        console.log(`Uploading asset: ${asset.filename}`);
        const binaryData = base64ToUint8Array(asset.base64);
        // PUT /vault/attachments/{filename}
        // Assets usually go to attachments folder, but we can also respect saveFolder if we want.
        // For now, let's keep them in attachments/ or a subfolder of saveFolder?
        // Standard Obsidian Local REST behavior: /vault/<path>.
        // Let's put attachments in an 'attachments' subfolder relative to where we save the note?
        // Or just keep global /vault/attachments/ for simplicity as before?
        // Let's keep /vault/attachments/ for now to avoid breaking existing image links unless we rewrite them.
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

  let filepath = `${safeTitle}.md`;
  if (saveFolder) {
      filepath = `${saveFolder}/${filepath}`;
  }

  // Encode filepath components if needed, but fetch usually handles URL encoding.
  // However, for the URL path, we should probably encode URI component if it contains spaces?
  // The fetch API expects a valid URL.
  // Obsidian Local REST API expects the path to be URL-encoded?
  // Let's try to construct the URL path safely.
  // If filepath is "My Folder/My Note.md", the URL should be ".../vault/My%20Folder/My%20Note.md".

  const encodedFilepath = filepath.split('/').map(encodeURIComponent).join('/');

  // Construct final Markdown content
  const frontmatter = `---
url: ${payload.url}
platform: ${payload.platform}
date: ${new Date().toISOString()}
---

# ${payload.title}

`;

  const finalContent = frontmatter + payload.content;

  console.log(`Saving note: ${filepath}`);
  await obsidianRequest(`/vault/${encodedFilepath}`, 'PUT', finalContent);
}
