// extension/background.js

// Configuration defaults
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 27124;

// Helper to get configuration
async function getConfig() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['obsidianApiKey', 'obsidianApiPort', 'obsidianSaveDir', 'obsidianUseHttps'], (items) => {
            resolve({
                apiKey: items.obsidianApiKey,
                port: items.obsidianApiPort || DEFAULT_PORT,
                saveDir: items.obsidianSaveDir || "",
                useHttps: items.obsidianUseHttps || false
            });
        });
    });
}

// Helper to sanitize filename
function sanitizeFilename(name) {
    return name.replace(/[\\/:*?"<>|]/g, "-").trim();
}

// Helper to construct path
function joinPath(dir, filename) {
    if (!dir) return filename;
    // Normalize slashes
    let path = dir.replace(/\\/g, '/');
    // Remove leading/trailing slashes from dir to avoid double slashes or root confusion
    path = path.replace(/^\/+|\/+$/g, '');

    if (path.length === 0) return filename;

    return `${path}/${filename}`;
}

// Helper to make requests to Obsidian
async function obsidianRequest(endpoint, method, body, isBinary = false) {
  const config = await getConfig();

  if (!config.apiKey) {
      throw new Error("Obsidian API Key not set. Please configure in Settings.");
  }

  const protocol = config.useHttps ? "https" : "http";
  const baseUrl = `${protocol}://${DEFAULT_HOST}:${config.port}`;

  // Clean endpoint ensuring it starts with /
  if (!endpoint.startsWith('/')) endpoint = '/' + endpoint;

  const headers = {
    "Authorization": `Bearer ${config.apiKey}`
  };

  try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: method,
        headers: headers,
        body: body
      });

      if (!response.ok) {
        if (response.status === 401) {
            throw new Error("Unauthorized (401). Check your API Key.");
        }
        throw new Error(`Obsidian API Error: ${response.status} ${response.statusText}`);
      }
      return response;
  } catch (error) {
      // Catch network errors (e.g., Failed to fetch)
      if (error.message.includes("Failed to fetch")) {
          throw new Error(`Connection failed. Is Obsidian running? Is the Local REST API plugin enabled? (Tried: ${baseUrl})`);
      }
      throw error;
  }
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
  const config = await getConfig();
  console.log("Processing payload for:", payload.title);

  // 1. Upload Assets (Images)
  // Assets should probably go into an 'attachments' subfolder relative to the save dir?
  // Or just global attachments?
  // Usually Obsidian users have a preference. For now, let's put them in 'attachments/' relative to the vault root
  // OR relative to the note if we want to get fancy.
  // Standard Obsidian Local REST API maps /vault/... to file system.
  // Let's stick to /vault/attachments/ for images to keep them organized,
  // regardless of where the note goes.
  // IMPROVEMENT: If user sets a Save Dir, maybe put images in Save Dir/attachments?
  // Let's keep it simple: /vault/attachments/ is a safe default.

  if (payload.assets && payload.assets.length > 0) {
    for (const asset of payload.assets) {
      try {
        console.log(`Uploading asset: ${asset.filename}`);
        const binaryData = base64ToUint8Array(asset.base64);
        // PUT /vault/attachments/{filename}
        await obsidianRequest(`/vault/attachments/${asset.filename}`, 'PUT', binaryData, true);
      } catch (err) {
        console.error(`Failed to upload asset ${asset.filename}:`, err);
        // Continue anyway
      }
    }
  }

  // 2. Upload Markdown Note
  const safeTitle = sanitizeFilename(payload.title);
  const filename = `${safeTitle}.md`;

  // Construct path based on user setting
  // e.g. /vault/MyFolder/MyNote.md
  const relativePath = joinPath(config.saveDir, filename);

  // Construct final Markdown content
  const frontmatter = `---
url: ${payload.url}
platform: ${payload.platform}
date: ${new Date().toISOString()}
---

# ${payload.title}

`;

  const finalContent = frontmatter + payload.content;

  console.log(`Saving note to: ${relativePath}`);
  await obsidianRequest(`/vault/${relativePath}`, 'PUT', finalContent);
}
