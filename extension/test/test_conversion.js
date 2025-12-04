// extension/test/test_conversion.js
const fs = require('fs');
const path = require('path');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const TurndownService = require('turndown');
const { createCustomTurndownService } = require('../lib/turndown-service.js');

// 1. Setup JSDOM environment
const dom = new JSDOM(`<!DOCTYPE html>
<html>
<body>
  <main>
    <div class="message user">
        <p>Calculate the integral of x^2.</p>
    </div>

    <!-- DeepSeek Thinking Block -->
    <div class="ds-thinking">
        This is a thinking process.
        Step 1: Identify the function.
        Step 2: Apply power rule.
    </div>

    <div class="message assistant">
        <p>The integral is:</p>

        <!-- Inline Math -->
        <span class="katex">
            <span class="katex-mathml"><math>...</math></span>
            <annotation encoding="application/x-tex">\\int x^2 dx</annotation>
        </span>

        <p>And the block form:</p>

        <!-- Block Math -->
        <div class="katex-display">
             <span class="katex">
                <annotation encoding="application/x-tex">\\frac{x^3}{3} + C</annotation>
             </span>
        </div>

        <p>Here is the python code:</p>

        <!-- Code Block Example -->
        <div class="ds-code-block">
            <div class="header">
                <span class="language-label">python</span>
                <button class="copy-btn">Copy</button>
            </div>
            <pre>def integrate(x):
    return (x**3) / 3</pre>
        </div>
    </div>
  </main>
</body>
</html>`);

const { window } = dom;
const { document } = window;

// 2. Run the Conversion
console.log("Initializing Turndown Service...");
const service = createCustomTurndownService(TurndownService);

console.log("Converting DOM to Markdown...");
// Select the main content
const content = document.querySelector('main');
const markdown = service.turndown(content);

// 3. Output and Assert
console.log("\n--- Generated Markdown ---\n");
console.log(markdown);
console.log("\n--------------------------\n");

// Assertions
let failures = [];

if (!markdown.includes('> [!THINK]')) failures.push("DeepSeek Thinking block not converted to Callout.");
if (!markdown.includes('$\\int x^2 dx$')) failures.push("Inline math not correct.");
if (!markdown.includes('$$\\frac{x^3}{3} + C$$')) failures.push("Block math not correct.");
if (!markdown.includes('```python')) failures.push("Code block language missing.");
if (!markdown.includes('def integrate(x):')) failures.push("Code content missing.");

// Check for duplicates (heuristic)
const pythonMatches = markdown.match(/python/g);
if (pythonMatches && pythonMatches.length > 2) {
    // "Here is the python code" + "```python" = 2. Any more is likely noise.
    failures.push("Duplicate language label detected (Scraping noise).");
}

if (failures.length > 0) {
    console.error("TEST FAILED:");
    failures.forEach(f => console.error("- " + f));
    process.exit(1);
} else {
    console.log("TEST PASSED: All structural elements preserved.");
}
