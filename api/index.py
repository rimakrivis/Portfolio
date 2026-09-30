"""
The API — the door between the website and the agent.

    browser  --POST /api/chat {"message": "..."}-->  this FastAPI app  -->  run_agent()
    browser  <--SSE stream: step, step, ..., answer--

SSE (Server-Sent Events) = one HTTP response that stays open and sends small messages as they happen:
    event: step
    data: {"tool": "search_portfolio", "args": {"query": "RAG"}}

The browser shows each step live, so the recruiter watches the agent work instead of a spinner.

Run locally from the portfolio folder:
    uvicorn api.index:app --reload --port 8000
    curl -N -X POST localhost:8000/api/chat -H "Content-Type: application/json" -d '{"message": "Has she built RAG systems?"}'
"""

import json
import os
import sys
import time
from collections import defaultdict, deque
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))   # Vercel: make "api._agent" importable from the project root

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse
from typing import Literal

from pydantic import BaseModel

from api._agent import MAX_INPUT_CHARS, run_agent
from api._config import FIRST
from api._rag import ROOT, _load_env

_load_env()                                  # local: key from .env.local. On Vercel the env vars are already set.
app = FastAPI()

RATE_LIMIT = 10                              # requests per visitor...
RATE_WINDOW = 3600                           # ...per hour (seconds)
_hits: dict[str, deque] = defaultdict(deque) # ip -> timestamps of recent requests (in memory, per server instance)


class Turn(BaseModel):
    """One earlier message. Only these two roles are accepted — a visitor can't inject a fake "system" message."""
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    """Pydantic checks the JSON body for us: it must be {"message": "<text>"}, or FastAPI answers 422."""
    message: str
    history: list[Turn] = []                 # memory: the conversation so far, kept by the browser


def _client_ip(request: Request) -> str:
    # Behind Vercel's proxy the real visitor IP is the first one in x-forwarded-for.
    forwarded = request.headers.get("x-forwarded-for", "")
    return forwarded.split(",")[0].strip() or (request.client.host if request.client else "unknown")


def _rate_limited(ip: str) -> bool:
    """Sliding window: forget hits older than an hour, then count what's left."""
    now = time.time()
    hits = _hits[ip]
    while hits and hits[0] < now - RATE_WINDOW:
        hits.popleft()
    if len(hits) >= RATE_LIMIT:
        return True
    hits.append(now)
    return False


def _sse(event: str, data: dict) -> str:
    """Format one Server-Sent Event: a name line, a data line, then a blank line."""
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


@app.post("/api/chat")
@app.post("/api/index")                      # Vercel rewrites /api/chat -> /api/index (vercel.json); accept both
def chat(body: ChatRequest, request: Request):
    message = body.message.strip()
    if not message:
        return JSONResponse({"error": "Please type a question or paste a job description."}, status_code=400)
    if len(message) > MAX_INPUT_CHARS:
        return JSONResponse({"error": f"That's too long — please keep it under {MAX_INPUT_CHARS:,} characters."}, status_code=413)
    if _rate_limited(_client_ip(request)):
        return JSONResponse({"error": f"You've reached the limit for this hour. Please email {FIRST} directly."}, status_code=429)

    def stream():
        """A generator: FastAPI sends each yielded string to the browser immediately."""
        try:
            for event in run_agent(message, [t.model_dump() for t in body.history]):
                if event["type"] == "step":
                    yield _sse("step", {"tool": event["tool"], "args": event["args"]})
                else:
                    print(f"usage: {event['usage']}", flush=True)    # cost log -> terminal / Vercel logs, not the browser
                    yield _sse("answer", {"text": event["text"]})
        except Exception as e:                            # never show a raw error (or the key) to visitors
            print(f"agent error: {e!r}", flush=True)
            yield _sse("error", {"text": f"Sorry, the agent hit a problem. Please try again or email {FIRST}."})
        yield _sse("done", {})

    return StreamingResponse(stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ---------- local testing only: also serve the website, so page + API share one address (like on Vercel) ----------
if not os.environ.get("VERCEL"):
    from fastapi import HTTPException
    from fastapi.staticfiles import StaticFiles

    class _Site(StaticFiles):
        async def get_response(self, path, scope):
            if any(p.startswith(".") and p != "." for p in path.split("/")):   # never serve .env.local, .git, ...
                raise HTTPException(404)
            return await super().get_response(path, scope)

    app.mount("/", _Site(directory=ROOT, html=True), name="site")       # mounted last: /api/chat still wins
