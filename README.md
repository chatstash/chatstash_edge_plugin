# Obsidian AI Bridge

A custom dual-plugin architecture to seamlessly capture and sync AI conversation logs (from DeepSeek, Doubao, etc.) directly into your local Obsidian vault.

## 🚀 Overview

This tool solves the "Knowledge Silo" problem by bridging the gap between dynamic Web AI interfaces and your static local knowledge base. It uses a **Browser Extension** to scrape and format chat content and a **Localhost Loopback** mechanism to push data to Obsidian via the **Local REST API** plugin.

### Key Features
*   **High-Fidelity Markdown**: Preserves complex structures like Code Blocks, Tables, and Formatting.
*   **MathJax/KaTeX Restoration**: Correctly converts rendered math formulas back to LaTeX source (`$x^2$`, `$$ \int f(x) dx $$`).
*   **DeepSeek "Thinking" Support**: Automatically captures DeepSeek R1's "Chain of Thought" and wraps it in an Obsidian Callout (`> [!THINK]`).
*   **Local & Secure**: Data flows directly from your browser to your local machine (localhost). No third-party cloud servers involved.

## 🏗 Architecture

1.  **Publisher (Browser Extension)**:
    *   Injected into `chat.deepseek.com` and `doubao.com`.
    *   Parses the DOM using a custom `Turndown` engine.
    *   Sanitizes and formats data.
    *   Sends data to the background script to bypass CORS/Mixed-Content restrictions.
2.  **Subscriber (Obsidian)**:
    *   Uses the community plugin **Local REST API**.
    *   Listens on `http://127.0.0.1:27124`.
    *   Receives Markdown and saves it to your Vault.

## 🛠 Installation & Setup

### 1. Obsidian Setup
1.  Open Obsidian Settings > Community Plugins > Browse.
2.  Search for and install **Local REST API** (by coddingtonbear).
3.  Enable the plugin.
4.  In the plugin settings:
    *   Copy your **API Key**.
    *   **Development Mode**: You may need to enable "Enable Non-Encrypted (HTTP) Server" if you don't want to deal with self-signed certificates for localhost.

### 2. Browser Extension Setup (Developer Mode)
1.  Clone or download this repository.
2.  Open Chrome/Edge and navigate to `chrome://extensions`.
3.  Enable **Developer mode** (top right toggle).
4.  Click **Load unpacked**.
5.  Select the `extension` folder from this project.

## 🧪 Development & Testing

### Prerequisites
*   Node.js and npm

### Running Tests
The project includes a test suite that uses `jsdom` to simulate the AI chat interface and verify the Markdown conversion logic.

```bash
# 1. Install dependencies
npm init -y
npm install turndown jsdom

# 2. Run the conversion test
node extension/test/test_conversion.js
```

### Mock Server
To test the extension without opening Obsidian, use the included Python mock server:

```bash
# Starts a server at http://127.0.0.1:27124
python3 mock_obsidian.py
```

Files sent by the extension will be saved to the `mock_vault/` directory.

## 📝 License
MIT
