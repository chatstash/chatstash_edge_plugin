# Obsidian Neural Bridge (ONB)

Obsidian Neural Bridge is a browser extension designed to capture high-fidelity chat logs from AI platforms like **DeepSeek**, **Doubao**, **ChatGPT**, and **Gemini** and save them directly to your **Obsidian** vault.

It preserves:
- **Math Formulas**: LaTeX rendering for MathJax/KaTeX.
- **Code Blocks**: Syntax highlighting languages.
- **Thinking Process**: DeepSeek R1's chain of thought is captured as `> [!THINK]` callouts.
- **Images**: Automatically downloads and saves images to your vault's attachments.

## Architecture

- **Browser Extension (Publisher)**: Scrapes the DOM, converts HTML to Markdown (using Turndown), and sends data to the local server.
- **Obsidian Plugin (Subscriber)**: Uses the **Local REST API** community plugin (or a custom implementation) to receive files via HTTP requests on localhost.

## Installation

### 1. Obsidian Setup
1. Install the **Local REST API** plugin from the Obsidian Community Plugins list.
2. Enable the plugin.
3. Go to the plugin settings:
   - Copy the **API Key**.
   - Note the **Port** (default is `27124`).
   - Ensure "Enable HTTPS" is configured if needed (this extension defaults to HTTP for localhost, but you can configure the URL).

### 2. Browser Extension Setup
1. Clone this repository.
2. Open Chrome/Edge and navigate to `chrome://extensions`.
3. Enable **Developer Mode**.
4. Click **Load unpacked** and select the `extension` folder from this repository.

## Usage

1. Open a chat on a supported platform (e.g., DeepSeek, ChatGPT).
2. Click the **Obsidian Neural Bridge** icon in the toolbar.
3. Click **Settings** to configure your **Obsidian API Key** and **Port**.
4. Click **Save Chat to Obsidian**.
5. Wait for the "Saved!" message.
6. Check your Obsidian vault for the new note!

## Development

### Mock Server
To test without Obsidian running, use the included Python mock server:

```bash
python3 mock_obsidian.py
```

This starts a server at `http://127.0.0.1:27124` using the key `test_key_123`.

### Project Structure
- `extension/`: The browser extension source code.
    - `manifest.json`: Manifest V3 configuration.
    - `background.js`: Handles API requests to Obsidian.
    - `content.js`: Injected script to scrape and process DOM.
    - `lib/`: Dependencies (Turndown).
- `mock_obsidian.py`: Simple Python server for testing.
