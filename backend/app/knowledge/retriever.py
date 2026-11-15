"""Lightweight document retrieval used to ground Gemini answers."""
from pathlib import Path
import re
from dataclasses import dataclass

@dataclass
class KnowledgeDocument:
    title: str
    category: str
    content: str

def _tokens(text: str) -> set[str]:
    return {token for token in re.findall(r"[a-z0-9+#.-]{2,}", text.lower())}

class KnowledgeRetriever:
    def __init__(self, knowledge_dir: Path):
        self.documents = self._load_documents(knowledge_dir)

    @staticmethod
    def _load_documents(root: Path) -> list[KnowledgeDocument]:
        documents = []
        if not root.exists():
            return documents
        for path in sorted(root.rglob("*.md")):
            try:
                content = path.read_text(encoding="utf-8").strip()
            except OSError:
                continue
            if not content:
                continue
            title = next((line.lstrip("# ").strip() for line in content.splitlines() if line.startswith("# ")), path.stem.replace("-", " ").title())
            documents.append(KnowledgeDocument(title, path.parent.name, content[:12000]))
        return documents

    def retrieve(self, query: str, limit: int = 4) -> list[KnowledgeDocument]:
        query_tokens = _tokens(query)
        if not query_tokens:
            return []
        scored = []
        for document in self.documents:
            doc_tokens = _tokens(document.title + " " + document.content)
            overlap = len(query_tokens & doc_tokens)
            if overlap:
                title_overlap = len(query_tokens & _tokens(document.title))
                scored.append((overlap + title_overlap * 2, document))
        scored.sort(key=lambda item: item[0], reverse=True)
        return [document for _, document in scored[:limit]]
