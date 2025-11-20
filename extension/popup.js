const API_URL = 'http://localhost:8000';

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
        const response = await chrome.tabs.sendMessage(activeTab.id, {
            action: "get_text",
            autoScroll: autoScrollEnabled,
            maxAttempts: maxScrollAttempts
        });

        if (!response || !response.text) {
            throw new Error("Could not extract text from page.");
        }

        content.innerHTML = `
            <div class="loading-state">
                <div>🤖 Processing with AI...</div>
            </div>
        `;

        // Call Backend
        const apiRes = await fetch(`${API_URL}/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text: response.text }),
        });

        if (!apiRes.ok) {
            throw new Error(`API Error: ${apiRes.statusText}`);
        }

        const data = await apiRes.json();

        // Render Results with improved formatting
        let html = '';

        // Show extracted conversation (collapsible)
        html += `
            <div class="section">
                <details style="margin-bottom: 16px;">
                    <summary class="extracted-text-summary">📄 View Extracted Conversation (${response.text.length} characters)</summary>
                    <div class="extracted-text-container">
                        ${response.text.substring(0, 2000)}
                        ${response.text.length > 2000 ? '\n\n... (truncated for display, full text sent to AI)' : ''}
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

        content.innerHTML = html;

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

            const response = await fetch(`${API_URL}/upload-kb`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Upload failed');
            }

            const data = await response.json();
            alert(`✅ Knowledge base updated! Added ${data.chunks_added} chunks.`);

        } catch (error) {
            alert(`❌ Error uploading file: ${error.message}`);
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    });

    // Trigger file selection
    fileInput.click();
});

