const API_URL = 'https://sales-agent-backend-iemq.onrender.com';

// Function to load KBs
async function loadKbs() {
    try {
        const res = await fetch(`${API_URL}/knowledge-bases`);
        if (res.ok) {
            const data = await res.json();
            const selector = document.getElementById('kbSelector');
            const currentSelection = selector.value;

            // Reset selector
            selector.innerHTML = '<option value="Sample">Sample</option>';

            data.kbs.forEach(kb => {
                if (kb !== 'Sample' && kb !== 'default') {
                    const option = document.createElement('option');
                    option.value = kb;
                    option.textContent = kb;
                    selector.appendChild(option);
                }
            });

            // Restore selection if it still exists, otherwise default to Sample
            if (Array.from(selector.options).some(opt => opt.value === currentSelection)) {
                selector.value = currentSelection;
            } else {
                selector.value = "Sample";
            }
        }
    } catch (e) {
        console.error("Failed to load KBs:", e);
    }
}

// Helper: Show Toast Notification
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 300);
    }, 3000);

    toast.classList.remove('hidden');
}

// Helper: Show Custom Modal
function showModal(title, message, onConfirm) {
    const modal = document.getElementById('customModal');
    const titleEl = document.getElementById('modalTitle');
    const msgEl = document.getElementById('modalMessage');
    const confirmBtn = document.getElementById('modalConfirm');
    const cancelBtn = document.getElementById('modalCancel');

    titleEl.textContent = title;
    msgEl.textContent = message;

    modal.classList.remove('hidden');

    const cleanup = () => {
        modal.classList.add('hidden');
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
    };

    const handleConfirm = () => {
        cleanup();
        onConfirm();
    };

    const handleCancel = () => {
        cleanup();
    };

    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
}

// Helper: Log Error to Backend
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

        // Use sendBeacon for reliability during unload, or fetch otherwise
        // Since we are in a popup/extension, fetch is usually fine.
        await fetch(`${API_URL}/log_error`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (e) {
        console.error("Failed to log error to backend:", e);
    }
}

// Load available KBs on startup
document.addEventListener('DOMContentLoaded', loadKbs);

document.getElementById('analyzeBtn').addEventListener('click', async () => {
    const btn = document.getElementById('analyzeBtn');
    const results = document.getElementById('results');
    const content = document.getElementById('insightsContent');

    btn.disabled = true;
    btn.querySelector('.btn-text').textContent = 'Analyzing...';
    results.classList.remove('hidden');

    content.innerHTML = `
        <div class="loading-state">
            <div>📜 Loading entire conversation history...</div>
            <div class="loading-subtext">Auto-scrolling to load all messages</div>
        </div>
    `;

    try {
        // Query the active tab in the last focused window
        const windows = await chrome.windows.getAll({ populate: true, windowTypes: ['normal'] });
        const lastFocusedWindow = windows.find(w => w.focused) || windows[0];
        const activeTab = lastFocusedWindow?.tabs?.find(t => t.active);

        if (!activeTab) {
            throw new Error('No active tab found');
        }

        // Get auto-scroll settings from UI
        const autoScrollEnabled = document.getElementById('autoScrollEnabled').checked;
        const maxScrollAttempts = parseInt(document.getElementById('maxScrollAttempts').value) || 50;

        // Send message to content script with settings
        try {
            const response = await chrome.tabs.sendMessage(activeTab.id, {
                action: "get_text",
                autoScroll: autoScrollEnabled,
                maxAttempts: maxScrollAttempts
            });

            if (!response || !response.text) {
                throw new Error("Could not extract text from page.");
            }

            // Continue with analysis...
            var extractedText = response.text; // Store for later use
        } catch (err) {
            await logErrorToBackend(err, { context: "content_script_communication", tabId: activeTab.id });
            if (err.message.includes("Receiving end does not exist")) {
                throw new Error("Please refresh the Messenger page and try again.");
            }
            throw err;
        }

        content.innerHTML = `
            <div class="loading-state">
                <div>🤖 Processing with AI...</div>
            </div>
        `;

        // Call Backend
        // Call Backend
        let apiRes;
        try {
            apiRes = await fetch(`${API_URL}/analyze`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: extractedText,
                    kb_name: document.getElementById('kbSelector').value
                }),
            });
        } catch (err) {
            if (err.message.includes("Failed to fetch")) {
                throw new Error("Could not connect to server. Please check your internet connection.");
            }
            throw err;
        }

        if (!apiRes.ok) {
            const errorData = await apiRes.json().catch(() => ({}));
            throw new Error(errorData.detail || `API Error: ${apiRes.status} ${apiRes.statusText}`);
        }

        const data = await apiRes.json();
        console.log('[SalesAgent] Received API response:', data);

        // Defensive check
        if (!content) {
            console.error('[SalesAgent] Content element not found!');
            throw new Error('UI rendering failed: content element missing');
        }

        // Validate data structure
        if (!data || typeof data !== 'object') {
            console.error('[SalesAgent] Invalid data structure:', data);
            throw new Error('Invalid response from API');
        }

        // Render Results with improved formatting
        let html = '';

        // Show extracted conversation (collapsible)
        html += `
            <div class="section">
                <details style="margin-bottom: 16px;">
                    <summary class="extracted-text-summary">📄 View Extracted Conversation (${extractedText.length} characters)</summary>
                    <div class="extracted-text-container">
                        ${extractedText.substring(0, 2000)}
                        ${extractedText.length > 2000 ? '\n\n... (truncated for display, full text sent to AI)' : ''}
                    </div>
                </details>
            </div>
        `;

        // Show KB Sources if available
        if (data.kb_sources && data.kb_sources.length > 0) {
            html += `
                <div class="section">
                    <h3>📚 Knowledge Base Used</h3>
                    <div class="kb-sources">
                        ${data.kb_sources.map(source => `<span class="kb-badge">${source.split('/').pop()}</span>`).join('')}
                    </div>
                </div>
            `;
        }

        // Insights Section
        if (data.insights && data.insights.length > 0) {
            html += '<div class="section">';
            html += '<h3>📊 Key Insights</h3>';
            data.insights.forEach(insight => {
                html += `<div class="insight-item">${insight}</div>`;
            });
            html += '</div>';
        }

        // Strategies Section
        if (data.strategies && data.strategies.length > 0) {
            html += '<div class="section">';
            html += '<h3>🎯 Recommended Strategies</h3>';
            data.strategies.forEach(strategy => {
                html += `<div class="strategy-item">${strategy}</div>`;
            });
            html += '</div>';
        }

        // Suggested Messages Section
        if (data.suggested_messages && data.suggested_messages.length > 0) {
            html += '<div class="section suggested-messages">';
            html += '<h3>💬 Suggested Messages</h3>';
            html += '<p class="messages-help-text">Click to copy and insert into Messenger</p>';
            data.suggested_messages.forEach((msg, index) => {
                html += `
                    <div class="message-template" data-message="${msg.replace(/"/g, '&quot;')}">
                        <div class="message-template-text">${msg}</div>
                        <div class="message-template-label">Click to copy</div>
                        <div class="copy-indicator" id="copy-${index}">Copied! ✓</div>
                    </div>
                `;
            });
            html += '</div>';
        }

        console.log('[SalesAgent] Rendering HTML, length:', html.length);
        content.innerHTML = html;
        console.log('[SalesAgent] HTML rendered successfully');

        // Add click handlers for message templates
        document.querySelectorAll('.message-template').forEach((template, index) => {
            template.addEventListener('click', async () => {
                const message = template.getAttribute('data-message');

                // Copy to clipboard
                await navigator.clipboard.writeText(message);

                // Show copied indicator
                const indicator = document.getElementById(`copy-${index}`);
                indicator.classList.add('show');
                setTimeout(() => indicator.classList.remove('show'), 2000);

                // Try to insert into Messenger (if on messenger.com)
                try {
                    const windows = await chrome.windows.getAll({
                        populate: true,
                        windowTypes: ['normal']
                    });

                    const browserWindow = windows.find(w => w.focused) || windows[0];
                    const tab = browserWindow?.tabs?.find(t => t.active);

                    if (tab && tab.url && tab.url.includes('messenger.com')) {
                        // Send message to content script to insert text
                        await chrome.tabs.sendMessage(tab.id, {
                            action: "insert_text",
                            text: message
                        });
                    }
                } catch (error) {
                    console.log('Could not auto-insert into Messenger:', error);
                }
            });
        });


    } catch (error) {
        console.error('[SalesAgent] Error during analysis:', error);
        content.innerHTML = `<div class="error-state">Error: ${error.message}</div>`;
    } finally {
        btn.disabled = false;
        btn.querySelector('.btn-text').textContent = 'Analyze Now';
    }
});


// Upload Knowledge Base Button
document.getElementById('uploadKbBtn').addEventListener('click', () => {
    // Create a file input element
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.txt,.pdf,.doc,.docx';

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const btn = document.getElementById('uploadKbBtn');
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Uploading...';

        try {
            const formData = new FormData();
            formData.append('file', file);

            const kbName = document.getElementById('newKbName').value.trim();

            if (!kbName) {
                showToast("❌ Please enter a name for the Knowledge Base.", "error");
                btn.disabled = false;
                btn.textContent = originalText;
                return;
            }

            formData.append('kb_name', kbName);

            const response = await fetch(`${API_URL}/upload-kb`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || 'Upload failed');
            }

            const data = await response.json();
            showToast(`✅ Added ${data.chunks_added} chunks to "${data.kb_name}".`);

            // Auto-refresh KB list
            await loadKbs();
            // Select the new KB
            document.getElementById('kbSelector').value = data.kb_name;

        } catch (error) {
            showToast(`❌ Error uploading file: ${error.message}`, "error");
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
            // Clear file input
            fileInput.value = '';
        }
    });

    // Trigger file selection
    fileInput.click();
});

// Reset Knowledge Base Button
document.getElementById('resetKbBtn').addEventListener('click', () => {
    showModal(
        "Reset Knowledge Base",
        "Are you sure? This will DELETE ALL Knowledge Bases and restore the Sample KB.",
        async () => {
            const btn = document.getElementById('resetKbBtn');
            const originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Resetting...';

            try {
                const response = await fetch(`${API_URL}/reset-kb`, {
                    method: 'POST'
                });

                if (!response.ok) {
                    throw new Error('Reset failed');
                }

                showToast("✅ Knowledge Base reset to Sample.");
                await loadKbs();
                document.getElementById('kbSelector').value = "Sample";

            } catch (error) {
                showToast(`❌ Error: ${error.message}`, "error");
            } finally {
                btn.disabled = false;
                btn.textContent = originalText;
            }
        }
    );
});

