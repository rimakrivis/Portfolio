# See If We Match: add a recruiter agent to any portfolio

A chat on your portfolio: a recruiter pastes a job description, and an AI agent checks it against your
website, CV and facts, then rates every requirement **Strong / Partial / Missing** with quotes and links.

Works on a static HTML site deployed on Vercel. Python 3.12+, one OpenAI API key.

## Files you copy (the engine, same for everyone)

```
api/index.py  api/_agent.py  api/_rag.py  api/_config.py  api/__init__.py
js/agent.js   css/agent.css
scripts/build_knowledge.py
evals/run_evals.py
requirements.txt  vercel.json
```

## Files you make (everything personal)

| File | What goes in it |
|---|---|
| `agent.config.json` | Your name, pronouns, email and site URL; which pages to read; your skills sections; all widget texts. Copy the example in this repo and edit every value. |
| `data/cv.md` | Your CV as plain markdown, with `## ` headings. |
| `data/facts.md` | Things your site doesn't say: how you learn, availability, work authorisation, languages. Use `## ` headings; one of them should be `## How I learn`. |

In `agent.config.json`:
- `knowledge.pages`: every HTML page to index, with a readable name.
- `knowledge.projects_dir`: the folder holding one page per project (e.g. `work`). Those pages become `get_project`.
- `knowledge.skills_sections`: chunk titles that `list_skills` returns. Run the build with `--dry-run`, then copy the exact titles from `data/knowledge.json`.
- `agent.extra_rules`: optional honesty rules only you can know, e.g. "Python work starts in 2026".

## Steps

1. **Add the widget to every page** (before `</body>`):
   ```html
   <link rel="stylesheet" href="/css/agent.css">
   <script src="/js/agent.js" defer></script>
   ```
   The CSS uses these colour variables: `--paper --paper-2 --ink --ink-2 --rule --accent --on-accent`, plus `--sans --mono --round --ease --gutter`. Define them in your site's CSS, or edit `agent.css`.
2. **Key:** create `.env.local` with `OPENAI_API_KEY=sk-...`, and add `.env*.local` to your `.gitignore`. Never commit it.
3. **Build the knowledge base:** `python scripts/build_knowledge.py` (costs a fraction of a cent). Re-run it whenever your site text changes, and commit `data/*.json`.
4. **Test locally:** `uvicorn api.index:app --port 8811`, then open http://127.0.0.1:8811/.
5. **Write your evals:** put 3–4 job descriptions in `evals/` (a strong match, an unrelated role, a prompt-injection attempt), adapt the checks in `evals/run_evals.py`, and run `python evals/run_evals.py` until everything passes, more than once.
6. **Deploy:** in Vercel → Settings → Environment Variables, add `OPENAI_API_KEY`. Then push.
7. **Share:** `https://your-site/#<one of widget.open_hashes>` opens the chat directly.

## Optional settings (Vercel env vars)

| Variable | Default | Use |
|---|---|---|
| `LLM_PROVIDER` | `openai` | `gemini` or `xai` to switch provider (needs `GEMINI_API_KEY` or `XAI_API_KEY`) |
| `LLM_MODEL` | `gpt-5.4-mini` | Any chat model of that provider. Run the evals before switching. |

Embeddings always use OpenAI `text-embedding-3-small`, because the knowledge base is built with it.

## Built-in limits

12,000-character input · max 6 tool rounds · 10 requests per hour per visitor · 60-second timeout ·
memory of the last 8 messages (30k characters) · API key only on the server.
