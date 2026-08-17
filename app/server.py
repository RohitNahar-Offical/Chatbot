import os
import sys
import json
import asyncio
from typing import List, Dict, Any, Optional

# Ensure project root is in sys.path so imports like 'from app...' work when run directly
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.responses import HTMLResponse, StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from openai import OpenAI
import openai

from app.prompt_engine import PromptEngine
from app.rag_engine import RAGEngine
from app.security import SecurityControl
from app.web_search import WebSearchEngine, query_needs_web_search

# Load environment variables
load_dotenv()


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KNOWLEDGE_DIR = os.path.join(BASE_DIR, "knowledge_base")
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")
STATIC_DIR = os.path.join(BASE_DIR, "static")

app = FastAPI(
    title="Stra AI — Defense & Cyber Intelligence Platform",
    version="1.0.0-Phase1A",
    description="Military and Cyber Intelligence Assistant powered by OpenAI and RAG retrieval."
)

# Mount static files and templates
os.makedirs(STATIC_DIR, exist_ok=True)
os.makedirs(TEMPLATES_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
templates = Jinja2Templates(directory=TEMPLATES_DIR)

# Initialize Core Services
prompt_engine = PromptEngine()
rag_engine = RAGEngine(knowledge_dir=KNOWLEDGE_DIR)
security_control = SecurityControl()
web_search_engine = WebSearchEngine()

# LLM Client Lazy Initializer (supports local Ollama / Unsloth fine-tuned models & OpenAI)
def is_openai_model(model: str) -> bool:
    openai_prefixes = ("gpt-", "o1", "o3", "text-embedding", "dall-e")
    return model.lower().startswith(openai_prefixes)

def get_llm_client(model: str) -> OpenAI:
    if is_openai_model(model):
        api_key = os.getenv("open_ai_key") or os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise HTTPException(
                status_code=500,
                detail="OpenAI API key missing. Please set OPENAI_API_KEY in .env file."
            )
        return OpenAI(api_key=api_key)
    
    # Default local LLM server (Ollama)
    base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")
    api_key = os.getenv("OLLAMA_API_KEY", "ollama")

    # Override for direct Unsloth Studio HTTP API if UNSLOTH_BASE_URL is explicitly set and model isn't Ollama tagged
    if "unsloth" in model.lower() and not model.endswith(":latest") and os.getenv("UNSLOTH_BASE_URL"):
        base_url = os.getenv("UNSLOTH_BASE_URL")
        api_key = os.getenv("UNSLOTH_API_KEY", "ollama")

    return OpenAI(
        base_url=base_url,
        api_key=api_key
    )


def format_llm_exception(e: Exception, model: str) -> str:
    err_type = type(e).__name__
    err_str = str(e)
    
    if isinstance(e, HTTPException):
        return f"Configuration Error: {e.detail}"

    # Handle API connection errors
    if isinstance(e, (openai.APIConnectionError,)) or "Connection error" in err_str or "ConnectError" in err_str or "Connection refused" in err_str or "failed to connect" in err_str.lower():
        if "unsloth" in model.lower():
            unsloth_url = os.getenv("UNSLOTH_BASE_URL", f"http://127.0.0.1:8888/p/{model}/v1")
            return (
                f"Network Exception: Unable to connect to local Unsloth Studio server at `{unsloth_url}`.\n\n"
                f"**Troubleshooting Steps**:\n"
                f"1. Ensure Unsloth Studio desktop app is open and serving `{model}`.\n"
                f"2. Verify Unsloth Studio port (8888) and authentication key in your `.env` file.\n"
                f"3. Check that the model is actively loaded in Unsloth Studio."
            )
        elif not is_openai_model(model):
            ollama_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")
            return (
                f"Network Exception: Unable to connect to local LLM server at {ollama_url}.\n\n"
                f"**Troubleshooting Steps**:\n"
                f"1. Ensure Ollama/local LLM engine is running (`ollama serve` or open Ollama Desktop).\n"
                f"2. Verify model `{model}` is registered in Ollama (`ollama list` or `ollama create {model} -f Modelfile`).\n"
                f"3. Alternatively, switch to an OpenAI model in Model Configuration."
            )
        else:
            return (
                f"Network Exception: Failed to connect to OpenAI API endpoints.\n\n"
                f"**Troubleshooting Steps**:\n"
                f"1. Check your internet connection & network connectivity.\n"
                f"2. Verify firewall/proxy rules allowing HTTPS traffic to `api.openai.com`."
            )
            
    if isinstance(e, openai.AuthenticationError) or "401" in err_str:
        return "Authentication Exception: Invalid or expired OpenAI API Key. Please update OPENAI_API_KEY in your .env file."
        
    if isinstance(e, openai.RateLimitError) or "429" in err_str:
        return "Rate Limit Exception: OpenAI API rate limit or quota exceeded. Please verify your OpenAI billing/quota status."

    return f"Execution Exception ({err_type}): {err_str}"


class MessageItem(BaseModel):
    role: str
    content: str

class ChatStreamRequest(BaseModel):
    messages: List[MessageItem]
    enable_rag: bool = True
    enable_web_search: bool = True
    model: str = Field(default="gpt-4.1-nano-2025-04-14")
    access_key: Optional[str] = ""


@app.get("/", response_class=HTMLResponse)
async def index_page(request: Request):
    """Renders the Stra AI Tactical Interface."""
    return templates.TemplateResponse(request=request, name="index.html")


@app.get("/api/status")
async def get_status():
    """Health check & operational posture status."""
    api_key_present = bool(os.getenv("open_ai_key") or os.getenv("OPENAI_API_KEY"))
    return {
        "system": "Stra AI Operational Platform",
        "phase": "1A MVP",
        "status": "ONLINE" if api_key_present else "DEGRADED (API Key Required)",
        "api_key_configured": api_key_present,
        "knowledge_documents_count": len(rag_engine.documents),
        "security": {
            "rate_limit_per_min": os.getenv("RATE_LIMIT_PER_MIN", "30"),
            "access_key_protection": bool(os.getenv("STRA_ACCESS_KEY"))
        }
    }


@app.get("/api/knowledge")
async def list_knowledge():
    """Lists ingested RAG knowledge base sources."""
    docs = []
    seen = set()
    for d in rag_engine.documents:
        if d["filename"] not in seen:
            seen.add(d["filename"])
            docs.append({
                "filename": d["filename"],
                "doc_title": d["doc_title"],
                "category": d["category"]
            })
    return {"sources": docs, "total_chunks": len(rag_engine.documents)}


@app.post("/api/chat/stream")
async def chat_stream_endpoint(payload: ChatStreamRequest, request: Request):
    """Streams response from OpenAI with optional RAG citations via Server-Sent Events (SSE)."""
    client_ip = request.client.host if request.client else "127.0.0.1"

    # Security Verification
    allowed, sec_msg = security_control.verify_access(client_ip, payload.access_key or "")
    if not allowed:
        security_control.log_audit("SECURITY_BLOCKED", client_ip, {"reason": sec_msg})
        raise HTTPException(status_code=429 if "Rate Limit" in sec_msg else 401, detail=sec_msg)

    if not payload.messages:
        raise HTTPException(status_code=400, detail="Conversation history cannot be empty.")

    last_user_msg = payload.messages[-1].content
    
    # 1. RAG Retrieval Step
    rag_context = ""
    citations = []
    if payload.enable_rag:
        retrieved_chunks = rag_engine.search(last_user_msg, top_k=3)
        if retrieved_chunks:
            rag_context = rag_engine.format_rag_context(retrieved_chunks)
            citations = [
                {
                    "title": chunk["doc_title"],
                    "section": chunk["section_title"],
                    "category": chunk["category"],
                    "source_ref": chunk["source_ref"],
                    "score": chunk["relevance_score"]
                }
                for chunk in retrieved_chunks
            ]

    # 2. Web Search Step
    web_context = ""
    web_citations = []
    if payload.enable_web_search and query_needs_web_search(last_user_msg):
        web_results = await web_search_engine.search(last_user_msg)
        if web_results:
            web_context = web_search_engine.format_web_context(web_results)
            web_citations = [
                {
                    "title": r["title"],
                    "url": r["url"],
                    "snippet": r["snippet"][:200],
                    "source": r["source"]
                }
                for r in web_results
            ]

    # 3. Format Prompt Payload
    formatted_messages = prompt_engine.format_conversation(
        [msg.model_dump() for msg in payload.messages],
        rag_context=rag_context,
        web_context=web_context
    )

    # 4. Log Audit Request
    security_control.log_audit("CHAT_STREAM_REQUEST", client_ip, {
        "model": payload.model,
        "enable_rag": payload.enable_rag,
        "enable_web_search": payload.enable_web_search,
        "query_length": len(last_user_msg),
        "citations_found": len(citations),
        "web_citations_found": len(web_citations)
    })

    # 5. Stream Generator
    async def sse_event_generator():
        # Send RAG Citations event first if RAG was used
        if citations:
            yield f"event: citations\ndata: {json.dumps(citations)}\n\n"

        # Send Web Citations event if web search found results
        if web_citations:
            yield f"event: web_citations\ndata: {json.dumps(web_citations)}\n\n"

        try:
            client = get_llm_client(payload.model)
            # Stream from OpenAI API
            response_stream = client.chat.completions.create(
                model=payload.model,
                messages=formatted_messages,
                stream=True
            )

            for chunk in response_stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    token = chunk.choices[0].delta.content
                    yield f"event: delta\ndata: {json.dumps({'content': token})}\n\n"
                    await asyncio.sleep(0.005)

            yield f"event: done\ndata: {json.dumps({'status': 'complete'})}\n\n"

        except Exception as e:
            formatted_err = format_llm_exception(e, payload.model)
            yield f"event: error\ndata: {json.dumps({'error': formatted_err})}\n\n"
            security_control.log_audit("STREAM_ERROR", client_ip, {"error": str(e), "model": payload.model})

    return StreamingResponse(sse_event_generator(), media_type="text/event-stream")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.server:app", host="127.0.0.1", port=8000, reload=True)
