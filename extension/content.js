const DEBUG = false;

const API_URL = 'https://sales-agent-backend-iemq.onrender.com';

async function logErrorToBackend(error, context = {}) {
    try {
        const payload = {
            message: error.message || String(error),
            stack: error.stack,
            context: JSON.stringify(context),
            url: window.location.href,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString()
        };

        await fetch(`${API_URL}/log_error`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (e) {
        console.error("Failed to log error to backend:", e);
    }
}

function log(...args) {
    if (DEBUG) console.log('[SalesAgent]', ...args);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "get_text") {
        // Get settings from request (with defaults)
        const autoScrollEnabled = request.autoScroll !== false; // Default true
        const maxAttempts = request.maxAttempts || 50; // Default 50

        // Messenger-specific extraction with optional auto-scroll
        async function loadAllMessagesAndExtract() {
            try {
                // Find the conversation container
                const conversationContainer = document.querySelector('[role="main"]') ||
                    document.querySelector('[data-scope="messages_table"]') ||
                    document.querySelector('div[class*="message"]');

                if (!conversationContainer) {
                    log('Could not find conversation container');
                    return { text: document.body.innerText };
                }

                log('Found conversation container:', conversationContainer);

                // Find the scrollable container
                let scrollContainer = findScrollContainer(conversationContainer);
                log('Found scroll container:', scrollContainer);

                // Collect messages as we scroll
                let allMessages = new Set();

                if (scrollContainer && autoScrollEnabled) {
                    await performAutoScroll(scrollContainer, conversationContainer, allMessages, maxAttempts);
                } else {
                    log('Auto-scroll disabled or container not found - extracting visible messages');
                }

                // Convert Set to string
                let conversationText = Array.from(allMessages).join('\n\n');

                // Fallback if no messages collected
                if (!conversationText.trim()) {
                    log('No messages collected during scroll, using fallback...');
                    conversationText = extractVisibleMessages(conversationContainer);
                }

                // Final cleanup
                conversationText = conversationText
                    .replace(/\n{3,}/g, '\n\n')
                    .trim();

                log('Extracted conversation length:', conversationText.length);

                return { text: conversationText };

            } catch (error) {
                console.error('Error extracting conversation:', error);
                await logErrorToBackend(error, { context: "content_script_extraction" });
                return { text: document.body.innerText };
            }
        }

        // Execute async function and send response
        loadAllMessagesAndExtract().then(result => {
            sendResponse(result);
        });

        return true; // Keep message channel open for async response

    } else if (request.action === "insert_text") {
        handleInsertText(request.text, sendResponse);
        return true;
    }
});

function findScrollContainer(startElement) {
    // Strategy 1: Search all divs for the one with largest scrollHeight
    let maxScrollHeight = 0;
    let bestContainer = null;

    const allDivs = Array.from(document.querySelectorAll('div'));
    allDivs.forEach(el => {
        const style = window.getComputedStyle(el);
        if (el.scrollHeight > el.clientHeight &&
            (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
            el.scrollHeight > maxScrollHeight) {
            bestContainer = el;
            maxScrollHeight = el.scrollHeight;
        }
    });

    if (bestContainer) return bestContainer;

    // Strategy 2: Walk up from conversation container
    let current = startElement;
    for (let i = 0; i < 15; i++) {
        if (!current) break;
        const style = window.getComputedStyle(current);
        if (current.scrollHeight > current.clientHeight &&
            (style.overflowY === 'scroll' || style.overflowY === 'auto')) {
            return current;
        }
        current = current.parentElement;
    }
    return null;
}

async function performAutoScroll(scrollContainer, conversationContainer, allMessages, maxAttempts) {
    let previousHeight = 0;
    let currentHeight = scrollContainer.scrollHeight;
    let attempts = 0;
    let stableCount = 0;

    log('Starting auto-scroll...');

    while (attempts < maxAttempts) {
        scrollContainer.scrollTop = 0;

        // Wait for new messages to load
        await new Promise(resolve => setTimeout(resolve, 800));

        extractMessagesFromDOM(conversationContainer, allMessages);

        previousHeight = currentHeight;
        currentHeight = scrollContainer.scrollHeight;

        log(`Attempt ${attempts + 1}: Messages collected: ${allMessages.size}`);

        if (currentHeight === previousHeight) {
            stableCount++;
            if (stableCount >= 3) {
                log('Height stable, stopping');
                break;
            }
        } else {
            stableCount = 0;
        }
        attempts++;
    }
}

function extractMessagesFromDOM(container, messageSet) {
    const messageGroups = container.querySelectorAll('[role="row"]');
    messageGroups.forEach(msgGroup => {
        const fullText = msgGroup.textContent.trim();

        // Skip date separators and metadata
        if (fullText.length < 30 && fullText.match(/\d{4}/)) return;
        if (fullText === 'Enter' || fullText.length < 3) return;

        // Clean and add to set
        let cleanText = fullText
            .replace(/\bEnter\b/g, '')
            .replace(/^\d{2}\/\d{2}\/\d{4},\s*\d{2}:\d{2}:\s*/, '')
            .replace(/You replied to \w+\s*/g, '')
            .trim();

        if (cleanText.length > 5) {
            messageSet.add(cleanText);
        }
    });
}

function extractVisibleMessages(container) {
    const messageGroups = container.querySelectorAll('[role="row"]');
    let messages = [];
    messageGroups.forEach(msgGroup => {
        const fullText = msgGroup.textContent.trim();
        if (fullText.length > 5) {
            messages.push(fullText);
        }
    });
    return messages.join('\n\n');
}

function handleInsertText(text, sendResponse) {
    try {
        const inputBox = document.querySelector('[contenteditable="true"][role="textbox"]') ||
            document.querySelector('div[contenteditable="true"]') ||
            document.querySelector('textarea[class*="message"]') ||
            document.querySelector('textarea');

        if (inputBox) {
            if (inputBox.getAttribute('contenteditable') === 'true') {
                inputBox.focus();
                inputBox.textContent = text;
                inputBox.dispatchEvent(new Event('input', { bubbles: true }));
            } else {
                inputBox.value = text;
                inputBox.focus();
                inputBox.dispatchEvent(new Event('input', { bubbles: true }));
            }
            sendResponse({ success: true });
        } else {
            sendResponse({ success: false, error: 'Input box not found' });
        }
    } catch (error) {
        sendResponse({ success: false, error: error.message });
    }
}
