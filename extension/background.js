// extension/background.js

// Configuration defaults
const DEFAULT_BASE_URL = "https://127.0.0.1:27124/";
const DEFAULT_PORT = 27124; // Keeping for backward compatibility if needed, but mostly unused now

// Helper to get configuration
async function getConfig() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['obsidianApiKey', 'obsidianBaseUrl', 'obsidianSaveFolder', 'obsidianUseHttps', 'obsidianApiPort'], (items) => {
            // Handle migration/fallback: if baseUrl is missing but port exists (old config), construct it?
            // Or just default to DEFAULT_BASE_URL.

            let baseUrl = items.obsidianBaseUrl;
            if (!baseUrl && items.obsidianApiPort) {
                // Fallback for old users who haven't updated settings yet
                const protocol = items.obsidianUseHttps ? "https" : "http";
                baseUrl = `${protocol}://127.0.0.1:${items.obsidianApiPort}`;
            }

            resolve({
                apiKey: items.obsidianApiKey,
                baseUrl: baseUrl || DEFAULT_BASE_URL,
                saveFolder: items.obsidianSaveFolder || "",
                useHttps: items.obsidianUseHttps // Maybe unused if baseUrl is authoritative
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

  // Ensure baseUrl does not end with /
  let baseUrl = config.baseUrl;
  if (baseUrl.endsWith('/')) {
      baseUrl = baseUrl.slice(0, -1);
  }

  // Ensure endpoint starts with /
  if (!endpoint.startsWith('/')) {
      endpoint = '/' + endpoint;
  }

  const url = baseUrl + endpoint;

  const headers = {
    "Authorization": `Bearer ${config.apiKey}`
  };

  // Note: Local REST API plugin usually handles content-type detection or expects raw
  // If we wanted to set Content-Type: 'text/markdown', we could.
  // For binary, we might leave it or set 'application/octet-stream' but fetch usually handles Blob/TypedArray automatically?
  // Actually, for fetch with Uint8Array, it often sets no content-type or generic one.
  // The Obsidian Local REST API seems lenient.

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

  // Encode filepath components
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
