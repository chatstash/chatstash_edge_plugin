// extension/lib/turndown-service.js
// This file runs in the browser extension content script context.
// In a real build step, we would bundle 'turndown' or import it.
// For this environment, we assume 'TurndownService' is available globally
// or injected via the test runner.

function createCustomTurndownService(TurndownService) {
    const service = new TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced'
    });

    // --- Rule 1: MathJax / KaTeX Handling ---
    // AI pages often render math as:
    // <span class="katex">...<annotation encoding="application/x-tex">RAW_TEX</annotation>...</span>
    service.addRule('math-katex', {
        filter: function (node) {
            return node.classList.contains('katex') || node.classList.contains('MathJax');
        },
        replacement: function (content, node) {
            // Try to find the raw TeX source
            const texAnnotation = node.querySelector('annotation[encoding="application/x-tex"]');
            if (texAnnotation) {
                // Determine if it's block or inline
                // Check if the node itself is block-like, or if its parent dictates block display (katex-display)
                const isBlock = node.classList.contains('katex-display') ||
                                node.tagName === 'DIV' ||
                                (node.parentElement && node.parentElement.classList.contains('katex-display'));

                const delimiter = isBlock ? '$$' : '$';
                return `${delimiter}${texAnnotation.textContent}${delimiter}`;
            }

            // Fallback: Check for data attributes (common in some implementations)
            const altTex = node.getAttribute('data-tex');
            if (altTex) return `$${altTex}$`;

            return node.textContent;
        }
    });

    // --- Rule 2: Code Blocks with Syntax Highlighting ---
    // Structure often: <div class="code-block"><div header>cpp</div><pre>...</pre></div>
    service.addRule('code-fenced-enhanced', {
        filter: function (node) {
            return node.nodeName === 'PRE';
        },
        replacement: function (content, node) {
            let language = '';
            // Look up the tree for a container that might have the language label
            // DeepSeek specific: might be in a sibling or parent header
            const wrapper = node.closest('.code-block-wrapper') || node.closest('.ds-code-block') || node.parentElement;

            if (wrapper) {
                // Try various common selectors for language labels
                const langLabel = wrapper.querySelector('.language-label') ||
                                  wrapper.querySelector('.code-lang') ||
                                  wrapper.querySelector('span'); // Heuristic

                // If the span text looks like a language (short, no spaces), use it
                if (langLabel && langLabel.textContent.length < 20 && !langLabel.textContent.includes(' ')) {
                    language = langLabel.textContent.trim().toLowerCase();
                }
            }

            // Clean up the code content (sometimes contains line numbers if not handled)
            const codeContent = node.textContent.trim();

            return `\n\`\`\`${language}\n${codeContent}\n\`\`\`\n`;
        }
    });

    // --- Rule 3: DeepSeek Chain of Thought (Thinking Process) ---
    // DeepSeek R1 puts thinking in a container. We want to convert this to a Callout.
    // Example: <div class="ds-thinking">...</div>
    service.addRule('deepseek-thinking', {
        filter: function (node) {
            // Detect thinking container by class or specific structure
            // Note: Update these selectors based on actual DOM inspection of DeepSeek
            return node.classList.contains('ds-thinking') ||
                   (node.classList.contains('thinking-process'));
        },
        replacement: function (content, node) {
            // Create an Obsidian Callout
            return `\n> [!THINK]\n> ${content.replace(/\n/g, '\n> ')}\n`;
        }
    });

    // --- Rule 4: Clean up noise ---
    // Remove "Copy" buttons, "Regenerate" text, AND header labels handled by code block rule
    service.addRule('remove-noise', {
        filter: function(node) {
            const classes = node.className || '';
            if (typeof classes === 'string') {
                if (classes.includes('copy-btn') || classes.includes('regenerate-btn')) return true;

                // Suppress headers/labels inside code blocks because we extracted them in Rule 2
                if ((classes.includes('header') || classes.includes('language-label')) &&
                    (node.closest('.ds-code-block') || node.closest('.code-block-wrapper'))) {
                    return true;
                }
            }
            return false;
        },
        replacement: function() {
            return '';
        }
    });

    return service;
}

// Export for Node.js testing, valid for browser if bundled
if (typeof module !== 'undefined') {
    module.exports = { createCustomTurndownService };
}
