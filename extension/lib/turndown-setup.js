// Turndown Service Configuration and Custom Rules

// Global Turndown Service instance
// We assume TurndownService is available globally via lib/turndown.js in the browser context
// or passed in if using a module system (which we aren't here for simple extension injection).

function createTurndownService() {
    // If TurndownService is not defined (e.g. running in node test without global), require it
    let Service = typeof TurndownService !== 'undefined' ? TurndownService : require('turndown');

    const turndownService = new Service({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced',
        hr: '---',
        bulletListMarker: '-',
        emDelimiter: '*'
    });

    // Rule 1: LaTeX/MathJax Handling
    // Strategy: Look for specific containers and extract the TeX source from <annotation> or custom attributes.
    turndownService.addRule('math', {
        filter: function (node) {
            // Common MathJax/KaTeX containers
            return node.classList.contains('katex') ||
                   node.classList.contains('MathJax') ||
                   node.tagName === 'MJX-CONTAINER';
        },
        replacement: function (content, node) {
            // 1. Try KaTeX Annotation
            const texAnnotation = node.querySelector('annotation[encoding="application/x-tex"]');
            if (texAnnotation) {
                const isBlock = node.classList.contains('katex-display') || node.style.display === 'block';
                const delimiter = isBlock ? '$$' : '$';
                return `${delimiter}${texAnnotation.textContent}${delimiter}`;
            }

            // 2. Try MathJax script tag (common in older implementations or some sites)
            const scriptMath = node.querySelector('script[type="math/tex"]');
            if (scriptMath) {
                return `$${scriptMath.textContent}$`;
            }

            // 3. Try data attributes (sometimes used by DeepSeek/Doubao or fallback)
            const dataTex = node.getAttribute('data-tex');
            if (dataTex) return `$${dataTex}$`;

            // 4. Specific handle for DeepSeek R1 if they use raw text inside a specific span?
            // (Based on report: DeepSeek R1 often has standard katex structure).

            // Fallback: If we can't find the source, we might just return the content
            // but often the content is a mess of HTML spans.
            // If it's a display math, wrap in $$.
            return content;
        }
    });

    // Rule 2: Code Blocks with Highlighting
    // Strategy: Intercept PRE tags, look for language labels in parent containers.
    turndownService.addRule('code-fenced', {
        filter: function (node) {
            return node.nodeName === 'PRE';
        },
        replacement: function (content, node) {
            let language = '';

            // Look for class "language-xyz" on the code tag inside pre
            const codeTag = node.querySelector('code');
            if (codeTag) {
                const classes = codeTag.className.split(/\s+/);
                const langClass = classes.find(c => c.startsWith('language-') || c.startsWith('lang-'));
                if (langClass) {
                    language = langClass.replace(/^(language-|lang-)/, '');
                }
            }

            // If not found, look at parent wrapper (Common in AI UIs)
            if (!language) {
                const wrapper = node.closest('.code-block-wrapper') || node.parentElement; // generic guess
                if (wrapper) {
                    // Try to find a header div or span that contains the language name
                    // DeepSeek/Doubao often put "python" or "javascript" in a header bar.
                    // This is heuristic.
                    const langLabel = wrapper.querySelector('.code-block-header__lang, .lang-label');
                    if (langLabel) {
                        language = langLabel.textContent.trim().toLowerCase();
                    }
                }
            }

            // Clean content: Remove "Copy" button text if it accidentally got inside
            // (Though usually Turndown processes children, so if "Copy" is outside PRE, we are good.
            // If inside PRE, we need to strip it).
            let cleanContent = node.textContent;

            // If codeTag exists, prefer its text content
            if (codeTag) {
                cleanContent = codeTag.textContent;
            }

            return `\n\`\`\`${language}\n${cleanContent.trim()}\n\`\`\`\n\n`;
        }
    });

    // Rule 3: DeepSeek "Chain of Thought" / "Deep Thinking"
    // Strategy: Convert into an Obsidian Callout
    turndownService.addRule('deep-thinking', {
        filter: function (node) {
            // Detect DeepSeek thinking container
            // Based on report: "thinking" or "process" in class names
            const className = node.className || '';
            return (typeof className === 'string' && (className.includes('ds-thinking') || className.includes('thinking-process'))) ||
                   node.getAttribute('data-testid') === 'thinking-process';
        },
        replacement: function (content, node) {
            // Remove the "Thinking Process" header text if it's redundant
            // Wrap in callout
            return `\n> [!THINK] Deep Thinking\n> ${content.replace(/\n/g, '\n> ')}\n\n`;
        }
    });

    // Rule 4: Doubao Artifacts / Portals (Heuristic)
    // Artifacts might be simple divs with specific roles.
    // We treat them as Quote blocks or Callouts for now.
    turndownService.addRule('doubao-artifact', {
        filter: function (node) {
            return node.getAttribute('data-role') === 'artifact';
        },
        replacement: function (content, node) {
            return `\n> [!INFO] Artifact\n> ${content.replace(/\n/g, '\n> ')}\n\n`;
        }
    });

    return turndownService;
}

// Export for Node.js (tests) or assign to window for Browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = createTurndownService;
} else {
    window.createTurndownService = createTurndownService;
}
