# See If We Match: add a recruiter agent to any portfolio

A chat on your portfolio: a recruiter pastes a job description, and an AI agent checks it against your
website, CV and facts, then rates every requirement **Strong / Partial / Missing** with quotes and links.

Works on a static HTML site deployed on Vercel. Python 3.12+, one OpenAI API key.

> **License:** commercial use requires a paid license from Rima Krivickienė ([rima.poderyte@gmail.com](mailto:rima.poderyte@gmail.com)). See `LICENSE`.

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

---

## New client: quick walkthrough (copy-paste)

For a **plain HTML site on Vercel**. For Next.js, React or WordPress sites the widget works, but the backend needs adapting.

**1. Copy the engine into the client's project**
```bash
cd ~/Desktop/client-site
SRC=~/Desktop/portfolio
mkdir -p api js css scripts evals data
cp $SRC/api/{index.py,_agent.py,_rag.py,_config.py,__init__.py} api/
cp $SRC/js/agent.js js/ && cp $SRC/css/agent.css css/
cp $SRC/scripts/build_knowledge.py scripts/ && cp $SRC/evals/run_evals.py evals/
cp $SRC/requirements.txt $SRC/vercel.json $SRC/agent.config.json .
printf ".env*.local\n__pycache__/\nevals/out/\n" >> .gitignore
```

**2. Edit `agent.config.json`**: name, pronouns, email, site URL, `pages`, `projects_dir`, widget texts.
Delete Rima's `extra_rules` and add the client's own if needed.

**3. Write `data/cv.md` and `data/facts.md`** with `## ` headings, including `## How I learn`.
Write the facts together with the client: most of the answer quality comes from here.

**4. Add the widget** to every page (before `</body>`) and copy the colour variables block
(`:root { --paper … }`, including the dark-mode part) from the top of `css/style.css` into the client's CSS, then adjust the colours.

**5. Key and knowledge base**
```bash
echo "OPENAI_API_KEY=sk-..." > .env.local
python scripts/build_knowledge.py --dry-run    # free: check the chunks in data/knowledge.json
```
Copy the exact skills-section titles into `skills_sections` in the config, then do the real build:
`python scripts/build_knowledge.py`

**6. Test locally**: `uvicorn api.index:app --port 8811`, then open http://127.0.0.1:8811/.

**7. Evals**: add 3 job descriptions that fit this client to `evals/`, replace Rima-specific checks in
`run_evals.py` (e.g. "2+ yrs Python"), and run `python evals/run_evals.py` twice.

**8. Go live**: Vercel → client project → Settings → Environment Variables → `OPENAI_API_KEY`.
Push, then open `https://their-site/#see-if-we-match`.

**About the API key:** for paying clients, use a key from **their** OpenAI account with a monthly budget
limit, so their traffic is billed to them and a bug can never create a big bill for you.
Give each client written permission (license) to use the agent on their site, e.g. one line in the invoice.
