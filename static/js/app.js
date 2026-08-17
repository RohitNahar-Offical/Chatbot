/**
 * STRA AI — TACTICAL INTERFACE ENGINE (v3.0 Modern Platform)
 * Enhanced state management, accessibility, real-time SSE streaming, and responsive UI
 */

(function () {
    'use strict';

    // ========================================
    // CONFIGURATION & CONSTANTS
    // ========================================

    const CONFIG = {
        API: {
            STATUS: '/api/status',
            KNOWLEDGE: '/api/knowledge',
            CHAT_STREAM: '/api/chat/stream'
        },
        UI: {
            SCROLL_BOTTOM_OFFSET: 20,
            TEXTAREA_MAX_HEIGHT: 180,
            TEXTAREA_MIN_HEIGHT: 48
        }
    };

    // ========================================
    // STATE MANAGEMENT
    // ========================================

    const state = {
        conversationHistory: [],
        isStreaming: false,
        activeAbortController: null,
        systemStatus: 'online', // 'online' | 'degraded' | 'offline'
        knowledgeSources: [],
        hasUserInteracted: false
    };

    // ========================================
    // DOM REFERENCES
    // ========================================

    const DOM = {
        chatThread: document.getElementById('chat-thread'),
        welcomeCard: document.getElementById('welcome-card'),
        chatForm: document.getElementById('chat-form'),
        userInput: document.getElementById('user-input'),
        btnSend: document.getElementById('btn-send'),
        btnStop: document.getElementById('btn-stop'),
        btnNewSession: document.getElementById('btn-new-session'),
        btnToggleSidebar: document.getElementById('btn-toggle-sidebar'),
        sidebarPanel: document.getElementById('sidebar-panel'),
        selectModel: document.getElementById('select-model'),
        toggleRag: document.getElementById('toggle-rag'),
        toggleWebSearch: document.getElementById('toggle-web-search'),
        typingIndicator: document.getElementById('typing-indicator'),
        hudClock: document.getElementById('hud-clock'),
        headerKbCount: document.getElementById('header-kb-count'),
        kbCount: document.getElementById('kb-count'),
        systemStatusPill: document.getElementById('system-status-pill'),
        statusText: document.getElementById('status-text'),
        citationsBar: document.getElementById('citations-bar'),
        citationsList: document.getElementById('citations-list'),
        btnCloseCitations: document.getElementById('btn-close-citations'),
        webCitationsBar: document.getElementById('web-citations-bar'),
        webCitationsList: document.getElementById('web-citations-list'),
        btnCloseWebCitations: document.getElementById('btn-close-web-citations')
    };

    // ========================================
    // UTILITY FUNCTIONS
    // ========================================

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>"']/g, function (m) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            }[m];
        });
    }

    function scrollToBottom(smooth = true) {
        if (!DOM.chatThread) return;
        const behavior = smooth ? 'smooth' : 'auto';
        DOM.chatThread.scrollTo({
            top: DOM.chatThread.scrollHeight,
            behavior
        });
    }

    function announceToScreenReader(message) {
        const announcement = document.createElement('div');
        announcement.setAttribute('role', 'status');
        announcement.setAttribute('aria-live', 'polite');
        announcement.setAttribute('aria-atomic', 'true');
        announcement.className = 'sr-only';
        announcement.style.position = 'absolute';
        announcement.style.left = '-9999px';
        announcement.textContent = message;
        document.body.appendChild(announcement);

        setTimeout(() => {
            if (announcement.parentNode) {
                document.body.removeChild(announcement);
            }
        }, 1000);
    }

    // ========================================
    // MARKDOWN CONFIGURATION
    // ========================================

    function configureMarked() {
        if (typeof marked === 'undefined') return;

        marked.setOptions({
            gfm: true,
            breaks: true,
            headerIds: false,
            mangle: false
        });

        const renderer = new marked.Renderer();
        renderer.code = function (code, language) {
            const lang = language || '';
            return `<pre><code class="language-${escapeHtml(lang)}">${escapeHtml(code)}</code></pre>`;
        };

        marked.setOptions({ renderer });
    }

    // ========================================
    // CLOCK & TELEMETRY
    // ========================================

    function updateClock() {
        if (!DOM.hudClock) return;
        const now = new Date();
        const utcStr = now.toISOString().substring(11, 19) + ' UTC';
        DOM.hudClock.textContent = utcStr;
    }

    function initClock() {
        updateClock();
        setInterval(updateClock, 1000);
    }

    function updateKnowledgeBaseCount(count, chunks) {
        if (DOM.kbCount) {
            DOM.kbCount.textContent = count;
            DOM.kbCount.setAttribute('aria-label', `${count} knowledge sources`);
        }
        if (DOM.headerKbCount) {
            DOM.headerKbCount.textContent = `${count} DOCS (${chunks} CHUNKS)`;
        }
    }

    // ========================================
    // SYSTEM STATUS
    // ========================================

    function updateSystemStatus(status) {
        state.systemStatus = status.toLowerCase();

        if (!DOM.systemStatusPill || !DOM.statusText) return;

        const dot = DOM.systemStatusPill.querySelector('.indicator-dot');
        const statusMap = {
            'online': { text: 'SYSTEM ONLINE // SECURE', class: 'online' },
            'degraded': { text: 'SYSTEM DEGRADED // LIMITED', class: 'degraded' },
            'offline': { text: 'SYSTEM OFFLINE // UNREACHABLE', class: 'offline' }
        };

        const config = statusMap[state.systemStatus] || statusMap['offline'];
        DOM.statusText.textContent = config.text;
        DOM.systemStatusPill.className = `status-indicator-pill ${state.systemStatus}`;

        if (dot) {
            dot.className = `indicator-dot ${config.class}`;
        }

        announceToScreenReader(`System status: ${config.text}`);
    }

    // ========================================
    // API INITIALIZATION
    // ========================================

    async function initSystemState() {
        await fetchSystemStatus();
        await fetchKnowledgeBase();
    }

    async function fetchSystemStatus() {
        try {
            const response = await fetch(CONFIG.API.STATUS);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            const status = (data.status || 'unknown').toLowerCase();
            updateSystemStatus(status.includes('online') ? 'online' : (status.includes('degraded') ? 'degraded' : 'offline'));
        } catch (error) {
            console.warn('[STRA AI] System status fetch error:', error);
            updateSystemStatus('offline');
        }
    }

    async function fetchKnowledgeBase() {
        try {
            const response = await fetch(CONFIG.API.KNOWLEDGE);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            state.knowledgeSources = data.sources || [];

            updateKnowledgeBaseCount(
                state.knowledgeSources.length,
                data.total_chunks || 0
            );

            renderKnowledgeSources(state.knowledgeSources);
        } catch (error) {
            console.warn('[STRA AI] Knowledge base fetch error:', error);
        }
    }

    function renderKnowledgeSources(sources) {
        const container = document.getElementById('kb-source-container');
        if (!container || !sources.length) return;

        container.innerHTML = sources.map(source => {
            const category = (source.category || 'DEFENSE').toUpperCase();
            const tagClass = getCategoryTagClass(source.category);

            return `
                <div class="source-item" role="listitem">
                    <span class="source-tag ${tagClass}">${escapeHtml(category.substring(0, 6))}</span>
                    <span class="source-name" title="${escapeHtml(source.doc_title)}">${escapeHtml(source.doc_title)}</span>
                </div>
            `;
        }).join('');
    }

    function getCategoryTagClass(category) {
        const cat = (category || '').toLowerCase();
        if (cat.includes('cyber')) return 'cyber';
        if (cat.includes('cisa')) return 'cisa';
        if (cat.includes('osint')) return 'osint';
        return 'defense';
    }

    // ========================================
    // TEXTAREA AUTO-RESIZE
    // ========================================

    function initTextareaAutoResize() {
        if (!DOM.userInput) return;

        const handleResize = () => {
            DOM.userInput.style.height = 'auto';
            const newHeight = Math.max(
                CONFIG.UI.TEXTAREA_MIN_HEIGHT,
                Math.min(DOM.userInput.scrollHeight, CONFIG.UI.TEXTAREA_MAX_HEIGHT)
            );
            DOM.userInput.style.height = newHeight + 'px';
        };

        DOM.userInput.addEventListener('input', handleResize);
        DOM.userInput.addEventListener('focus', handleResize);
    }

    // ========================================
    // MESSAGE RENDERING
    // ========================================

    function appendUserMessageDOM(text) {
        const wrapper = document.createElement('div');
        wrapper.className = 'msg-wrapper user';
        wrapper.innerHTML = `
            <div class="msg-header">ANALYST // USER</div>
            <div class="msg-bubble">${escapeHtml(text)}</div>
        `;

        if (DOM.chatThread) {
            DOM.chatThread.appendChild(wrapper);
        }

        scrollToBottom();
        announceToScreenReader('Message sent');
    }

    function createAssistantBubbleDOM() {
        const wrapper = document.createElement('div');
        wrapper.className = 'msg-wrapper assistant';

        const headerElem = document.createElement('div');
        headerElem.className = 'msg-header';
        headerElem.textContent = 'STRA AI // INTELLIGENCE CORE';

        const bubbleElem = document.createElement('div');
        bubbleElem.className = 'msg-bubble';
        bubbleElem.innerHTML = '<span class="pulse-dot" aria-hidden="true"></span> Processing Intelligence Query...';

        wrapper.appendChild(headerElem);
        wrapper.appendChild(bubbleElem);

        if (DOM.chatThread) {
            DOM.chatThread.appendChild(wrapper);
        }

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

    // ========================================
    // CITATIONS
    // ========================================

    function renderCitationsDrawer(citations) {
        if (!citations || citations.length === 0 || !DOM.citationsList) return;

        DOM.citationsList.innerHTML = citations.map(c => `
            <div class="citation-card">
                <div class="cit-cat">[${escapeHtml(c.category.toUpperCase())}] Relevance Match: ${Math.round((c.score || 0.85) * 100)}%</div>
                <div class="cit-title">${escapeHtml(c.title)}</div>
                <div class="cit-sec">${escapeHtml(c.section)} — Ref: ${escapeHtml(c.source_ref || 'Internal DB')}</div>
            </div>
        `).join('');

        DOM.citationsBar.classList.remove('hidden');
        announceToScreenReader(`Retrieved ${citations.length} RAG knowledge sources`);
    }

    function getOrCreateCitationBadgeContainer(wrapperElem) {
        let container = wrapperElem.querySelector('.citation-badges-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'citation-badges-container';
            wrapperElem.appendChild(container);
        }
        return container;
    }

    function appendCitationBadge(wrapperElem, citations) {
        const container = getOrCreateCitationBadgeContainer(wrapperElem);
        const badge = document.createElement('div');
        badge.className = 'citation-badge';
        badge.innerHTML = `📎 ${citations.length} RAG Knowledge Source Citation(s)`;
        badge.setAttribute('role', 'button');
        badge.setAttribute('tabindex', '0');

        const toggleCitations = () => {
            DOM.citationsBar.classList.toggle('hidden');
            const isHidden = DOM.citationsBar.classList.contains('hidden');
            announceToScreenReader(isHidden ? 'Citations closed' : 'Citations opened');
        };

        badge.addEventListener('click', toggleCitations);
        badge.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleCitations();
            }
        });

        container.appendChild(badge);
    }

    function renderWebCitationsDrawer(webCitations) {
        if (!webCitations || webCitations.length === 0 || !DOM.webCitationsList) return;

        DOM.webCitationsList.innerHTML = webCitations.map(c => `
            <div class="citation-card web-citation-card">
                <div class="cit-cat">[WEB INTEL] ${escapeHtml(c.source)}</div>
                <div class="cit-title">
                    <a href="${escapeHtml(c.url)}" target="_blank" rel="noopener noreferrer" class="web-citation-link">
                        ${escapeHtml(c.title)} ↗
                    </a>
                </div>
                <div class="cit-sec">${escapeHtml(c.snippet)}</div>
            </div>
        `).join('');

        DOM.webCitationsBar.classList.remove('hidden');
        announceToScreenReader(`Retrieved ${webCitations.length} live internet sources`);
    }

    function appendWebCitationBadge(wrapperElem, webCitations) {
        const container = getOrCreateCitationBadgeContainer(wrapperElem);
        const badge = document.createElement('div');
        badge.className = 'citation-badge web-badge';
        badge.innerHTML = `🌐 ${webCitations.length} Live Internet Source(s)`;
        badge.setAttribute('role', 'button');
        badge.setAttribute('tabindex', '0');

        const toggleCitations = () => {
            DOM.webCitationsBar.classList.toggle('hidden');
            const isHidden = DOM.webCitationsBar.classList.contains('hidden');
            announceToScreenReader(isHidden ? 'Web citations closed' : 'Web citations opened');
        };

        badge.addEventListener('click', toggleCitations);
        badge.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleCitations();
            }
        });

        container.appendChild(badge);
    }

    // ========================================
    // STREAMING STATE MANAGEMENT
    // ========================================

    function startStreamingState() {
        state.isStreaming = true;
        updateStreamingUI(true);
        announceToScreenReader('AI is processing your request');
    }

    function finishStreamingState() {
        state.isStreaming = false;
        updateStreamingUI(false);
        state.activeAbortController = null;
    }

    function updateStreamingUI(isStreaming) {
        if (DOM.btnSend) {
            DOM.btnSend.classList.toggle('hidden', isStreaming);
        }
        if (DOM.btnStop) {
            DOM.btnStop.classList.toggle('hidden', !isStreaming);
        }
        if (DOM.typingIndicator) {
            DOM.typingIndicator.classList.toggle('hidden', !isStreaming);
        }
        if (DOM.userInput) {
            DOM.userInput.disabled = isStreaming;
        }
    }

    // ========================================
    // FORM SUBMISSION & API INTERACTION
    // ========================================

    async function handleFormSubmit() {
        if (state.isStreaming) return;

        const text = DOM.userInput.value.trim();
        if (!text) return;

        if (!state.hasUserInteracted) {
            state.hasUserInteracted = true;
        }

        if (DOM.welcomeCard && DOM.welcomeCard.parentNode) {
            DOM.welcomeCard.remove();
        }

        state.conversationHistory.push({ role: 'user', content: text });
        appendUserMessageDOM(text);

        DOM.userInput.value = '';
        DOM.userInput.style.height = CONFIG.UI.TEXTAREA_MIN_HEIGHT + 'px';

        startStreamingState();

        const { wrapper, bubbleElem } = createAssistantBubbleDOM();

        const payload = {
            messages: state.conversationHistory,
            enable_rag: DOM.toggleRag ? DOM.toggleRag.checked : true,
            enable_web_search: DOM.toggleWebSearch ? DOM.toggleWebSearch.checked : true,
            model: DOM.selectModel ? DOM.selectModel.value : 'gpt-4.1-nano-2025-04-14'
        };

        state.activeAbortController = new AbortController();
        let fullAssistantText = '';

        try {
            const response = await fetch(CONFIG.API.CHAT_STREAM, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: state.activeAbortController.signal
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

                    processStreamEvent(eventName, eventData, {
                        bubbleElem,
                        wrapper,
                        onChunk: (chunk) => {
                            fullAssistantText += chunk;
                            renderMarkdown(bubbleElem, fullAssistantText);
                            scrollToBottom();
                        }
                    });
                }
            }

            state.conversationHistory.push({ role: 'assistant', content: fullAssistantText });

        } catch (err) {
            if (err.name !== 'AbortError') {
                handleStreamError(err, bubbleElem);
            }
        } finally {
            finishStreamingState();
        }
    }

    function processStreamEvent(eventName, eventData, ctx) {
        switch (eventName) {
            case 'delta':
                try {
                    const parsed = JSON.parse(eventData);
                    if (parsed.content) {
                        ctx.onChunk(parsed.content);
                    }
                } catch (e) {
                    console.warn('[STRA AI] Failed to parse delta:', e);
                }
                break;

            case 'citations':
                try {
                    const citations = JSON.parse(eventData);
                    renderCitationsDrawer(citations);
                    appendCitationBadge(ctx.wrapper, citations);
                } catch (e) {
                    console.warn('[STRA AI] Failed to parse citations:', e);
                }
                break;

            case 'web_citations':
                try {
                    const webCitations = JSON.parse(eventData);
                    renderWebCitationsDrawer(webCitations);
                    appendWebCitationBadge(ctx.wrapper, webCitations);
                } catch (e) {
                    console.warn('[STRA AI] Failed to parse web citations:', e);
                }
                break;

            case 'error':
                try {
                    const parsed = JSON.parse(eventData);
                    const errorText = `\n\n**[ERROR]**: ${parsed.error}`;
                    renderMarkdown(ctx.bubbleElem, errorText);
                } catch (e) {
                    console.warn('[STRA AI] Failed to parse error:', e);
                }
                break;

            default:
                break;
        }
    }

    function handleStreamError(error, bubbleElem) {
        let errorMessage = '\n\n⚠️ **Operational Exception**: ';

        const isNetworkError = error.message.toLowerCase().includes('failed to fetch') ||
            error.message.toLowerCase().includes('networkerror') ||
            error.message.toLowerCase().includes('network error');

        if (isNetworkError) {
            errorMessage += `Network Disconnect\n\nUnable to establish communication with backend server (\`/api/chat/stream\`).`;
        } else {
            errorMessage += error.message;
        }

        renderMarkdown(bubbleElem, errorMessage);
    }

    // ========================================
    // SESSION MANAGEMENT
    // ========================================

    function clearSession() {
        if (state.isStreaming && state.activeAbortController) {
            state.activeAbortController.abort();
        }

        state.conversationHistory = [];
        state.hasUserInteracted = false;

        if (DOM.chatThread) {
            DOM.chatThread.innerHTML = '';
            if (DOM.welcomeCard) {
                DOM.chatThread.appendChild(DOM.welcomeCard);
            }
        }

        if (DOM.citationsBar) DOM.citationsBar.classList.add('hidden');
        if (DOM.webCitationsBar) DOM.webCitationsBar.classList.add('hidden');

        if (DOM.userInput) {
            DOM.userInput.value = '';
            DOM.userInput.style.height = CONFIG.UI.TEXTAREA_MIN_HEIGHT + 'px';
        }

        finishStreamingState();
        announceToScreenReader('Session cleared, new session started');
    }

    // ========================================
    // EVENT LISTENERS
    // ========================================

    function initEventListeners() {
        if (DOM.chatForm) {
            DOM.chatForm.addEventListener('submit', (e) => {
                e.preventDefault();
                handleFormSubmit();
            });
        }

        if (DOM.userInput) {
            DOM.userInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || !e.shiftKey)) {
                    e.preventDefault();
                    handleFormSubmit();
                }
            });
        }

        if (DOM.btnNewSession) {
            DOM.btnNewSession.addEventListener('click', clearSession);
        }

        if (DOM.btnToggleSidebar && DOM.sidebarPanel) {
            DOM.btnToggleSidebar.addEventListener('click', () => {
                DOM.sidebarPanel.classList.toggle('open');
            });
        }

        if (DOM.btnStop) {
            DOM.btnStop.addEventListener('click', () => {
                if (state.activeAbortController) {
                    state.activeAbortController.abort();
                    finishStreamingState();
                    announceToScreenReader('Generation stopped');
                }
            });
        }

        if (DOM.btnCloseCitations) {
            DOM.btnCloseCitations.addEventListener('click', () => {
                DOM.citationsBar.classList.add('hidden');
            });
        }

        if (DOM.btnCloseWebCitations) {
            DOM.btnCloseWebCitations.addEventListener('click', () => {
                DOM.webCitationsBar.classList.add('hidden');
            });
        }

        // Attach listeners to prompt chips and quick launch pills (using delegation)
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.chip-btn, .launch-pill-btn');
            if (btn) {
                const promptText = btn.getAttribute('data-prompt');
                if (promptText && !state.isStreaming) {
                    DOM.userInput.value = promptText;
                    DOM.userInput.focus();
                    handleFormSubmit();
                }
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (DOM.citationsBar && !DOM.citationsBar.classList.contains('hidden')) {
                    DOM.citationsBar.classList.add('hidden');
                }
                if (DOM.webCitationsBar && !DOM.webCitationsBar.classList.contains('hidden')) {
                    DOM.webCitationsBar.classList.add('hidden');
                }
            }
        });
    }

    // ========================================
    // INITIALIZATION
    // ========================================

    function init() {
        configureMarked();
        initClock();
        initTextareaAutoResize();
        initEventListeners();
        initSystemState();

        console.log('[STRA AI] Tactical Interface Engine v3.0 initialized');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
