import os
import re
import math
from typing import List, Dict, Any

class RAGEngine:
    def __init__(self, knowledge_dir: str):
        self.knowledge_dir = knowledge_dir
        self.documents: List[Dict[str, Any]] = []
        self.load_knowledge_base()

    def load_knowledge_base(self):
        """Scans and ingests markdown documents from knowledge_dir."""
        self.documents.clear()
        if not os.path.exists(self.knowledge_dir):
            return

        for fname in os.listdir(self.knowledge_dir):
            if fname.endswith(".md") or fname.endswith(".txt"):
                fpath = os.path.join(self.knowledge_dir, fname)
                try:
                    with open(fpath, "r", encoding="utf-8") as f:
                        content = f.read()
                    
                    # Split into chunks based on headers
                    chunks = self._chunk_document(fname, content)
                    self.documents.extend(chunks)
                except Exception as e:
                    print(f"[RAGEngine] Error reading {fname}: {e}")

    def _chunk_document(self, filename: str, content: str) -> List[Dict[str, Any]]:
        chunks = []
        # Extract title from # Title or first # header
        doc_title_match = re.search(r"^#\s+(.+)$", content, re.MULTILINE)
        doc_title = doc_title_match.group(1).strip() if doc_title_match else filename

        category_match = re.search(r"\*\*Category\*\*:\s*(.+)$", content, re.MULTILINE)
        category = category_match.group(1).strip() if category_match else "Intelligence Briefing"

        # Split content by header level 2 or 3
        sections = re.split(r"\n(?=#{2,3}\s+)", content)
        for idx, sec in enumerate(sections):
            sec_clean = sec.strip()
            if not sec_clean:
                continue
            
            # Extract section title
            sec_title_match = re.match(r"^#{2,3}\s+(.+)$", sec_clean)
            sec_title = sec_title_match.group(1).strip() if sec_title_match else f"Section {idx+1}"

            chunks.append({
                "id": f"{filename}#chunk_{idx}",
                "filename": filename,
                "doc_title": doc_title,
                "category": category,
                "section_title": sec_title,
                "content": sec_clean,
                "source_ref": f"{doc_title} ({sec_title})"
            })

        return chunks

    def search(self, query: str, top_k: int = 3, score_threshold: float = 0.05) -> List[Dict[str, Any]]:
        """Retrieves top_k matching knowledge chunks using term frequency & overlap scoring."""
        if not self.documents:
            return []

        query_terms = set(re.findall(r"\w+", query.lower()))
        if not query_terms:
            return []

        results = []
        for doc in self.documents:
            content_lower = doc["content"].lower()
            title_lower = doc["doc_title"].lower() + " " + doc["section_title"].lower()
            
            # Count term frequencies and header weight boosts
            score = 0.0
            for term in query_terms:
                if len(term) <= 2:  # skip short stop words
                    continue
                tf_content = content_lower.count(term)
                tf_title = title_lower.count(term)
                
                score += (tf_content * 1.0) + (tf_title * 4.0)

            if score > score_threshold:
                doc_copy = doc.copy()
                doc_copy["relevance_score"] = round(score, 2)
                results.append(doc_copy)

        # Sort by relevance score descending
        results.sort(key=lambda x: x["relevance_score"], reverse=True)
        return results[:top_k]

    def format_rag_context(self, search_results: List[Dict[str, Any]]) -> str:
        """Formats search results into a clean prompt context block."""
        if not search_results:
            return ""

        context_blocks = []
        for i, res in enumerate(search_results, 1):
            context_blocks.append(
                f"--- SOURCE [{i}]: {res['source_ref']} [Category: {res['category']}] ---\n"
                f"{res['content']}"
            )
        return "\n\n".join(context_blocks)
