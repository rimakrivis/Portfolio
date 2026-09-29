# Portfolio — notes for Claude

## Rebuild the agent's knowledge after text changes (always remind Rima)
The recruiter agent answers from `data/knowledge.json` + `data/embeddings.json`, a snapshot of the site text.
Whenever any page text changes (`*.html`, `work/*.html`, `data/cv.md`, `data/facts.md`), end your message by reminding Rima to run:

```bash
cd ~/portfolio && python scripts/build_knowledge.py
```

…and then commit + push the updated `data/*.json` together with the text change.

## Working with Rima
- One step at a time: give her only the next action, never a long checklist (ADHD).
- Rima pushes to GitHub herself — give her the git commands, don't push for her.
- Learning mode: explain what the code does in plain language + Python / AI-engineering terms.
