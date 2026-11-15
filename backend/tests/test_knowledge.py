from pathlib import Path
from app.knowledge.retriever import KnowledgeRetriever


def test_retriever_finds_tcp_document(tmp_path: Path):
    folder = tmp_path / "networking"
    folder.mkdir()
    (folder / "tcp.md").write_text("# TCP handshake\nSYN SYN-ACK ACK establish a TCP connection.", encoding="utf-8")
    retriever = KnowledgeRetriever(tmp_path)
    results = retriever.retrieve("Explain TCP SYN handshake")
    assert results
    assert results[0].title == "TCP handshake"


def test_retriever_returns_empty_for_no_match(tmp_path: Path):
    retriever = KnowledgeRetriever(tmp_path)
    assert retriever.retrieve("unrelated unique words") == []
