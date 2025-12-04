// tests/verify_parsing.js
const fs = require('fs');
const path = require('path');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const createTurndownService = require('../extension/lib/turndown-setup.js');

const turndownService = createTurndownService();

// Mock Browser Environment for Turndown if needed (Turndown works in Node, but our rules might use DOM APIs)
// Actually Turndown uses JSDOM under the hood in Node, but let's see.
// Our custom rules use `node.classList` etc. which Turndown provides.

function testDeepSeek() {
    console.log('--- Testing DeepSeek Parsing ---');
    const html = fs.readFileSync(path.join(__dirname, 'fixtures/deepseek.html'), 'utf8');

    // We need to simulate the "Scrape Strategy" which selects specific parts.
    // In `content.js`, we select `.ds-chat-message`.
    // Here we will just run Turndown on the whole fixture as if it was the container content.
    // But wait, content.js logic iterates nodes.

    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Simulate content.js convertNodesToMarkdown
    const nodes = document.querySelectorAll('.ds-chat-message');
    let output = '';
    nodes.forEach(node => {
        output += turndownService.turndown(node.innerHTML) + '\n\n---\n\n';
    });

    console.log(output);

    // Assertions
    if (!output.includes('$$a^2 + b^2 = c^2$$') && !output.includes('$a^2 + b^2 = c^2$')) {
        console.error('FAIL: MathJax/KaTeX not preserved.');
        process.exit(1);
    }
    if (!output.includes('```python')) {
        console.error('FAIL: Code block language not preserved.');
        process.exit(1);
    }
    if (!output.includes('> [!THINK] Deep Thinking')) {
        console.error('FAIL: Thinking chain not converted to callout.');
        process.exit(1);
    }
    console.log('PASS: DeepSeek features verified.');
}

function testDoubao() {
    console.log('\n--- Testing Doubao Parsing ---');
    const html = fs.readFileSync(path.join(__dirname, 'fixtures/doubao.html'), 'utf8');
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Simulate content.js Doubao Strategy (TreeWalker is hard to mock perfectly with just innerHTML logic,
    // but let's try the fallback or selector logic).
    // content.js uses TreeWalker or specific attributes.

    const messages = document.querySelectorAll('div[data-role]');
    let output = '';
    messages.forEach(node => {
        let prefix = node.getAttribute('data-role') === 'user' ? '**User:**\n' : '**AI:**\n';
        output += prefix + turndownService.turndown(node.innerHTML) + '\n\n---\n\n';
    });

    console.log(output);

    if (!output.includes('> [!INFO] Artifact')) {
        console.error('FAIL: Artifact not handled.');
        process.exit(1);
    }
    console.log('PASS: Doubao features verified.');
}

testDeepSeek();
testDoubao();
