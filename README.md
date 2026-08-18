# STRA AI — Defense & Cyber Intelligence Platform (Phase 1A MVP Release)

**Stra AI** is an enterprise-grade OpenAI wrapper and specialized defense & cyber threat intelligence platform. Phase 1A delivers an interactive, high-tech tactical HUD interface, real-time Server-Sent Events (SSE) response streaming, curated Retrieval-Augmented Generation (RAG) knowledge retrieval, proprietary prompt guardrails, rate limiting, and structured audit logging.

---

## ⚡ Phase 1A Core Features

1. **Tactical Military & Cyber Intel Visual Identity**:
   - Dark HUD obsidian theme with glowing cyan and matrix green accents.
   - Live UTC clock, status indicators, and tactical scanline overlay.
   - Dynamic prompt module chips and model selection (`gpt-4.1-nano`, `gpt-4o`, `gpt-4o-mini`).

2. **OpenAI API Integration & Streaming**:
   - Asynchronous SSE token streaming (`/api/chat/stream`) with cancellation (`ABORT`) support.
   - Session-aware conversation history management.

3. **Proprietary Prompt Engine v1**:
   - Standardized `[UNCLASSIFIED // STRA-INTEL]` tactical headers.
   - Strict scope boundaries for defensive cyber analysis, OSINT workflows, and target safety guardrails.

4. **Curated RAG Knowledge Layer & Citation Cards**:
   - Ingests markdown intelligence sources from `knowledge_base/`:
     - **MITRE ATT&CK Framework**: Threat tactics (T1190, T1566, T1059, T1027, etc.) and mitigations.
     - **CISA Advisories**: Known Exploited Vulnerabilities (KEV), RCE guidelines, and Zero Trust directives.
     - **OSINT Methodology**: Intel collection cycle, GEOINT, domain footprinting, and information grading matrix.
     - **Defense Tech Standards**: Link 16 (MIL-STD-6016), Link 22, STANAG 4586, and tactical edge communications.
   - Returns relevance-scored context chunks and renders inline citations and source drawers.

5. **Security Controls & Audit Logging**:
   - Sliding-window rate limiter per IP address (default: 30 requests/minute).
   - Optional `STRA_ACCESS_KEY` validation header.
   - Structured JSON audit logging saved to `logs/audit.log`.

---

## 🚀 Getting Started

### 1. Requirements
- Python 3.10+
- OpenAI API Key

### 2. Environment Setup
Copy `.env.example` to create your local `.env` file (which is ignored by Git to keep your API keys private):
```bash
cp .env.example .env
```
Inside `.env`, configure your environment variables and API keys:
```env
OPENAI_API_KEY=your_actual_openai_api_key
UNSLOTH_API_KEY=your_actual_unsloth_api_key
SERPER_API_KEY=your_optional_serper_key
```

> [!CAUTION]
> **Security Warning**: Never commit `.env` or hardcode API keys in source files when sharing or publishing this repository publicly. Keep your API keys private.

### 3. Install Dependencies
```bash
python -m pip install -r requirements.txt
```

### 4. Launch the Platform
```bash
python run.py
```
Or run directly via Uvicorn:
```bash
uvicorn app.server:app --reload --port 8000
```
Then navigate to `http://localhost:8000` in your web browser.

---

## 🛠️ Project Architecture

```
r:\GIT\Chatbot\
├── app/
│   ├── prompt_engine.py    # System persona, safeguards & prompt formatting
│   ├── rag_engine.py       # In-memory vector/semantic search over knowledge base
│   ├── security.py         # Rate limiting, access keys & audit logging
│   └── server.py           # FastAPI app serving SSE streaming & endpoints
├── knowledge_base/
│   ├── mitre_attack.md     # MITRE ATT&CK TTP matrix
│   ├── cisa_advisories.md  # CISA vulnerability guidelines & Zero Trust
│   ├── osint_methodology.md# OSINT collection & verification framework
│   └── defense_tech_standards.md # Link 16, STANAG 4586 defense standards
├── static/
│   ├── css/style.css       # Tactical HUD glassmorphism dark theme
│   └── js/app.js           # Client SSE streaming & UI interactions
├── templates/
│   └── index.html          # HTML5 layout
├── logs/
│   └── audit.log           # JSON audit trail of queries and security events
├── requirements.txt        # Package dependencies
├── run.py                  # One-click launcher script
└── README.md               # Handover documentation
```

---

## 🔒 Security & Handover Notes

- **Audit Logs**: All queries, model choices, RAG citation counts, and security events are logged to `logs/audit.log`.
- **Custom Knowledge Base**: Additional intelligence files (`.md` or `.txt`) can be dropped into the `knowledge_base/` folder and will automatically be indexed by the RAG engine upon server start or restart.
