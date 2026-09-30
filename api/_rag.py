"""
Retrieval — the "R" in RAG.

Given a question, find the portfolio chunks whose meaning is closest to it:
    1. embed the question            ->  one vector of 1536 numbers
    2. compare it with every chunk    ->  cosine similarity score (-1..1, higher = closer in meaning)
    3. return the top k chunks        ->  these become the agent's evidence

Try it from the portfolio folder:
    python -m api._rag "experience with LangGraph agents"
"""

import json
import math
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
_chunks, _vectors = None, None                         # loaded once, then reused (cache)


def _load():
    """Load the two JSON files into memory the first time we need them."""
    global _chunks, _vectors
    if _chunks is None:
        _chunks = json.loads((ROOT / "data" / "knowledge.json").read_text(encoding="utf-8"))
        _vectors = json.loads((ROOT / "data" / "embeddings.json").read_text())["vectors"]
    return _chunks, _vectors


def cosine(a: list[float], b: list[float]) -> float:
    """Cosine similarity = how much two vectors point the same way (1 = identical meaning)."""
    dot = sum(x * y for x, y in zip(a, b))
    return dot / (math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(y * y for y in b)))


def embed_query(text: str) -> list[float]:
    from openai import OpenAI
    return OpenAI().embeddings.create(model="text-embedding-3-small", input=[text]).data[0].embedding


def search(query: str, k: int = 5) -> list[dict]:
    """Return the k most relevant chunks, each with its similarity score."""
    chunks, vectors = _load()
    q = embed_query(query)
    scored = [(cosine(q, v), c) for v, c in zip(vectors, chunks)]
    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [{**c, "score": round(s, 3)} for s, c in scored[:k]]


def _load_env():
    """Read OPENAI_API_KEY from .env.local when running locally."""
    env = ROOT / ".env.local"
    if env.exists():
        for line in env.read_text().splitlines():
            if "=" in line and not line.strip().startswith("#"):
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip())


if __name__ == "__main__":
    import sys
    _load_env()
    question = " ".join(sys.argv[1:]) or "experience with LangGraph agents"
    print(f'\nQuestion: "{question}"\n')
    for hit in search(question):
        print(f"  {hit['score']:.3f}  {hit['title']}")
        print(f"         {hit['url']}")
        print(f"         {hit['text'][:110].replace(chr(10), ' ')}…\n")
