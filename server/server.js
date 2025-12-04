const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 27124;
const VAULT_ROOT = path.join(__dirname, '../test_vault');
const AUTH_TOKEN = 'secret-key';

// Middleware
app.use(cors());
app.use(bodyParser.text({ type: 'text/markdown', limit: '50mb' }));
app.use(bodyParser.raw({ type: 'image/*', limit: '50mb' }));
app.use(bodyParser.json({ limit: '50mb' })); // For other metadata if needed

// Auth Middleware
const checkAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${AUTH_TOKEN}`) {
        console.log(`[401] Unauthorized access attempt: ${authHeader}`);
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

// Ensure vault directory exists
if (!fs.existsSync(VAULT_ROOT)) {
    fs.mkdirSync(VAULT_ROOT, { recursive: true });
}

// Routes
app.get('/', (req, res) => {
    res.send('Obsidian Local REST API Mock Server is running.');
});

// PUT /vault/<filepath>
// Using a regex for the path to be safe with newer path-to-regexp
app.put(/\/vault\/(.*)/, checkAuth, (req, res) => {
    const relativePath = req.params[0];

    // Security Check: Prevent directory traversal using path.resolve
    const fullPath = path.join(VAULT_ROOT, relativePath);
    const resolvedPath = path.resolve(fullPath);
    const resolvedRoot = path.resolve(VAULT_ROOT);

    if (!resolvedPath.startsWith(resolvedRoot)) {
        console.log(`[SECURITY] Blocked directory traversal attempt: ${relativePath} -> ${resolvedPath}`);
        return res.status(403).json({ error: 'Access denied: Path traversal detected' });
    }

    const dirPath = path.dirname(fullPath);

    console.log(`[PUT] Saving file: ${relativePath}`);

    // Create directory if it doesn't exist
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }

    // Determine content to write
    let content = req.body;

    // If it's an image upload (raw buffer)
    if (Buffer.isBuffer(req.body)) {
        console.log(`[PUT] Writing binary data (${req.body.length} bytes)`);
    } else if (typeof req.body === 'object') {
        // Fallback for JSON body if sent accidentally
        content = JSON.stringify(req.body, null, 2);
    }

    fs.writeFile(fullPath, content, (err) => {
        if (err) {
            console.error(`[ERROR] Failed to write file: ${err.message}`);
            return res.status(500).json({ error: err.message });
        }
        console.log(`[SUCCESS] File saved.`);
        res.status(200).send('File saved successfully.');
    });
});

// GET /vault/<filepath> (Optional, for verification)
app.get(/\/vault\/(.*)/, checkAuth, (req, res) => {
    const relativePath = req.params[0];
    const fullPath = path.join(VAULT_ROOT, relativePath);

    if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    res.sendFile(fullPath);
});


app.listen(PORT, () => {
    console.log(`Mock Obsidian Server running on http://127.0.0.1:${PORT}`);
    console.log(`Vault Root: ${VAULT_ROOT}`);
    console.log(`Auth Token: ${AUTH_TOKEN}`);
});
