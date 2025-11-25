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

                // Collect messages as we scroll (use Array to preserve order)
                let allMessages = [];

                if (scrollContainer && autoScrollEnabled) {
                    await performAutoScroll(scrollContainer, conversationContainer, allMessages, maxAttempts);
                } else {
                    log('Auto-scroll disabled or container not found - extracting visible messages');
                }

                // Convert array to string
                let conversationText = allMessages.join('\n\n');

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

function extractMessagesFromDOM(container, messageArray) {
    // System messages to filter out
    const SYSTEM_FILTERS = [
        'Messages and calls are secured',
        'end-to-end encryption',
        'Active now',
        'Active Status',
        'You can now message',
        'Learn more',
        'deleted a message',
        'deleted a previous conversation',
        'You sent an attachment',
        'sent an attachment',
        'Forwarded',
        'Seen by'
    ];

    // Get prospect name from conversation header if possible
    let prospectName = 'Prospect';
    const headerName = container.querySelector('h1, [role="heading"]');
    if (headerName) {
        const nameText = headerName.textContent.trim();
        if (nameText && nameText.length > 0 && nameText.length < 50) {
            prospectName = nameText;
        }
    }

    const messageGroups = container.querySelectorAll('[role="row"]');

    messageGroups.forEach(msgGroup => {
        // Skip if this is a system message
        const fullText = msgGroup.textContent || '';
        if (SYSTEM_FILTERS.some(filter => fullText.includes(filter))) {
            return;
        }

        // Skip very short or empty messages
        if (fullText.trim().length < 3) {
            return;
        }

        // Detect sender based on Messenger's DOM structure
        // Right messages (You) have "You sent" in the heading
        // Left messages (Prospect) have the prospect's name in the heading
        let sender = 'Prospect';

        // Strategy 1: Check the h5 heading for "You sent"
        const heading = msgGroup.querySelector('h5 span');
        if (heading) {
            const headingText = heading.textContent.trim();
            if (headingText === 'You sent' || headingText === 'You said') {
                sender = 'You';
            }
        }

        // Strategy 2: Check for specific Messenger classes that indicate message direction
        // Right-aligned messages (yours) have class x15zctf7
        // Left-aligned messages (theirs) have class x1q0g3np
        if (sender === 'Prospect') {
            const messageContainer = msgGroup.querySelector('.x15zctf7');
            if (messageContainer) {
                sender = 'You';
            }
        }

        // Extract the actual message content
        // Look for text divs that aren't metadata
        let messageText = '';

        // Try to find the message content div
        const textDivs = msgGroup.querySelectorAll('div[dir="auto"]');
        for (const div of textDivs) {
            const text = div.textContent || '';
            // Skip if it's just metadata
            if (text.includes('Active now') ||
                text.includes('sent an attachment') ||
                text.length < 2) {
                continue;
            }

            // If this looks like actual message content, use it
            if (text.length > messageText.length && text.length < 5000) {
                messageText = text;
            }
        }

        // Fallback to full text if we couldn't find specific content
        if (!messageText) {
            messageText = fullText;
        }

        // Clean the message text
        messageText = messageText
            .replace(/\bEnter\b/g, '')
            .replace(/Active now/gi, '')
            .replace(/You sent/gi, '')
            .replace(/\s+/g, ' ')  // Normalize whitespace
            .trim();

        // Skip if after cleaning it's too short or matches system patterns
        if (messageText.length < 3 ||
            SYSTEM_FILTERS.some(filter => messageText.includes(filter))) {
            return;
        }

        // Format and add to array
        const formattedMessage = `${sender}: ${messageText}`;

        // Check for duplicates
        if (!messageArray.includes(formattedMessage) &&
            !messageArray.some(m => m.includes(messageText))) {
            messageArray.push(formattedMessage);
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
