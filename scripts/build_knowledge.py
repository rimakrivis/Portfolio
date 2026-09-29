"""
Build the knowledge base for the recruiter agent (the "R" in RAG).

Pipeline:  website HTML + data/*.md  ->  clean text  ->  chunks  ->  embeddings  ->  data/*.json

Run from the portfolio folder:
    python scripts/build_knowledge.py            # chunk + embed (needs OPENAI_API_KEY in .env.local)
    python scripts/build_knowledge.py --dry-run  # chunk only, no API call — inspect the chunks for free

Re-run it whenever the website text changes, then commit the two JSON files.
"""

import json
import os
import re
import sys
from pathlib import Path

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent          # ~/portfolio
DATA = ROOT / "data"
EMBED_MODEL = "text-embedding-3-small"                 # cheap, good quality, 1536 dimensions
CHUNK_WORDS = 220                                      # target chunk size
OVERLAP_WORDS = 40                                     # words repeated between neighbouring chunks

# Pages to index and a readable name for each (the widget and footer are added by JS, so they're not in the HTML).
PAGES = {
    "index.html": "Home",
    "ai-engineering.html": "AI Engineering",
    "music.html": "Music & Marketing",
    "about.html": "About",
    "contact.html": "Contact",
    "work/dropoperator.html": "DropOperator case study",
    "work/reviewreply.html": "ReviewReply case study",
    "work/fake-news.html": "Fake News Detection case study",
    "work/amazon-nlp.html": "Customer Feedback Intelligence case study",
    "work/cnn-cifar10.html": "CIFAR-10 CNN case study",
}
MARKDOWN_FILES = {"data/cv.md": ("CV", "/assets/cv.pdf"), "data/facts.md": ("Facts from Rima", "/about.html")}

TEXT_TAGS = ["h1", "h2", "h3", "h4", "p", "li", "td", "th", "dt", "dd", "figcaption", "summary"]


# ---------- 1. extract: HTML -> sections of clean text ----------
def html_sections(path: str, page_name: str) -> list[dict]:
    """Walk a page top to bottom and group its text into sections that start at each h2/h3."""
    soup = BeautifulSoup((ROOT / path).read_text(encoding="utf-8"), "html.parser")
    main = soup.find("main") or soup.body
    sections, current = [], {"heading": page_name, "anchor": "", "lines": []}

    is_text = lambda t: t.name in TEXT_TAGS or (t.name == "div" and "stat" in (t.get("class") or []))
    for el in main.find_all(is_text):
        # skip text nested inside another text tag we already read (e.g. <li> inside <td>)
        if el.find_parent(TEXT_TAGS):
            continue
        text = " ".join(el.get_text(" ", strip=True).split())
        if not text:
            continue
        if el.name in ("h2", "h3"):                      # a new section starts here
            if current["lines"]:
                sections.append(current)
            holder = el.find_parent(id=True)             # nearest element with an id -> link anchor
            current = {"heading": text, "anchor": holder["id"] if holder else "", "lines": []}
        current["lines"].append(text)
    if current["lines"]:
        sections.append(current)

    # merge tiny sections (e.g. a heading with one line) into the previous one, so every chunk carries meaning
    merged = []
    for s in sections:
        if merged and len(" ".join(s["lines"]).split()) < 30:
            merged[-1]["lines"] += s["lines"]
        else:
            merged.append(s)
    sections = merged

    return [
        {
            "title": f"{page_name} — {s['heading']}" if s["heading"] != page_name else page_name,
            "url": "/" + path + (f"#{s['anchor']}" if s["anchor"] else ""),
            "text": "\n".join(s["lines"]),
        }
        for s in sections
    ]


def markdown_sections(path: str, name: str, url: str) -> list[dict]:
    """Split a markdown file at its '## ' headings; drop HTML comments and unfilled TODO lines."""
    raw = (ROOT / path).read_text(encoding="utf-8")
    raw = re.sub(r"<!--.*?-->", "", raw, flags=re.S)
    raw = "\n".join(l for l in raw.splitlines() if "TODO" not in l)
    parts = re.split(r"^## ", raw, flags=re.M)[1:]
    out = []
    for part in parts:
        heading, _, body = part.partition("\n")
        body = body.strip()
        if body:
            out.append({"title": f"{name} — {heading.strip()}", "url": url, "text": f"{heading.strip()}\n{body}"})
    return out


# ---------- 2. chunk: long sections -> overlapping windows of ~220 words ----------
def chunk(section: dict) -> list[dict]:
    words = section["text"].split()
    if len(words) <= CHUNK_WORDS:
        return [section]
    step = CHUNK_WORDS - OVERLAP_WORDS
    pieces = []
    for start in range(0, len(words), step):
        pieces.append({**section, "text": " ".join(words[start:start + CHUNK_WORDS])})
        if start + CHUNK_WORDS >= len(words):
            break
    return pieces


# ---------- 3. embed: text -> vectors (one batched API call) ----------
def load_env():
    """Tiny .env.local reader so we don't need python-dotenv."""
    env = ROOT / ".env.local"
    if env.exists():
        for line in env.read_text().splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"'))


def embed(texts: list[str]) -> list[list[float]]:
    from openai import OpenAI
    client = OpenAI()                                    # reads OPENAI_API_KEY from the environment
    resp = client.embeddings.create(model=EMBED_MODEL, input=texts)
    return [[round(x, 5) for x in d.embedding] for d in resp.data]


def main():
    dry = "--dry-run" in sys.argv
    sections = []
    for path, name in PAGES.items():
        sections += html_sections(path, name)
    for path, (name, url) in MARKDOWN_FILES.items():
        sections += markdown_sections(path, name, url)

    chunks = [c for s in sections for c in chunk(s)]
    for i, c in enumerate(chunks):
        c["id"] = i
        c["embed_text"] = f"{c['title']}\n{c['text']}"   # the title gives each chunk context

    print(f"{len(sections)} sections -> {len(chunks)} chunks "
          f"(avg {sum(len(c['text'].split()) for c in chunks) // len(chunks)} words)")

    DATA.mkdir(exist_ok=True)
    (DATA / "knowledge.json").write_text(
        json.dumps([{k: c[k] for k in ("id", "title", "url", "text")} for c in chunks], ensure_ascii=False, indent=1),
        encoding="utf-8")
    print("wrote data/knowledge.json")

    if dry:
        print("dry run: skipped embeddings")
        return
    load_env()
    vectors = embed([c["embed_text"] for c in chunks])
    (DATA / "embeddings.json").write_text(json.dumps({"model": EMBED_MODEL, "vectors": vectors}))
    print(f"wrote data/embeddings.json ({len(vectors)} vectors x {len(vectors[0])} dims)")


if __name__ == "__main__":
    main()
