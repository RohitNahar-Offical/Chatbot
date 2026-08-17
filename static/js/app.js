/**
 * STRA AI — TACTICAL INTELLIGENCE ENGINE (v3.0 Operational Platform)
 * Fine-tuned state management, Web Audio API sound feedback, message response tools,
 * knowledge search filtering, unified intelligence drawers, and keyboard shortcuts.
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
        systemStatus: 'online',
        knowledgeSources: [],
        hasUserInteracted: false,
        audioEnabled: false,
        speechSynthesisUtterance: null,
        speakingMessageElem: null
    };

    // ========================================
    // WEB AUDIO API SYNTHESIZER
    // ========================================

    let audioCtx = null;

    function getAudioContext() {
        if (!audioCtx && typeof window.AudioContext !== 'undefined') {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        return audioCtx;
    }

    function playTone(freq, type = 'sine', duration = 0.08, vol = 0.05) {
        if (!state.audioEnabled) return;
        try {
            const ctx = getAudioContext();
            if (!ctx) return;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = type;
            osc.frequency.setValueAtTime(freq, ctx.currentTime);

            gain.gain.setValueAtTime(vol, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + duration);
        } catch (e) {
            // Audio context fallback ignore
        }
    }

    function playClickSound() {
        playTone(800, 'triangle', 0.04, 0.04);
    }

    function playChimeSound() {
        playTone(523.25, 'sine', 0.1, 0.06);
        setTimeout(() => playTone(659.25, 'sine', 0.12, 0.06), 80);
        setTimeout(() => playTone(783.99, 'sine', 0.18, 0.06), 160);
    }

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
        btnExportChat: document.getElementById('btn-export-chat'),
        btnClearChat: document.getElementById('btn-clear-chat'),
        btnAudioToggle: document.getElementById('btn-audio-toggle'),
        btnToggleSidebar: document.getElementById('btn-toggle-sidebar'),
        sidebarPanel: document.getElementById('sidebar-panel'),
        selectModel: document.getElementById('select-model'),
        toggleRag: document.getElementById('toggle-rag'),
        toggleWebSearch: document.getElementById('toggle-web-search'),
        typingIndicator: document.getElementById('typing-indicator'),
        hudClock: document.getElementById('hud-clock'),
        headerKbCount: document.getElementById('header-kb-count'),
        kbCount: document.getElementById('kb-count'),
        kbSearchInput: document.getElementById('kb-search-input'),
        systemStatusPill: document.getElementById('system-status-pill'),
        statusText: document.getElementById('status-text'),
        citationsBar: document.getElementById('citations-bar'),
        citationsList: document.getElementById('citations-list'),
        btnCloseCitations: document.getElementById('btn-close-citations'),
        webCitationsBar: document.getElementById('web-citations-bar'),
        webCitationsList: document.getElementById('web-citations-list'),
        tabRagSources: document.getElementById('tab-rag-sources'),
        tabWebSources: document.getElementById('tab-web-sources'),
        tabContentRag: document.getElementById('tab-content-rag'),
        tabContentWeb: document.getElementById('tab-content-web'),
        ragTabBadge: document.getElementById('rag-tab-badge'),
        webTabBadge: document.getElementById('web-tab-badge')
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
    // MARKDOWN CONFIGURATION & CODE COPY
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
            const lang = language || 'code';
            const escapedCode = escapeHtml(code);

            return `
                <div class="code-block-container">
                    <div class="code-header">
                        <span class="code-lang">💻 ${lang.toUpperCase()}</span>
                        <button class="code-copy-btn" onclick="window.straCopyCode(this)" type="button">
                            📋 COPY CODE
                        </button>
                    </div>
                    <pre><code class="language-${escapeHtml(lang)}">${escapedCode}</code></pre>
                </div>
            `;
        };

        marked.setOptions({ renderer });
    }

    // Attach global code copy handler
    window.straCopyCode = function (btn) {
        const container = btn.closest('.code-block-container');
        if (!container) return;
        const codeElem = container.querySelector('code');
        if (!codeElem) return;

        navigator.clipboard.writeText(codeElem.innerText).then(() => {
            playClickSound();
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '✅ COPIED!';
            btn.style.color = 'var(--accent-emerald)';
            setTimeout(() => {
                btn.innerHTML = originalHTML;
                btn.style.color = '';
            }, 1800);
        }).catch(err => {
            console.error('Failed to copy code block:', err);
        });
    };

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
    }

    // ========================================
    // API INITIALIZATION & KNOWLEDGE SEARCH
    // ========================================

    async function initSystemState() {
        await fetchSystemStatus();
        await fetchKnowledgeBase();
        initAudioToggleState();
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
        if (!container) return;

        if (!sources.length) {
            container.innerHTML = '<div class="source-item" style="color: var(--text-muted); font-size: 0.72rem;">No matching sources</div>';
            return;
        }

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

    function initKbSearchFilter() {
        if (!DOM.kbSearchInput) return;
        DOM.kbSearchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            if (!query) {
                renderKnowledgeSources(state.knowledgeSources);
                return;
            }

            const filtered = state.knowledgeSources.filter(src =>
                src.doc_title.toLowerCase().includes(query) ||
                (src.category && src.category.toLowerCase().includes(query)) ||
                (src.filename && src.filename.toLowerCase().includes(query))
            );

            renderKnowledgeSources(filtered);
        });
    }

    // ========================================
    // AUDIO TOGGLE STATE
    // ========================================

    function initAudioToggleState() {
        const saved = localStorage.getItem('stra_audio_enabled');
        state.audioEnabled = saved === 'true';

        updateAudioBtnUI();

        if (DOM.btnAudioToggle) {
            DOM.btnAudioToggle.addEventListener('click', () => {
                state.audioEnabled = !state.audioEnabled;
                localStorage.setItem('stra_audio_enabled', state.audioEnabled);
                updateAudioBtnUI();
                if (state.audioEnabled) {
                    playTone(600, 'sine', 0.1, 0.08);
                }
            });
        }
    }

    function updateAudioBtnUI() {
        if (!DOM.btnAudioToggle) return;
        const icon = DOM.btnAudioToggle.querySelector('.audio-icon');
        const textSpan = DOM.btnAudioToggle.querySelector('.btn-text');

        if (state.audioEnabled) {
            DOM.btnAudioToggle.classList.add('active');
            if (textSpan) textSpan.textContent = 'AUDIO ON';
            if (icon) {
                icon.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>`;
            }
        } else {
            DOM.btnAudioToggle.classList.remove('active');
            if (textSpan) textSpan.textContent = 'AUDIO OFF';
            if (icon) {
                icon.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line>`;
            }
        }
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
    // MESSAGE RENDERING & TOOLBAR
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

    function attachAssistantToolbar(wrapperElem, assistantText) {
        if (!wrapperElem || wrapperElem.querySelector('.msg-toolbar')) return;

        const toolbar = document.createElement('div');
        toolbar.className = 'msg-toolbar';

        toolbar.innerHTML = `
            <button class="toolbar-btn btn-copy-msg" type="button" title="Copy full Markdown response">
                📋 COPY
            </button>
            <button class="toolbar-btn btn-tts-msg" type="button" title="Read response aloud (Text-to-Speech)">
                🔊 READ
            </button>
            <button class="toolbar-btn btn-download-msg" type="button" title="Download response report">
                💾 SAVE
            </button>
            <button class="toolbar-btn btn-retry-msg" type="button" title="Regenerate intelligence response">
                🔄 REGENERATE
            </button>
        `;

        // Copy Handler
        const btnCopy = toolbar.querySelector('.btn-copy-msg');
        btnCopy.addEventListener('click', () => {
            navigator.clipboard.writeText(assistantText).then(() => {
                playClickSound();
                btnCopy.textContent = '✅ COPIED!';
                setTimeout(() => { btnCopy.textContent = '📋 COPY'; }, 1800);
            });
        });

        // TTS Read Aloud Handler
        const btnTts = toolbar.querySelector('.btn-tts-msg');
        btnTts.addEventListener('click', () => {
            toggleSpeechSynthesis(assistantText, btnTts);
        });

        // Download Handler
        const btnDownload = toolbar.querySelector('.btn-download-msg');
        btnDownload.addEventListener('click', () => {
            downloadTextFile(assistantText, `STRA_AI_Intel_Report_${Date.now()}.md`);
        });

        // Retry Handler
        const btnRetry = toolbar.querySelector('.btn-retry-msg');
        btnRetry.addEventListener('click', () => {
            if (state.isStreaming) return;
            const lastUserMsg = [...state.conversationHistory].reverse().find(m => m.role === 'user');
            if (lastUserMsg && DOM.userInput) {
                DOM.userInput.value = lastUserMsg.content;
                handleFormSubmit();
            }
        });

        wrapperElem.appendChild(toolbar);
    }

    function toggleSpeechSynthesis(text, btnElem) {
        if (!('speechSynthesis' in window)) return;

        if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
            if (state.speakingMessageElem) {
                state.speakingMessageElem.classList.remove('speaking');
                state.speakingMessageElem.textContent = '🔊 READ';
            }
            if (state.speakingMessageElem === btnElem) {
                state.speakingMessageElem = null;
                return;
            }
        }

        const plainText = text.replace(/[#*`_~[\]()]/g, '');
        const utterance = new SpeechSynthesisUtterance(plainText);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        utterance.onend = () => {
            btnElem.classList.remove('speaking');
            btnElem.textContent = '🔊 READ';
            state.speakingMessageElem = null;
        };

        state.speakingMessageElem = btnElem;
        btnElem.classList.add('speaking');
        btnElem.textContent = '⏹️ STOP';
        window.speechSynthesis.speak(utterance);
    }

    function downloadTextFile(content, filename) {
        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // ========================================
    // UNIFIED INTELLIGENCE DRAWER & CITATIONS
    // ========================================

    function initUnifiedDrawerTabs() {
        if (DOM.tabRagSources && DOM.tabWebSources) {
            DOM.tabRagSources.addEventListener('click', () => switchDrawerTab('rag'));
            DOM.tabWebSources.addEventListener('click', () => switchDrawerTab('web'));
        }
    }

    function switchDrawerTab(tabType) {
        playClickSound();
        if (tabType === 'rag') {
            if (DOM.tabRagSources) DOM.tabRagSources.classList.add('active');
            if (DOM.tabWebSources) DOM.tabWebSources.classList.remove('active');
            if (DOM.tabContentRag) DOM.tabContentRag.classList.remove('hidden');
            if (DOM.tabContentWeb) DOM.tabContentWeb.classList.add('hidden');
        } else {
            if (DOM.tabWebSources) DOM.tabWebSources.classList.add('active');
            if (DOM.tabRagSources) DOM.tabRagSources.classList.remove('active');
            if (DOM.tabContentWeb) DOM.tabContentWeb.classList.remove('hidden');
            if (DOM.tabContentRag) DOM.tabContentRag.classList.add('hidden');
        }
    }

    function renderCitationsDrawer(citations) {
        if (!citations || !citations.length || !DOM.citationsList) return;

        if (DOM.ragTabBadge) DOM.ragTabBadge.textContent = citations.length;

        DOM.citationsList.innerHTML = citations.map(c => `
            <div class="citation-card">
                <div class="cit-cat">[${escapeHtml(c.category.toUpperCase())}] Relevance Match: ${Math.round((c.score || 0.85) * 100)}%</div>
                <div class="cit-title">${escapeHtml(c.title)}</div>
                <div class="cit-sec">${escapeHtml(c.section)} — Ref: ${escapeHtml(c.source_ref || 'Internal DB')}</div>
            </div>
        `).join('');

        if (DOM.citationsBar) DOM.citationsBar.classList.remove('hidden');
        switchDrawerTab('rag');
    }

    function renderWebCitationsDrawer(webCitations) {
        if (!webCitations || !webCitations.length || !DOM.webCitationsList) return;

        if (DOM.webTabBadge) DOM.webTabBadge.textContent = webCitations.length;

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

        if (DOM.citationsBar) DOM.citationsBar.classList.remove('hidden');
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
        badge.innerHTML = `📎 ${citations.length} RAG Knowledge Citation(s)`;
        badge.setAttribute('role', 'button');
        badge.setAttribute('tabindex', '0');

        badge.addEventListener('click', () => {
            if (DOM.citationsBar) DOM.citationsBar.classList.toggle('hidden');
            switchDrawerTab('rag');
        });

        container.appendChild(badge);
    }

    function appendWebCitationBadge(wrapperElem, webCitations) {
        const container = getOrCreateCitationBadgeContainer(wrapperElem);
        const badge = document.createElement('div');
        badge.className = 'citation-badge web-badge';
        badge.innerHTML = `🌐 ${webCitations.length} Live Internet Source(s)`;
        badge.setAttribute('role', 'button');
        badge.setAttribute('tabindex', '0');

        badge.addEventListener('click', () => {
            if (DOM.citationsBar) DOM.citationsBar.classList.toggle('hidden');
            switchDrawerTab('web');
        });

        container.appendChild(badge);
    }

    // ========================================
    // STREAMING STATE MANAGEMENT
    // ========================================

    function startStreamingState() {
        state.isStreaming = true;
        updateStreamingUI(true);
        playTone(700, 'sine', 0.05, 0.03);
    }

    function finishStreamingState() {
        state.isStreaming = false;
        updateStreamingUI(false);
        state.activeAbortController = null;
        playChimeSound();
    }

    function updateStreamingUI(isStreaming) {
        if (DOM.btnSend) DOM.btnSend.classList.toggle('hidden', isStreaming);
        if (DOM.btnStop) DOM.btnStop.classList.toggle('hidden', !isStreaming);
        if (DOM.typingIndicator) DOM.typingIndicator.classList.toggle('hidden', !isStreaming);
        if (DOM.userInput) DOM.userInput.disabled = isStreaming;
    }

    // ========================================
    // FORM SUBMISSION & SSE CHAT STREAM
    // ========================================

    async function handleFormSubmit() {
        if (state.isStreaming) return;

        const text = DOM.userInput.value.trim();
        if (!text) return;

        playClickSound();

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
            attachAssistantToolbar(wrapper, fullAssistantText);

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
    // EXPORT & CLEAR SESSION
    // ========================================

    function clearSession() {
        playClickSound();

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

        if (DOM.userInput) {
            DOM.userInput.value = '';
            DOM.userInput.style.height = CONFIG.UI.TEXTAREA_MIN_HEIGHT + 'px';
        }

        finishStreamingState();
        announceToScreenReader('Session cleared, new session started');
    }

    function exportChatHistory() {
        if (!state.conversationHistory.length) return;
        playClickSound();

        let mdContent = `# STRA AI — Tactical Intelligence Session Report\n`;
        mdContent += `**Date**: ${new Date().toISOString()}\n`;
        mdContent += `**Total Exchanges**: ${state.conversationHistory.length}\n\n---\n\n`;

        state.conversationHistory.forEach((msg, idx) => {
            const roleName = msg.role === 'user' ? 'ANALYST // USER' : 'STRA AI // INTELLIGENCE CORE';
            mdContent += `### [${idx + 1}] ${roleName}\n\n${msg.content}\n\n---\n\n`;
        });

        downloadTextFile(mdContent, `STRA_AI_Session_Report_${Date.now()}.md`);
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
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleFormSubmit();
                }
            });
        }

        if (DOM.btnNewSession) {
            DOM.btnNewSession.addEventListener('click', clearSession);
        }

        if (DOM.btnExportChat) {
            DOM.btnExportChat.addEventListener('click', exportChatHistory);
        }

        if (DOM.btnClearChat) {
            DOM.btnClearChat.addEventListener('click', clearSession);
        }

        if (DOM.btnToggleSidebar && DOM.sidebarPanel) {
            DOM.btnToggleSidebar.addEventListener('click', () => {
                playClickSound();
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
                playClickSound();
                if (DOM.citationsBar) DOM.citationsBar.classList.add('hidden');
            });
        }

        // Attach listeners to prompt chips and quick launch pills
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

        // Global Shortcuts (Alt+N for new session, Escape for closing drawers)
        document.addEventListener('keydown', (e) => {
            if (e.altKey && (e.key === 'n' || e.key === 'N')) {
                e.preventDefault();
                clearSession();
            } else if (e.key === 'Escape') {
                if (DOM.citationsBar && !DOM.citationsBar.classList.contains('hidden')) {
                    DOM.citationsBar.classList.add('hidden');
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
        initKbSearchFilter();
        initUnifiedDrawerTabs();
        initEventListeners();
        initSystemState();

        console.log('[STRA AI] Tactical Interface Engine v3.0 fully initialized');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
