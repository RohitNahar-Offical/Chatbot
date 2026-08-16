/**
 * STRA AI — TACTICAL INTERFACE ENGINE (PHASE 1A MVP)
 */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Element References
    const chatThread = document.getElementById('chat-thread');
    const welcomeCard = document.getElementById('welcome-card');
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const btnSend = document.getElementById('btn-send');
    const btnStop = document.getElementById('btn-stop');
    const btnNewSession = document.getElementById('btn-new-session');
    const selectModel = document.getElementById('select-model');
    const toggleRag = document.getElementById('toggle-rag');
    const toggleWebSearch = document.getElementById('toggle-web-search');
    const typingIndicator = document.getElementById('typing-indicator');
    const hudClock = document.getElementById('hud-clock');
    const citationsBar = document.getElementById('citations-bar');
    const citationsList = document.getElementById('citations-list');
    const btnCloseCitations = document.getElementById('btn-close-citations');
    const webCitationsBar = document.getElementById('web-citations-bar');
    const webCitationsList = document.getElementById('web-citations-list');
    const btnCloseWebCitations = document.getElementById('btn-close-web-citations');

    // State Variables
    let conversationHistory = [];
    let activeAbortController = null;
    let isStreaming = false;

    // Configure Marked.js Options
    if (typeof marked !== 'undefined') {
        marked.setOptions({
            gfm: true,
            breaks: true
        });
    }

    // 1. Live HUD UTC Clock
    function updateClock() {
        const now = new Date();
        const utcStr = now.toISOString().substring(11, 19) + ' UTC';
        if (hudClock) hudClock.textContent = utcStr;
    }
    setInterval(updateClock, 1000);
    updateClock();

    // 2. Fetch System Status & Knowledge Base Sources
    async function initSystemState() {
        try {
            // Fetch System Operational Status
            const statusRes = await fetch('/api/status');
            if (statusRes.ok) {
                const statusData = await statusRes.json();
                const statusPill = document.getElementById('system-status-pill');
                const statusText = document.getElementById('status-text');
                if (statusPill && statusText) {
                    const dot = statusPill.querySelector('.indicator-dot');
                    if (statusData.status.startsWith('ONLINE')) {
                        statusText.textContent = 'SYSTEM ONLINE // SECURE';
                        if (dot) dot.className = 'indicator-dot online';
                    } else {
                        statusText.textContent = `SYSTEM ${statusData.status.toUpperCase()}`;
                        if (dot) dot.className = 'indicator-dot degraded';
                    }
                }
            }
        } catch (e) {
            console.warn('[Stra AI] System status fetch error:', e);
            const statusText = document.getElementById('status-text');
            if (statusText) statusText.textContent = 'SYSTEM OFFLINE // UNREACHABLE';
            const statusPill = document.getElementById('system-status-pill');
            if (statusPill) {
                const dot = statusPill.querySelector('.indicator-dot');
                if (dot) dot.className = 'indicator-dot offline';
            }
        }

        try {
            const res = await fetch('/api/knowledge');
            if (res.ok) {
                const data = await res.json();
                const countElem = document.getElementById('kb-count');
                if (countElem) countElem.textContent = data.sources.length;

                const container = document.getElementById('kb-source-container');
                if (container && data.sources.length > 0) {
                    container.innerHTML = data.sources.map(s => `
                        <div class="source-item">
                            <span class="source-tag">${escapeHtml(s.category.substring(0, 6).toUpperCase())}</span>
                            <span class="source-name" title="${escapeHtml(s.doc_title)}">${escapeHtml(s.doc_title)}</span>
                        </div>
                    `).join('');
                }
            }
        } catch (e) {
            console.warn('[Stra AI] Knowledge status fetch error:', e);
        }
    }
    initSystemState();

    // 3. Prompt Chips Event Delegation
    document.querySelectorAll('.chip-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const promptText = btn.getAttribute('data-prompt');
            if (promptText && !isStreaming) {
                userInput.value = promptText;
                userInput.focus();
                handleFormSubmit();
            }
        });
    });

    // 4. Form Submit & Message Handling
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleFormSubmit();
    });

    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleFormSubmit();
        }
    });

    btnNewSession.addEventListener('click', () => {
        clearSession();
    });

    btnCloseCitations.addEventListener('click', () => {
        citationsBar.classList.add('hidden');
    });

    btnCloseWebCitations.addEventListener('click', () => {
        webCitationsBar.classList.add('hidden');
    });

    btnStop.addEventListener('click', () => {
        if (activeAbortController) {
            activeAbortController.abort();
            finishStreamingState();
        }
    });

    function clearSession() {
        if (isStreaming && activeAbortController) {
            activeAbortController.abort();
        }
        conversationHistory = [];
        chatThread.innerHTML = '';
        if (welcomeCard) chatThread.appendChild(welcomeCard);
        citationsBar.classList.add('hidden');
        webCitationsBar.classList.add('hidden');
        userInput.value = '';
        finishStreamingState();
    }

    async function handleFormSubmit() {
        const text = userInput.value.trim();
        if (!text || isStreaming) return;

        // Hide welcome card on first query
        if (welcomeCard && welcomeCard.parentNode) {
            welcomeCard.remove();
        }

        // Add user message to history & DOM
        conversationHistory.push({ role: 'user', content: text });
        appendUserMessageDOM(text);
        userInput.value = '';

        // Prepare Streaming State
        startStreamingState();

        // Create Assistant Bubble Container
        const { wrapper, bubbleElem, headerElem } = createAssistantBubbleDOM();

        // Target API Payload
        const payload = {
            messages: conversationHistory,
            enable_rag: toggleRag.checked,
            enable_web_search: toggleWebSearch ? toggleWebSearch.checked : true,
            model: selectModel.value
        };

        activeAbortController = new AbortController();
        let fullAssistantText = '';

        try {
            const response = await fetch('/api/chat/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: activeAbortController.signal
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({ detail: response.statusText }));
                throw new Error(errData.detail || `Server error ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n\n');
                buffer = lines.pop() || '';

                for (const eventBlock of lines) {
                    if (!eventBlock.trim()) continue;

                    let eventName = 'message';
                    let eventData = '';

                    eventBlock.split('\n').forEach(line => {
                        if (line.startsWith('event:')) {
                            eventName = line.substring(6).trim();
                        } else if (line.startsWith('data:')) {
                            eventData = line.substring(5).trim();
                        }
                    });

                    if (eventName === 'delta') {
                        const parsed = JSON.parse(eventData);
                        fullAssistantText += parsed.content;
                        renderMarkdown(bubbleElem, fullAssistantText);
                        scrollToBottom();
                    } else if (eventName === 'citations') {
                        const citations = JSON.parse(eventData);
                        renderCitationsDrawer(citations);
                        appendCitationBadge(wrapper, citations);
                    } else if (eventName === 'web_citations') {
                        const webCitations = JSON.parse(eventData);
                        renderWebCitationsDrawer(webCitations);
                        appendWebCitationBadge(wrapper, webCitations);
                    } else if (eventName === 'error') {
                        const parsed = JSON.parse(eventData);
                        fullAssistantText += `\n\n**[ERROR]**: ${parsed.error}`;
                        renderMarkdown(bubbleElem, fullAssistantText);
                    }
                }
            }

            // Append assistant response to history
            conversationHistory.push({ role: 'assistant', content: fullAssistantText });

        } catch (err) {
            if (err.name !== 'AbortError') {
                const isNetworkError = err.message.toLowerCase().includes('failed to fetch') || 
                                       err.message.toLowerCase().includes('networkerror') ||
                                       err.message.toLowerCase().includes('network error');
                
                if (isNetworkError) {
                    fullAssistantText += `\n\n⚠️ **Operational Exception: Network Disconnect**\n\nUnable to establish communication with the Stra AI backend server (\`/api/chat/stream\`).\n\n**Troubleshooting**:\n- Verify that the FastAPI server is active (\`python run.py\` or \`uvicorn app.server:app\`).\n- Ensure local server is listening on port 8000 and firewall is not blocking localhost.`;
                } else {
                    fullAssistantText += `\n\n⚠️ **Operational Exception**: ${err.message}`;
                }
                renderMarkdown(bubbleElem, fullAssistantText);
            }
        } finally {
            finishStreamingState();
        }
    }

    // DOM Helpers
    function appendUserMessageDOM(text) {
        const wrapper = document.createElement('div');
        wrapper.className = 'msg-wrapper user';
        wrapper.innerHTML = `
            <div class="msg-header">ANALYST // USER</div>
            <div class="msg-bubble">${escapeHtml(text)}</div>
        `;
        chatThread.appendChild(wrapper);
        scrollToBottom();
    }

    function createAssistantBubbleDOM() {
        const wrapper = document.createElement('div');
        wrapper.className = 'msg-wrapper assistant';

        const headerElem = document.createElement('div');
        headerElem.className = 'msg-header';
        headerElem.textContent = 'STRA AI // STRATEGIC CORE';

        const bubbleElem = document.createElement('div');
        bubbleElem.className = 'msg-bubble';
        bubbleElem.innerHTML = '<span class="pulse-dot"></span> Initialization...';

        wrapper.appendChild(headerElem);
        wrapper.appendChild(bubbleElem);
        chatThread.appendChild(wrapper);
        scrollToBottom();

        return { wrapper, bubbleElem, headerElem };
    }

    function renderMarkdown(element, rawText) {
        if (typeof marked !== 'undefined') {
            element.innerHTML = marked.parse(rawText);
        } else {
            element.textContent = rawText;
        }
    }

    function renderCitationsDrawer(citations) {
        if (!citations || citations.length === 0) return;
        citationsList.innerHTML = citations.map(c => `
            <div class="citation-card">
                <div class="cit-cat">[${escapeHtml(c.category.toUpperCase())}] Score: ${c.score}</div>
                <div class="cit-title">${escapeHtml(c.title)}</div>
                <div class="cit-sec">${escapeHtml(c.section)}</div>
            </div>
        `).join('');
        citationsBar.classList.remove('hidden');
    }

    function appendCitationBadge(wrapperElem, citations) {
        const badge = document.createElement('div');
        badge.className = 'citation-badge';
        badge.innerHTML = `🏷️ ${citations.length} Intelligence Source Citation(s)`;
        badge.addEventListener('click', () => {
            citationsBar.classList.toggle('hidden');
        });
        wrapperElem.appendChild(badge);
    }

    function renderWebCitationsDrawer(webCitations) {
        if (!webCitations || webCitations.length === 0) return;
        webCitationsList.innerHTML = webCitations.map(c => `
            <div class="citation-card web-citation-card">
                <div class="cit-cat">[WEB] ${escapeHtml(c.source)}</div>
                <div class="cit-title">
                    <a href="${escapeHtml(c.url)}" target="_blank" rel="noopener noreferrer" class="web-citation-link">
                        ${escapeHtml(c.title)}
                    </a>
                </div>
                <div class="cit-sec">${escapeHtml(c.snippet)}</div>
            </div>
        `).join('');
        webCitationsBar.classList.remove('hidden');
    }

    function appendWebCitationBadge(wrapperElem, webCitations) {
        const badge = document.createElement('div');
        badge.className = 'citation-badge web-badge';
        badge.innerHTML = `🌐 ${webCitations.length} Live Web Source(s)`;
        badge.addEventListener('click', () => {
            webCitationsBar.classList.toggle('hidden');
        });
        wrapperElem.appendChild(badge);
    }

    function startStreamingState() {
        isStreaming = true;
        btnSend.classList.add('hidden');
        btnStop.classList.remove('hidden');
        typingIndicator.classList.remove('hidden');
    }

    function finishStreamingState() {
        isStreaming = false;
        btnSend.classList.remove('hidden');
        btnStop.classList.add('hidden');
        typingIndicator.classList.add('hidden');
        activeAbortController = null;
    }

    function scrollToBottom() {
        chatThread.scrollTop = chatThread.scrollHeight;
    }

    function escapeHtml(str) {
        return str.replace(/[&<>"']/g, function(m) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            }[m];
        });
    }
});
